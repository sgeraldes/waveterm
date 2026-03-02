// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { AIPanel } from "@/app/aipanel/aipanel";
import { ErrorBoundary } from "@/app/element/errorboundary";
import { CenteredDiv } from "@/app/element/quickelems";
import { ModalsRenderer } from "@/app/modals/modalsrenderer";
import { TabBar } from "@/app/tab/tabbar";
import { TabContent } from "@/app/tab/tabcontent";
import { Widgets } from "@/app/workspace/widgets";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { ObjectService } from "@/app/store/services";
import { ContextMenuModel } from "@/app/store/contextmenu";
import { getTabModelByTabId } from "@/app/store/tab-model";
import { LoadingSpinner } from "@/app/element/spinner";
import { atoms, createBlock, getApi } from "@/store/global";
import * as WOS from "@/store/wos";
import { fireAndForget } from "@/util/util";
import { useAtomValue } from "jotai";
import React, { memo, useEffect, useMemo, useRef } from "react";
import {
    ImperativePanelGroupHandle,
    ImperativePanelHandle,
    Panel,
    PanelGroup,
    PanelResizeHandle,
} from "react-resizable-panels";
import "./workspace.scss";

/**
 * Formats a file path as breadcrumb segments.
 * Handles both Unix and Windows paths.
 *
 * @param path - Absolute file path
 * @returns Array of path segments for breadcrumb display
 *
 * @example
 * formatPathAsSegments("/home/user/projects") // ["", "home", "user", "projects"] (leading "" = root)
 * formatPathAsSegments("G:\\Code\\waveterm") // ["G:", "Code", "waveterm"]
 */
function formatPathAsSegments(path: string): string[] {
    if (!path) return [];
    return path.split(/[\/\\]/);
}

/**
 * Reconstructs the path up to and including the segment at `segmentIndex`.
 *
 * @param fullPath - The full base directory path
 * @param segments - The segments array from formatPathAsSegments
 * @param segmentIndex - Index into segments to navigate to
 */
function getPathAtSegment(fullPath: string, segments: string[], segmentIndex: number): string {
    if (!fullPath || segments.length === 0) return fullPath;

    const isUnixAbsolute = segments[0] === "" && segments.length > 1;
    const isUncPath = fullPath.startsWith("\\\\") || fullPath.startsWith("//");

    const selected = segments.slice(0, segmentIndex + 1);

    if (isUncPath) {
        // UNC: \\server\share\dir -> join non-empty with backslash, prepend \\
        return "\\\\" + selected.filter((s) => s.length > 0).join("\\");
    } else if (isUnixAbsolute) {
        // Unix absolute: /home/user -> prepend /
        return "/" + selected.filter((s) => s.length > 0).join("/");
    } else {
        // Windows drive: G:\Code\waveterm -> G:\Code
        const parts = selected.filter((s) => s.length > 0);
        const result = parts.join("\\");
        // Drive root needs trailing backslash: "G:" -> "G:\"
        return parts.length === 1 && /^[a-zA-Z]:$/.test(parts[0]) ? result + "\\" : result;
    }
}

/**
 * Breadcrumb bar showing the active tab's base directory with app menu button.
 * Positioned below the tab bar and spans full window width.
 * Clicking a segment opens a file preview at that path.
 */
