// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { atoms, recordTEvent } from "@/app/store/global";
import { Button } from "@/app/element/button";
import { IconButton, ToggleIconButton } from "@/element/iconbutton";
import { MagnifyIcon } from "@/element/magnify";
import { MenuButton } from "@/element/menubutton";
import * as util from "@/util/util";
import clsx from "clsx";
import * as jotai from "jotai";
import * as React from "react";

/**
 * Gets a user-friendly display name for a connection.
 * - WSL: "wsl://Ubuntu" → "Ubuntu"
 * - Git Bash: "local:gitbash" → "Git Bash"
 * - Shell profiles: "cmd" → "CMD", "pwsh-7.5" → "PowerShell 7.5"
 * - Connections with display:name in config → use that
 */
function getConnectionDisplayName(
    connection: string,
    connectionsConfig?: Record<string, ConnKeywords>
): { displayName: string | null; icon: string; isWsl: boolean } {
    if (util.isBlank(connection)) {
        return { displayName: null, icon: "laptop", isWsl: false };
    }

    // WSL connections: wsl://DistroName → DistroName
    if (connection.startsWith("wsl://")) {
        const distroName = connection.substring(6); // Remove "wsl://"
        return { displayName: distroName, icon: "brands@linux", isWsl: true };
    }

    // Git Bash special case
    if (connection === "local:gitbash") {
        return { displayName: "Git Bash", icon: "brands@git-alt", isWsl: false };
    }

    // Other local:* patterns
    if (connection.startsWith("local:")) {
        const profileName = connection.substring(6); // Remove "local:"
        // Check if there's a display name in config
        if (connectionsConfig?.[connection]?.["display:name"]) {
            return { displayName: connectionsConfig[connection]["display:name"], icon: "terminal", isWsl: false };
        }
        // Format the profile name nicely
        return { displayName: formatShellName(profileName), icon: "terminal", isWsl: false };
    }

    // Plain "local" - no display name needed
    if (connection === "local") {
        return { displayName: null, icon: "laptop", isWsl: false };
    }

    // Check connections config for shell profiles (e.g., "cmd", "pwsh-7.5")
    if (connectionsConfig?.[connection]) {
        const connSettings = connectionsConfig[connection];
        // Check if it's a local shell profile
        const isLocalProfile =
            connSettings["conn:local"] === true ||
            (connSettings["conn:shellpath"] && !connSettings["ssh:hostname"]);

        if (isLocalProfile) {
            if (connSettings["display:name"]) {
                return { displayName: connSettings["display:name"], icon: "terminal", isWsl: false };
            }
            return { displayName: formatShellName(connection), icon: "terminal", isWsl: false };
        }
    }

    // Not a local connection - return null to indicate it's remote
    return { displayName: null, icon: "arrow-right-arrow-left", isWsl: false };
}

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
    let partsStack = [[]];
    while ((match = tagRegex.exec(titleString)) != null) {
        const lastPart = partsStack[partsStack.length - 1];
        const before = titleString.substring(lastIdx, match.index);
        lastPart.push(before);
        lastIdx = match.index + match[0].length;
        const [_, isClosing, tagName, tagParam] = match;
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
            let children = [];
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
            let children = [];
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
