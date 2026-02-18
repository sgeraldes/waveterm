import { TypeAheadModal } from "@/app/modals/typeaheadmodal";
import { atoms, globalStore, WOS } from "@/app/store/global";
import { globalRefocusWithTimeout } from "@/app/store/keymodel";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { NodeModel } from "@/layout/index";
import * as keyutil from "@/util/keyutil";
import * as jotai from "jotai";
import * as React from "react";

/**
 * Gets appropriate icon for a shell type.
 */
function getShellIcon(shellId: string, profile?: ShellProfileType): string {
    if (profile?.["display:icon"]) {
        return profile["display:icon"];
    }

    if (profile?.["shell:iswsl"] || shellId.startsWith("wsl:")) {
        const distroName = (profile?.["shell:wsldistro"] || shellId.substring(4)).toLowerCase();
        if (distroName.includes("ubuntu")) return "brands@ubuntu";
        if (distroName.includes("debian")) return "brands@debian";
        if (distroName.includes("fedora")) return "brands@fedora";
        if (distroName.includes("opensuse") || distroName.includes("suse")) return "brands@suse";
        return "brands@linux";
    }

    const lowerId = shellId.toLowerCase();

    if (lowerId.includes("pwsh") || lowerId.includes("powershell")) {
        return "terminal";
    }

    if (lowerId === "cmd") {
        return "brands@windows";
    }

    if (lowerId.includes("gitbash") || lowerId.includes("git-bash")) {
        return "brands@git-alt";
    }

    return "terminal";
}

/**
 * Formats a shell profile name for display.
 */
function formatShellDisplayName(shellId: string, profile?: ShellProfileType): string {
    if (profile?.["display:name"]) {
        return profile["display:name"];
    }

    if (shellId.startsWith("wsl:")) {
        return shellId.substring(4);
    }

    const lowerId = shellId.toLowerCase();

    if (lowerId === "pwsh" || lowerId === "powershell") {
        return "PowerShell";
    }
    if (lowerId.startsWith("pwsh-")) {
        return `PowerShell ${shellId.substring(5)}`;
    }

    if (lowerId === "cmd") {
        return "CMD";
    }

    return shellId.charAt(0).toUpperCase() + shellId.slice(1);
}

/**
 * Creates shell suggestion items from configured shell profiles.
 * Filters out hidden profiles.
 */
function createShellSuggestionItems(
    shellProfiles: Record<string, ShellProfileType> | undefined,
    currentShell: string,
    defaultShell: string,
    filterText: string
): Array<SuggestionConnectionItem> {
    if (!shellProfiles) return [];

    const items: Array<SuggestionConnectionItem> = [];
    const normalizedFilter = filterText.toLowerCase();

    const sortedEntries = Object.entries(shellProfiles).sort(([idA, profileA], [idB, profileB]) => {
        const orderA = profileA["display:order"] ?? 0;
        const orderB = profileB["display:order"] ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        const nameA = profileA["display:name"] || idA;
        const nameB = profileB["display:name"] || idB;
        return nameA.localeCompare(nameB);
    });

    for (const [shellId, profile] of sortedEntries) {
        if (profile.hidden) continue;

        const displayName = formatShellDisplayName(shellId, profile);
        const icon = getShellIcon(shellId, profile);
        const isDefault = shellId === defaultShell;
        const label = isDefault ? `${displayName} (default)` : displayName;

        if (
            normalizedFilter &&
            !displayName.toLowerCase().includes(normalizedFilter) &&
            !shellId.toLowerCase().includes(normalizedFilter)
        ) {
            continue;
        }

        items.push({
            status: "connected",
            icon: icon,
            iconColor: "var(--grey-text-color)",
            value: shellId,
            label: label,
            current: shellId === currentShell,
        });
    }

    return items;
}

/**
 * Creates built-in shell suggestion items (cmd, pwsh, etc.).
 */
function createBuiltInShellItems(
    currentShell: string,
    defaultShell: string,
    filterText: string
): Array<SuggestionConnectionItem> {
    const builtInShells = [
        { id: "pwsh", name: "PowerShell", icon: "terminal" },
        { id: "cmd", name: "CMD", icon: "brands@windows" },
    ];

    const items: Array<SuggestionConnectionItem> = [];
    const normalizedFilter = filterText.toLowerCase();

    for (const shell of builtInShells) {
        if (
            normalizedFilter &&
            !shell.name.toLowerCase().includes(normalizedFilter) &&
            !shell.id.includes(normalizedFilter)
        ) {
            continue;
        }

        const isDefault = shell.id === defaultShell;
        const label = isDefault ? `${shell.name} (default)` : shell.name;

        items.push({
            status: "connected",
            icon: shell.icon,
            iconColor: "var(--grey-text-color)",
            value: shell.id,
            label: label,
            current: shell.id === currentShell,
        });
    }

    return items;
}

interface ShellSelectorModalProps {
    blockId: string;
    blockRef: React.RefObject<HTMLDivElement>;
    shellBtnRef: React.RefObject<HTMLDivElement>;
    changeShellModalAtom: jotai.PrimitiveAtom<boolean>;
    nodeModel: NodeModel;
}

/**
 * Shell Selector Modal
 *
 * Allows users to select a shell profile for their terminal.
 * Unlike the connection modal, this only shows local shells (not remote connections).
 */
