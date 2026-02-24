// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@/app/element/button";
import { atoms, recordTEvent } from "@/app/store/global";
import { IconButton, ToggleIconButton } from "@/element/iconbutton";
import { MagnifyIcon } from "@/element/magnify";
import { MenuButton } from "@/element/menubutton";
import * as util from "@/util/util";
import clsx from "clsx";
import * as jotai from "jotai";
import * as React from "react";

/**
 * Formats a shell profile name for display.
 * - "cmd" → "CMD"
 * - "pwsh" → "PowerShell"
 * - "pwsh-7.5" → "PowerShell 7.5"
 * - "bash" → "Bash"
 */
function formatShellName(name: string): string {
    if (!name) return name;

    const lowerName = name.toLowerCase();

    // PowerShell variants
    if (lowerName === "pwsh" || lowerName === "powershell") {
        return "PowerShell";
    }
    if (lowerName.startsWith("pwsh-")) {
        const version = name.substring(5);
        return `PowerShell ${version}`;
    }
    if (lowerName.startsWith("powershell-")) {
        const version = name.substring(11);
        return `PowerShell ${version}`;
    }

    // CMD
    if (lowerName === "cmd") {
        return "CMD";
    }

    // Bash variants
    if (lowerName === "bash" || lowerName === "gitbash") {
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    // Default: capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1);
}

export const colorRegex = /^((#[0-9a-f]{6,8})|([a-z]+))$/;
export const NumActiveConnColors = 8;

export function blockViewToIcon(view: string): string {
    if (view == "term") {
        return "terminal";
    }
    if (view == "preview") {
        return "file";
    }
    if (view == "web") {
        return "globe";
    }
    if (view == "waveai") {
        return "sparkles";
    }
    if (view == "help") {
        return "circle-question";
    }
    if (view == "tips") {
        return "lightbulb";
    }
    return "square";
}

export function blockViewToName(view: string): string {
    if (util.isBlank(view)) {
        return "(No View)";
    }
    if (view == "term") {
        return "Terminal";
    }
    if (view == "preview") {
        return "Preview";
    }
    if (view == "web") {
        return "Web";
    }
    if (view == "waveai") {
        return "WaveAI";
    }
    if (view == "help") {
        return "Help";
    }
    if (view == "tips") {
        return "Tips";
    }
    return view;
}

export function processTitleString(titleString: string): React.ReactNode[] {
    if (titleString == null) {
        return null;
    }
    const tagRegex = /<(\/)?([a-z]+)(?::([#a-z0-9@-]+))?>/g;
    let lastIdx = 0;
    let match;
    const partsStack = [[]];
    while ((match = tagRegex.exec(titleString)) != null) {
        const lastPart = partsStack[partsStack.length - 1];
        const before = titleString.substring(lastIdx, match.index);
        lastPart.push(before);
        lastIdx = match.index + match[0].length;
        const [, isClosing, tagName, tagParam] = match;
        if (tagName == "icon" && !isClosing) {
            if (tagParam == null) {
                continue;
            }
            const iconClass = util.makeIconClass(tagParam, false);
            if (iconClass == null) {
                continue;
            }
            lastPart.push(<i key={match.index} className={iconClass} />);
            continue;
        }
        if (tagName == "c" || tagName == "color") {
            if (isClosing) {
                if (partsStack.length <= 1) {
                    continue;
                }
                partsStack.pop();
                continue;
            }
            if (tagParam == null) {
                continue;
            }
            if (!tagParam.match(colorRegex)) {
                continue;
            }
            const children = [];
            const rtag = React.createElement("span", { key: match.index, style: { color: tagParam } }, children);
            lastPart.push(rtag);
            partsStack.push(children);
            continue;
        }
        if (tagName == "i" || tagName == "b") {
            if (isClosing) {
                if (partsStack.length <= 1) {
                    continue;
                }
                partsStack.pop();
                continue;
            }
            const children = [];
            const rtag = React.createElement(tagName, { key: match.index }, children);
            lastPart.push(rtag);
            partsStack.push(children);
            continue;
        }
    }
    partsStack[partsStack.length - 1].push(titleString.substring(lastIdx));
    return partsStack[0];
}

export function getBlockHeaderIcon(blockIcon: string, blockData: Block): React.ReactNode {
    let blockIconElem: React.ReactNode = null;
    if (util.isBlank(blockIcon)) {
        blockIcon = "square";
    }
    let iconColor = blockData?.meta?.["icon:color"];
    if (iconColor && !iconColor.match(colorRegex)) {
        iconColor = null;
    }
    let iconStyle = null;
    if (!util.isBlank(iconColor)) {
        iconStyle = { color: iconColor };
    }
    const iconClass = util.makeIconClass(blockIcon, true);
    if (iconClass != null) {
        blockIconElem = <i key="icon" style={iconStyle} className={clsx(`block-frame-icon`, iconClass)} />;
    }
    return blockIconElem;
}

export function getViewIconElem(
    viewIconUnion: string | IconButtonDecl,
    blockData: Block,
    iconColor?: string
): React.ReactElement {
    if (viewIconUnion == null || typeof viewIconUnion === "string") {
        const viewIcon = viewIconUnion as string;
        const style: React.CSSProperties = iconColor ? { color: iconColor, opacity: 1.0 } : {};
        return (
            <div className="block-frame-view-icon" style={style}>
                {getBlockHeaderIcon(viewIcon, blockData)}
            </div>
        );
    } else {
        return <IconButton decl={viewIconUnion} className="block-frame-view-icon" />;
    }
}

/**
 * Gets shell profile display info from a profile ID.
 * Falls back to formatting the ID as a display name if no profile config exists.
 * When profileId is blank, uses the default shell setting.
 */
function getShellProfileDisplayInfo(
    profileId: string,
    shellProfiles?: Record<string, ShellProfileType>,
    defaultShell?: string
): { displayName: string; icon: string; isDefault: boolean } {
    // Use default shell when profileId is blank
    const effectiveProfileId = util.isBlank(profileId) ? defaultShell || "pwsh" : profileId;
    const isDefault = util.isBlank(profileId) || effectiveProfileId === defaultShell;

    // Check configured shell profiles
    if (shellProfiles?.[effectiveProfileId]) {
        const profile = shellProfiles[effectiveProfileId];
        return {
            displayName: profile["display:name"] || formatShellName(effectiveProfileId),
            icon: profile["display:icon"] || getShellIcon(effectiveProfileId, profile),
            isDefault,
        };
    }

    // Handle WSL profile IDs (wsl:DistroName)
    if (effectiveProfileId.startsWith("wsl:")) {
        const distroName = effectiveProfileId.substring(4);
        return { displayName: distroName, icon: "brands@linux", isDefault };
    }

    // Fallback to formatted profile ID
    return {
        displayName: formatShellName(effectiveProfileId),
        icon: getShellIcon(effectiveProfileId, null),
        isDefault,
    };
}

/**
 * Gets appropriate icon for a shell profile.
 */
function getShellIcon(profileId: string, profile: ShellProfileType | null): string {
    // Check if profile has a custom icon
    if (profile?.["display:icon"]) {
        return profile["display:icon"];
    }

    // WSL distros
    if (profile?.["shell:iswsl"] || profileId.startsWith("wsl:")) {
        return "brands@linux";
    }

    const lowerId = profileId.toLowerCase();

    // PowerShell
    if (lowerId.includes("pwsh") || lowerId.includes("powershell")) {
        return "terminal"; // Could use brands@windows but terminal is more recognizable
    }

    // CMD
    if (lowerId === "cmd") {
        return "brands@windows";
    }

    // Git Bash
    if (lowerId.includes("gitbash") || lowerId.includes("git-bash")) {
        return "brands@git-alt";
    }

    // Bash/Zsh/Fish/Other Unix shells
    if (lowerId === "bash" || lowerId === "zsh" || lowerId === "fish" || lowerId === "sh") {
        return "terminal";
    }

    // Default
    return "terminal";
}

interface ShellButtonProps {
    shellProfile: string;
    changeShellModalAtom: jotai.PrimitiveAtom<boolean>;
}

/**
 * ShellButton displays the current shell name for local shells.
 * Unlike ConnectionButton, it has no connection status indicators since shells
 * are local processes, not network connections.
 */
export const ShellButton = React.memo(
    React.forwardRef<HTMLDivElement, ShellButtonProps>(
        ({ shellProfile, changeShellModalAtom }: ShellButtonProps, ref) => {
            const [, setShellModalOpen] = jotai.useAtom(changeShellModalAtom);
            const fullConfig = jotai.useAtomValue(atoms.fullConfigAtom);
            const shellProfiles = fullConfig?.settings?.["shell:profiles"];
            const defaultShell = fullConfig?.settings?.["shell:default"] || "";

            const { displayName, icon, isDefault } = getShellProfileDisplayInfo(
                shellProfile,
                shellProfiles,
                defaultShell
            );
            const displayLabel = isDefault ? `${displayName} (default)` : displayName;

            const clickHandler = function () {
                recordTEvent("action:other", { "action:type": "shellselector", "action:initiator": "mouse" });
                setShellModalOpen(true);
            };

            const titleText = `Shell: ${displayName}${isDefault ? " (default)" : ""}`;

            return (
                <div ref={ref} className={clsx("shell-button")} onClick={clickHandler} title={titleText}>
                    <i
                        className={clsx(util.makeIconClass(icon, false), "shell-icon")}
                        style={{ color: "var(--grey-text-color)", marginRight: 4 }}
                    />
                    <div className="shell-name ellipsis">{displayLabel}</div>
                </div>
            );
        }
    )
);

export const Input = React.memo(
    ({ decl, className, preview }: { decl: HeaderInput; className: string; preview: boolean }) => {
        const { value, ref, isDisabled, onChange, onKeyDown, onFocus, onBlur } = decl;
        return (
            <div className="input-wrapper">
                <input
                    ref={
                        !preview
                            ? ref
                            : undefined /* don't wire up the input field if the preview block is being rendered */
                    }
                    disabled={isDisabled}
                    className={className}
                    value={value}
                    onChange={(e) => onChange(e)}
                    onKeyDown={(e) => onKeyDown(e)}
                    onFocus={(e) => onFocus(e)}
                    onBlur={(e) => onBlur(e)}
                    onDragStart={(e) => e.preventDefault()}
                />
            </div>
        );
    }
);

export const OptMagnifyButton = React.memo(
    ({ magnified, toggleMagnify, disabled }: { magnified: boolean; toggleMagnify: () => void; disabled: boolean }) => {
        const magnifyDecl: IconButtonDecl = {
            elemtype: "iconbutton",
            icon: <MagnifyIcon enabled={magnified} />,
            title: magnified ? "Minimize" : "Magnify",
            click: toggleMagnify,
            disabled,
        };
        return <IconButton key="magnify" decl={magnifyDecl} className="block-frame-magnify" />;
    }
);

export const HeaderTextElem = React.memo(({ elem, preview }: { elem: HeaderElem; preview: boolean }) => {
    if (elem.elemtype == "iconbutton") {
        return <IconButton decl={elem} className={clsx("block-frame-header-iconbutton", elem.className)} />;
    } else if (elem.elemtype == "toggleiconbutton") {
        return <ToggleIconButton decl={elem} className={clsx("block-frame-header-iconbutton", elem.className)} />;
    } else if (elem.elemtype == "input") {
        return <Input decl={elem} className={clsx("block-frame-input", elem.className)} preview={preview} />;
    } else if (elem.elemtype == "text") {
        return (
            <div className={clsx("block-frame-text ellipsis", elem.className, { "flex-nogrow": elem.noGrow })}>
                <span ref={preview ? null : elem.ref} onClick={(e) => elem?.onClick(e)}>
                    &lrm;{elem.text}
                </span>
            </div>
        );
    } else if (elem.elemtype == "textbutton") {
        return (
            <Button className={elem.className} onClick={(e) => elem.onClick(e)} title={elem.title}>
                {elem.text}
            </Button>
        );
    } else if (elem.elemtype == "div") {
        return (
            <div
                className={clsx("block-frame-div", elem.className)}
                onMouseOver={elem.onMouseOver}
                onMouseOut={elem.onMouseOut}
            >
                {elem.children.map((child, childIdx) => (
                    <HeaderTextElem elem={child} key={childIdx} preview={preview} />
                ))}
            </div>
        );
    } else if (elem.elemtype == "menubutton") {
        return <MenuButton className="block-frame-menubutton" {...(elem as MenuButtonProps)} />;
    }
    return null;
});

export function renderHeaderElements(headerTextUnion: HeaderElem[], preview: boolean): React.ReactElement[] {
    const headerTextElems: React.ReactElement[] = [];
    for (let idx = 0; idx < headerTextUnion.length; idx++) {
        const elem = headerTextUnion[idx];
        const renderedElement = <HeaderTextElem elem={elem} key={idx} preview={preview} />;
        if (renderedElement) {
            headerTextElems.push(renderedElement);
        }
    }
    return headerTextElems;
}

export function computeConnColorNum(connStatus: ConnStatus): number {
    const connColorNum = (connStatus?.activeconnnum ?? 1) % NumActiveConnColors;
    if (connColorNum == 0) {
        return NumActiveConnColors;
    }
    return connColorNum;
}
