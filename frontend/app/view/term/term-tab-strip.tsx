// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { resolveEffectiveDefaultShell } from "@/app/block/blockutil";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import type { TermViewModel } from "@/app/view/term/term-model";
import { atoms, globalStore, WOS } from "@/store/global";
import { fireAndForget } from "@/util/util";
import { makeIconClass } from "@/util/util";
import clsx from "clsx";
import * as jotai from "jotai";
import * as React from "react";
import "./term-tab-strip.scss";

interface TermTabProps {
    blockId: string; // the sub-block id (or parent block id for the primary session)
    isActive: boolean;
    isPrimary: boolean; // true if this is the parent block (session 0)
    parentBlockId: string;
    model: TermViewModel;
    onSwitch: (blockId: string | null) => void;
    onClose: (blockId: string) => void;
    canClose: boolean; // false when it's the only tab
}

const TermTab = React.memo(({ blockId, isActive, isPrimary, parentBlockId, model, onSwitch, onClose, canClose }: TermTabProps) => {
    const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", blockId));
    const fullConfig = jotai.useAtomValue(atoms.fullConfigAtom);
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    const tabName = blockData?.meta?.["term:tabname"] as string | undefined;
    const shellProfile = blockData?.meta?.["shell:profile"] || "";
    const defaultShell = resolveEffectiveDefaultShell(
        fullConfig?.settings?.["shell:profiles"],
        fullConfig?.settings?.["shell:default"] || ""
    );
    const effectiveShell = shellProfile || defaultShell;

    // Derive display name from shell or tabname
    let displayName: string;
    if (tabName) {
        displayName = tabName;
    } else if (effectiveShell.startsWith("wsl:")) {
        displayName = effectiveShell.substring(4);
    } else {
        const lowerId = effectiveShell.toLowerCase();
        if (lowerId === "pwsh" || lowerId === "powershell") {
            displayName = "pwsh";
        } else if (lowerId.startsWith("pwsh-")) {
            displayName = `pwsh ${effectiveShell.substring(5)}`;
        } else if (lowerId === "cmd") {
            displayName = "cmd";
        } else if (lowerId === "bash") {
            displayName = "bash";
        } else if (lowerId === "zsh") {
            displayName = "zsh";
        } else if (lowerId === "fish") {
            displayName = "fish";
        } else {
            displayName = effectiveShell || "shell";
        }
    }

    // Derive icon from shell
    let iconName: string;
    if (effectiveShell.startsWith("wsl:")) {
        iconName = "brands@linux";
    } else {
        const lowerId = effectiveShell.toLowerCase();
        if (lowerId === "cmd") {
            iconName = "brands@windows";
        } else if (lowerId.includes("pwsh") || lowerId.includes("powershell")) {
            iconName = "terminal";
        } else if (lowerId.includes("gitbash") || lowerId.includes("git-bash")) {
            iconName = "brands@git-alt";
        } else {
            iconName = "terminal";
        }
    }

    const handleDoubleClick = React.useCallback(() => {
        setEditValue(tabName || "");
        setIsEditing(true);
    }, [tabName]);

    React.useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const commitEdit = React.useCallback(() => {
        const trimmed = editValue.trim();
        fireAndForget(() =>
            RpcApi.SetMetaCommand(TabRpcClient, {
                oref: WOS.makeORef("block", blockId),
                meta: { "term:tabname": trimmed || null },
            })
        );
        setIsEditing(false);
    }, [blockId, editValue]);

    const handleKeyDown = React.useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
            } else if (e.key === "Escape") {
                e.preventDefault();
                setIsEditing(false);
            }
        },
        [commitEdit]
    );

    const handleClose = React.useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onClose(blockId);
        },
        [blockId, onClose]
    );

    const handleClick = React.useCallback(() => {
        if (!isActive) {
            onSwitch(isPrimary ? null : blockId);
        }
    }, [blockId, isActive, isPrimary, onSwitch]);

    return (
        <div
            className={clsx("term-tab", { "is-active": isActive })}
            role="tab"
            aria-selected={isActive}
            onClick={handleClick}
        >
            <i className={clsx(makeIconClass(iconName, false), "term-tab-icon")} aria-hidden="true" />
            {isEditing ? (
                <input
                    ref={inputRef}
                    className="term-tab-name-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={commitEdit}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Edit terminal tab name"
                />
            ) : (
                <span
                    className="term-tab-name"
                    onDoubleClick={handleDoubleClick}
                    title={displayName}
                >
                    {displayName}
                </span>
            )}
            {canClose && (
                <button
                    className="term-tab-close"
                    onClick={handleClose}
                    aria-label={`Close ${displayName}`}
                    title={`Close ${displayName}`}
                >
                    <i className={makeIconClass("xmark", false)} aria-hidden="true" />
                </button>
            )}
        </div>
    );
});
TermTab.displayName = "TermTab";

interface TermTabStripProps {
    model: TermViewModel;
}

export const TermTabStrip = React.memo(({ model }: TermTabStripProps) => {
    const subBlockIds = jotai.useAtomValue(model.subBlockIdsAtom);
    const activeTabId = jotai.useAtomValue(model.activeTabIdAtom);

    if (subBlockIds.length === 0) {
        return null;
    }

    // All tabs: primary session (null = parent block) + sub-blocks
    const allTabs = [null, ...subBlockIds];
    const canClose = allTabs.length > 1;

    const handleSwitch = React.useCallback(
        (blockId: string | null) => {
            model.switchToTab(blockId);
        },
        [model]
    );

    const handleClose = React.useCallback(
        (blockId: string) => {
            fireAndForget(() => model.closeTerminalTab(blockId));
        },
        [model]
    );

    const handleAddTab = React.useCallback(() => {
        fireAndForget(() => model.addTerminalTab());
    }, [model]);

    return (
        <div className="term-tab-strip" role="tablist" aria-label="Terminal sessions">
            <div className="term-tab-strip-tabs">
                {allTabs.map((tabId) => {
                    const isActive = tabId === activeTabId;
                    const isPrimary = tabId === null;
                    const blockId = isPrimary ? model.blockId : tabId;
                    return (
                        <TermTab
                            key={blockId}
                            blockId={blockId}
                            isActive={isActive}
                            isPrimary={isPrimary}
                            parentBlockId={model.blockId}
                            model={model}
                            onSwitch={handleSwitch}
                            onClose={handleClose}
                            canClose={canClose}
                        />
                    );
                })}
            </div>
            <button
                className="term-tab-add-btn"
                onClick={handleAddTab}
                title="New Terminal Tab (Ctrl+Shift+T)"
                aria-label="New terminal tab"
            >
                <i className={makeIconClass("plus", false)} aria-hidden="true" />
            </button>
        </div>
    );
});
TermTabStrip.displayName = "TermTabStrip";