const ShellSelectorModal = React.memo(
    ({ blockId, blockRef, shellBtnRef, changeShellModalAtom, nodeModel }: ShellSelectorModalProps) => {
        const [filterText, setFilterText] = React.useState("");
        const shellModalOpen = jotai.useAtomValue(changeShellModalAtom);
        const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", blockId));
        const isNodeFocused = jotai.useAtomValue(nodeModel.isFocused);
        const currentShell = blockData?.meta?.["shell:profile"] || "";
        const [rowIndex, setRowIndex] = React.useState(0);
        const fullConfig = jotai.useAtomValue(atoms.fullConfigAtom);
        const shellProfiles = fullConfig?.settings?.["shell:profiles"];
        const defaultShell = fullConfig?.settings?.["shell:default"] || "";

        const changeShell = React.useCallback(
            async (shellId: string) => {
                if (shellId === currentShell) {
                    return;
                }

                const meta: MetaType = {
                    "shell:profile": shellId || null,
                    connection: null,
                };

                await RpcApi.SetMetaCommand(TabRpcClient, {
                    oref: WOS.makeORef("block", blockId),
                    meta,
                });

                const tabId = globalStore.get(atoms.staticTabId);
                RpcApi.ControllerResyncCommand(TabRpcClient, {
                    tabid: tabId,
                    blockid: blockId,
                    forcerestart: true,
                }).catch((e) => console.log("error resyncing controller:", e));
            },
            [blockId, currentShell, shellProfiles]
        );

        const suggestions: Array<SuggestionsType> = [];

        const effectiveCurrentShell = currentShell || defaultShell || "";

        const hasProfiles = shellProfiles && Object.keys(shellProfiles).length > 0;

        const localShells: Array<SuggestionConnectionItem> = [];

        if (hasProfiles) {
            const nonWslProfiles = Object.fromEntries(
                Object.entries(shellProfiles).filter(
                    ([id, profile]) => !profile["shell:iswsl"] && !id.startsWith("wsl:")
                )
            );
            const profileItems = createShellSuggestionItems(
                nonWslProfiles,
                effectiveCurrentShell,
                defaultShell,
                filterText
            );
            localShells.push(...profileItems);

            const wslProfiles = Object.fromEntries(
                Object.entries(shellProfiles).filter(([id, profile]) => profile["shell:iswsl"] || id.startsWith("wsl:"))
            );
            const wslProfileItems = createShellSuggestionItems(
                wslProfiles,
                effectiveCurrentShell,
                defaultShell,
                filterText
            );

            if (localShells.length > 0) {
                suggestions.push({
                    headerText: "Shells",
                    items: localShells,
                });
            }

            if (wslProfileItems.length > 0) {
                suggestions.push({
                    headerText: "WSL Distributions",
                    items: wslProfileItems,
                });
            }
        } else {
            localShells.push(...createBuiltInShellItems(effectiveCurrentShell, defaultShell, filterText));

            if (localShells.length > 0) {
                suggestions.push({
                    headerText: "Shells",
                    items: localShells,
                });
            }
        }

        let selectionList: Array<SuggestionConnectionItem> = suggestions.flatMap((item) => {
            if ("items" in item) {
                return item.items;
            }
            return item;
        });

        selectionList = selectionList.map((item, index) => {
            if (index === rowIndex && item.iconColor === "var(--grey-text-color)") {
                return { ...item, iconColor: "var(--main-text-color)" };
            }
            return item;
        });

        const handleKeyDown = React.useCallback(
            (waveEvent: WaveKeyboardEvent): boolean => {
                if (keyutil.checkKeyPressed(waveEvent, "Enter")) {
                    const rowItem = selectionList[rowIndex];
                    if (rowItem) {
                        changeShell(rowItem.value);
                        globalStore.set(changeShellModalAtom, false);
                        globalRefocusWithTimeout(10);
                    }
                    setRowIndex(0);
                    return true;
                }
                if (keyutil.checkKeyPressed(waveEvent, "Escape")) {
                    globalStore.set(changeShellModalAtom, false);
                    setFilterText("");
                    globalRefocusWithTimeout(10);
                    return true;
                }
                if (keyutil.checkKeyPressed(waveEvent, "ArrowUp")) {
                    setRowIndex((idx) => Math.max(idx - 1, 0));
                    return true;
                }
                if (keyutil.checkKeyPressed(waveEvent, "ArrowDown")) {
                    setRowIndex((idx) => Math.min(idx + 1, selectionList.length - 1));
                    return true;
                }
                setRowIndex(0);
                return false;
            },
            [changeShellModalAtom, selectionList, rowIndex, changeShell]
        );

        React.useEffect(() => {
            setRowIndex((idx) => Math.min(idx, Math.max(0, selectionList.length - 1)));
        }, [selectionList.length]);

        if (!shellModalOpen) {
            return null;
        }

        return (
            <TypeAheadModal
                blockRef={blockRef}
                anchorRef={shellBtnRef}
                suggestions={suggestions}
                onSelect={(selected: string) => {
                    changeShell(selected);
                    globalStore.set(changeShellModalAtom, false);
                    globalRefocusWithTimeout(10);
                }}
                selectIndex={rowIndex}
                autoFocus={isNodeFocused}
                onKeyDown={(e) => keyutil.keydownWrapper(handleKeyDown)(e)}
                onChange={(current: string) => setFilterText(current)}
                value={filterText}
                label="Select Shell..."
                onClickBackdrop={() => globalStore.set(changeShellModalAtom, false)}
            />
        );
    }
);

export { ShellSelectorModal };