const TabBreadcrumb = memo(() => {
    const tabId = useAtomValue(atoms.staticTabId);
    const ws = useAtomValue(atoms.workspace);
    const tabAtom = useMemo(() => WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", tabId)), [tabId]);
    const tabData = useAtomValue(tabAtom);
    const tabModel = useMemo(() => getTabModelByTabId(tabId), [tabId]);
    const validationState = useAtomValue(tabModel.basedirValidationAtom);

    if (!tabId) return null;

    const baseDir = tabData?.meta?.["tab:basedir"];
    const isLocked = tabData?.meta?.["tab:basedirlock"] ?? false;
    const segments = baseDir ? formatPathAsSegments(baseDir) : [];
    // Filter out empty segments for display but keep track of their indices for reconstruction
    const displaySegments = segments.reduce<{ label: string; idx: number }[]>((acc, seg, i) => {
        if (seg.length > 0) acc.push({ label: seg, idx: i });
        return acc;
    }, []);

    const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        const menu: ContextMenuItem[] = [
            {
                label: "Set Base Directory...",
                click: () => {
                    fireAndForget(async () => {
                        const newDir = await getApi().showOpenDialog({
                            title: "Set Tab Base Directory",
                            defaultPath: baseDir || "~",
                            properties: ["openDirectory"],
                        });
                        if (newDir && newDir.length > 0 && newDir[0] !== "~") {
                            await ObjectService.UpdateObjectMeta(WOS.makeORef("tab", tabId), {
                                "tab:basedir": newDir[0],
                            });
                        }
                    });
                },
            },
            {
                label: "Clear Base Directory",
                enabled: !!baseDir,
                click: () => {
                    fireAndForget(async () => {
                        await ObjectService.UpdateObjectMeta(WOS.makeORef("tab", tabId), {
                            "tab:basedir": null,
                            "tab:basedirlock": null,
                        });
                    });
                },
            },
        ];
        if (baseDir) {
            menu.push({ type: "separator" });
            menu.push({
                label: "Open in File Manager",
                click: () => {
                    getApi().openExternal(`file://${baseDir}`);
                },
            });
        }
        ContextMenuModel.showContextMenu(menu, e);
    };

    const handleSegmentClick = (segIdx: number) => {
        if (!baseDir) return;
        const targetPath = getPathAtSegment(baseDir, segments, segIdx);
        fireAndForget(() => createBlock({ meta: { view: "preview", file: targetPath } }));
    };

    const handleLockToggle = () => {
        if (!tabId) return;
        fireAndForget(async () => {
            await ObjectService.UpdateObjectMeta(WOS.makeORef("tab", tabId), {
                "tab:basedirlock": !isLocked,
            });
        });
    };

    return (
        <div className="tab-breadcrumb">
            <div className="breadcrumb-content">
                {displaySegments.map(({ label, idx }, displayIdx) => (
                    <React.Fragment key={idx}>
                        {displayIdx > 0 && <span className="separator">›</span>}
                        <span className="segment" onClick={() => handleSegmentClick(idx)}>
                            {label}
                        </span>
                    </React.Fragment>
                ))}
                {baseDir && validationState === "pending" && (
                    <LoadingSpinner size="small" className="basedir-validation-spinner" />
                )}
                {baseDir && validationState === "invalid" && (
                    <i
                        className="fa fa-triangle-exclamation basedir-validation-error"
                        title="Base directory is no longer accessible"
                    />
                )}
            </div>
            <div className="breadcrumb-actions">
                {baseDir && (
                    <button
                        type="button"
                        className="menu-button"
                        onClick={handleLockToggle}
                        title={isLocked ? "Unlock: allow smart directory detection" : "Lock: prevent auto directory update"}
                        aria-label={isLocked ? "Unlock base directory" : "Lock base directory"}
                    >
                        <i className={isLocked ? "fa fa-lock" : "fa fa-lock-open"} />
                    </button>
                )}
                <button
                    type="button"
                    className="menu-button"
                    onClick={handleMenuClick}
                    title="Menu"
                    aria-label="Open workspace menu"
                >
                    <i className="fa fa-ellipsis" />
                </button>
            </div>
        </div>
    );
});

TabBreadcrumb.displayName = "TabBreadcrumb";

const WorkspaceElem = memo(() => {
    const workspaceLayoutModel = WorkspaceLayoutModel.getInstance();
    const tabId = useAtomValue(atoms.staticTabId);
    const ws = useAtomValue(atoms.workspace);
    const initialAiPanelPercentage = workspaceLayoutModel.getAIPanelPercentage(window.innerWidth);
    const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);
    const aiPanelRef = useRef<ImperativePanelHandle>(null);
    const panelContainerRef = useRef<HTMLDivElement>(null);
    const aiPanelWrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (aiPanelRef.current && panelGroupRef.current && panelContainerRef.current && aiPanelWrapperRef.current) {
            workspaceLayoutModel.registerRefs(
                aiPanelRef.current,
                panelGroupRef.current,
                panelContainerRef.current,
                aiPanelWrapperRef.current
            );
        }
    }, []);

    useEffect(() => {
        const isVisible = workspaceLayoutModel.getAIPanelVisible();
        getApi().setWaveAIOpen(isVisible);
    }, []);

    useEffect(() => {
        window.addEventListener("resize", workspaceLayoutModel.handleWindowResize);
        return () => window.removeEventListener("resize", workspaceLayoutModel.handleWindowResize);
    }, []);

    return (
        <div className="flex flex-col w-full flex-grow overflow-hidden">
            <TabBar key={ws.oid} workspace={ws} />
            <TabBreadcrumb />
            <div ref={panelContainerRef} className="flex flex-row flex-grow overflow-hidden">
                <ErrorBoundary key={tabId}>
                    <PanelGroup
                        direction="horizontal"
                        onLayout={workspaceLayoutModel.handlePanelLayout}
                        ref={panelGroupRef}
                    >
                        <Panel
                            ref={aiPanelRef}
                            collapsible
                            defaultSize={initialAiPanelPercentage}
                            order={1}
                            className="overflow-hidden"
                        >
                            <div ref={aiPanelWrapperRef} className="w-full h-full">
                                {tabId !== "" && <AIPanel />}
                            </div>
                        </Panel>
                        <PanelResizeHandle className="w-0.5 bg-transparent hover:bg-zinc-500/20 transition-colors" />
                        <Panel order={2} defaultSize={100 - initialAiPanelPercentage}>
                            {tabId === "" ? (
                                <CenteredDiv>No Active Tab</CenteredDiv>
                            ) : (
                                <div className="flex flex-row h-full">
                                    <TabContent key={tabId} tabId={tabId} />
                                    <Widgets />
                                </div>
                            )}
                        </Panel>
                    </PanelGroup>
                    <ModalsRenderer />
                </ErrorBoundary>
            </div>
        </div>
    );
});

WorkspaceElem.displayName = "WorkspaceElem";

export { WorkspaceElem as Workspace };
