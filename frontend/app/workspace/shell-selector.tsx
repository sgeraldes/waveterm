// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { atoms, createBlock, globalStore } from "@/store/global";
import { makeIconClass } from "@/util/util";
import {
    FloatingPortal,
    autoUpdate,
    offset,
    shift,
    useDismiss,
    useFloating,
    useInteractions,
} from "@floating-ui/react";
import { memo } from "react";
import "./shell-selector.scss";

export interface ShellMenuItem {
    shellId: string;
    label: string;
    icon: string;
    profile: ShellProfileType;
}

/**
 * Builds the list of shell menu items from profiles config.
 * Exported for unit testing.
 */
export function buildShellMenuItems(
    shellProfiles: Record<string, ShellProfileType> | undefined
): ShellMenuItem[] {
    if (!shellProfiles) return [];

    return Object.entries(shellProfiles)
        .filter(([, profile]) => !profile.hidden)
        .sort(([idA, profileA], [idB, profileB]) => {
            const orderA = profileA["display:order"] ?? 999;
            const orderB = profileB["display:order"] ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            return idA.localeCompare(idB);
        })
        .map(([shellId, profile]) => ({
            shellId,
            label: getShellDisplayName(shellId, profile),
            icon: getShellIcon(shellId, profile),
            profile,
        }));
}

function getShellDisplayName(shellId: string, profile: ShellProfileType): string {
    if (profile["display:name"]) {
        return profile["display:name"];
    }
    if (shellId.startsWith("wsl:")) {
        return shellId.substring(4);
    }
    const lower = shellId.toLowerCase();
    if (lower === "pwsh" || lower === "powershell") return "PowerShell";
    if (lower === "cmd") return "CMD";
    return shellId.charAt(0).toUpperCase() + shellId.slice(1);
}

function getShellIcon(shellId: string, profile: ShellProfileType): string {
    if (profile["display:icon"]) return profile["display:icon"];
    if (profile["shell:iswsl"] || shellId.startsWith("wsl:")) {
        const distro = (profile["shell:wsldistro"] || shellId.substring(4)).toLowerCase();
        if (distro.includes("ubuntu")) return "brands@ubuntu";
        if (distro.includes("debian")) return "brands@debian";
        if (distro.includes("fedora")) return "brands@fedora";
        if (distro.includes("suse")) return "brands@suse";
        return "brands@linux";
    }
    const lower = shellId.toLowerCase();
    if (lower.includes("pwsh") || lower.includes("powershell")) return "terminal";
    if (lower === "cmd") return "brands@windows";
    if (lower.includes("gitbash") || lower.includes("git-bash")) return "brands@git-alt";
    return "terminal";
}

export const ShellSelectorFloatingWindow = memo(
    ({
        isOpen,
        onClose,
        referenceElement,
    }: {
        isOpen: boolean;
        onClose: () => void;
        referenceElement: HTMLElement;
    }) => {
        const { refs, floatingStyles, context } = useFloating({
            open: isOpen,
            onOpenChange: onClose,
            placement: "left-start",
            middleware: [offset(-2), shift({ padding: 12 })],
            whileElementsMounted: autoUpdate,
            elements: {
                reference: referenceElement,
            },
        });

        const dismiss = useDismiss(context);
        const { getFloatingProps } = useInteractions([dismiss]);

        if (!isOpen) return null;

        const fullConfig = globalStore.get(atoms.fullConfigAtom);
        const shellProfiles = fullConfig?.settings?.["shell:profiles"];
        const menuItems = buildShellMenuItems(shellProfiles);

        const handleShellClick = (item: ShellMenuItem) => {
            const tabData = globalStore.get(atoms.activeTab);
            const tabBaseDir = tabData?.meta?.["tab:basedir"];

            const blockDef: BlockDef = {
                meta: {
                    view: "term",
                    controller: "shell",
                    "shell:profile": item.shellId,
                    ...(tabBaseDir ? { "cmd:cwd": tabBaseDir } : {}),
                },
            };
            createBlock(blockDef);
            onClose();
        };

        if (menuItems.length === 0) {
            // Fall back to just launching a default terminal
            const blockDef: BlockDef = {
                meta: { view: "term", controller: "shell" },
            };
            createBlock(blockDef);
            onClose();
            return null;
        }

        return (
            <FloatingPortal>
                <div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    {...getFloatingProps()}
                    className="shell-selector-menu bg-modalbg border border-border rounded-lg shadow-xl p-2 z-50"
                >
                    <div className="shell-selector-header">Open Terminal With</div>
                    {menuItems.map((item) => (
                        <div
                            key={item.shellId}
                            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-hoverbg cursor-pointer transition-colors text-secondary hover:text-white"
                            role="menuitem"
                            tabIndex={0}
                            onClick={() => handleShellClick(item)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleShellClick(item); } }}
                        >
                            <div className="text-lg w-5 flex justify-center">
                                <i className={makeIconClass(item.icon, false)}></i>
                            </div>
                            <div className="text-sm whitespace-nowrap">{item.label}</div>
                        </div>
                    ))}
                </div>
            </FloatingPortal>
        );
    }
);

ShellSelectorFloatingWindow.displayName = "ShellSelectorFloatingWindow";
