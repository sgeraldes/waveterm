import { atoms, getApi, setActiveTab } from "@/app/store/global";
import { WorkspaceService } from "@/app/store/services";
import { makeORef, useWaveObjectValue } from "@/app/store/wos";
import { waveEventSubscribe } from "@/app/store/wps";
import { WorkspaceEditor } from "@/app/tab/workspaceeditor";
import { fireAndForget, makeIconClass, useAtomValueSafe } from "@/util/util";
import clsx from "clsx";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

type WorkspaceListEntry = { windowId: string; workspace: Workspace };

interface WorkspacesWithTabsProps {
    currentTabIds: string[];
    searchQuery: string;
    onCloseTab: (tabId: string) => void;
    onDismissPanel: () => void;
    isWorkspaceSaved: boolean;
}

/** Tab row rendered inside a workspace. */
const WorkspaceTabItem = memo(
    ({
        tabId,
        isActive,
        searchQuery,
        onClose,
        onDismissPanel,
    }: {
        tabId: string;
        isActive: boolean;
        searchQuery: string;
        onClose: (tabId: string) => void;
        onDismissPanel: () => void;
    }) => {
        const [tabData] = useWaveObjectValue<Tab>(makeORef("tab", tabId));
        const tabName = tabData?.name || "Tab";
        const tabColor = tabData?.meta?.["tab:color"];
        const tabIcon = tabData?.meta?.["tab:icon"];

        const isVisible = useMemo(() => {
            if (!searchQuery) return true;
            return tabName.toLowerCase().includes(searchQuery.toLowerCase());
        }, [tabName, searchQuery]);

        const handleClick = useCallback(() => {
            setActiveTab(tabId);
            onDismissPanel();
        }, [tabId, onDismissPanel]);

        const handleClose = useCallback(
            (e: React.MouseEvent) => {
                e.stopPropagation();
                onClose(tabId);
            },
            [tabId, onClose]
        );

        if (!isVisible) return null;

        return (
            <div className={clsx("tab-management-item", { active: isActive })} onClick={handleClick}>
                {tabIcon && <i className={`fa fa-${tabIcon} tab-item-icon`} />}
                {tabColor && <div className="tab-color-dot" style={{ backgroundColor: tabColor }} />}
                <span className="tab-item-name">{tabName}</span>
                {isActive && <i className="fa fa-check tab-active-check" />}
                <button className="tab-item-close" onClick={handleClose} title="Close tab">
                    <i className="fa fa-xmark" />
                </button>
            </div>
        );
    }
);
WorkspaceTabItem.displayName = "WorkspaceTabItem";

/** Main workspace-centric view: workspaces with their tabs nested inside. */
export const WorkspacesWithTabs = memo(
    ({ currentTabIds, searchQuery, onCloseTab, onDismissPanel, isWorkspaceSaved }: WorkspacesWithTabsProps) => {
        const activeWorkspace = useAtomValueSafe(atoms.workspace);
        const activeTabId = useAtomValueSafe(atoms.staticTabId);
        const [workspaceList, setWorkspaceList] = useState<WorkspaceListEntry[]>([]);
        const [expandedId, setExpandedId] = useState<string | null>(null);
        const [editingId, setEditingId] = useState<string | null>(null);

        useEffect(() => {
            if (activeWorkspace?.oid) setExpandedId(activeWorkspace.oid);
        }, [activeWorkspace?.oid]);

        const updateWorkspaceList = useCallback(async () => {
            const entries = await WorkspaceService.ListWorkspaces();
            if (!entries) return;
            const list: WorkspaceListEntry[] = [];
            for (const entry of entries) {
                const ws = await WorkspaceService.GetWorkspace(entry.workspaceid);
                list.push({ windowId: entry.windowid, workspace: ws });
            }
            setWorkspaceList(list);
        }, []);

        useEffect(() => {
            fireAndForget(updateWorkspaceList);
        }, []);

        useEffect(
            () =>
                waveEventSubscribe({
                    eventType: "workspace:update",
                    handler: () => fireAndForget(updateWorkspaceList),
                }),
            []
        );

        const handleUpdateWorkspace = useCallback(
            (entry: WorkspaceListEntry, updates: Partial<Pick<Workspace, "name" | "icon" | "color">>) => {
                const updated = { ...entry.workspace, ...updates };
                setWorkspaceList((prev) =>
                    prev.map((e) => (e.workspace.oid === entry.workspace.oid ? { ...e, workspace: updated } : e))
                );
                if (updated.name !== "") {
                    fireAndForget(() =>
                        WorkspaceService.UpdateWorkspace(
                            entry.workspace.oid,
                            updated.name ?? "",
                            updated.icon ?? "",
                            updated.color ?? "",
                            false
                        )
                    );
                }
            },
            []
        );

        const handleSaveWorkspace = useCallback(() => {
            if (!activeWorkspace) return;
            fireAndForget(async () => {
                await WorkspaceService.UpdateWorkspace(activeWorkspace.oid, "", "", "", true);
                await updateWorkspaceList();
                setEditingId(activeWorkspace.oid);
            });
        }, [activeWorkspace, updateWorkspaceList]);

        const filteredList = useMemo(() => {
            if (!searchQuery) return workspaceList;
            const q = searchQuery.toLowerCase();
            return workspaceList.filter((e) => e.workspace.name?.toLowerCase().includes(q));
        }, [workspaceList, searchQuery]);

        return (
            <div className="workspaces-section">
                {filteredList.map((entry) => {
                    const ws = entry.workspace;
                    const isCurrent = activeWorkspace?.oid === ws.oid;
                    const isExpanded = expandedId === ws.oid;
                    const isEditing = editingId === ws.oid;
                    const tabIds = isCurrent ? currentTabIds : (ws.tabids ?? []);

                    return (
                        <div key={ws.oid} className={clsx("workspace-item", { active: isCurrent })}>
                            <div
                                className="workspace-item-row"
                                onClick={() => {
                                    if (!isCurrent) getApi().switchWorkspace(ws.oid);
                                    setExpandedId(isExpanded ? null : ws.oid);
                                }}
                            >
                                <div className="workspace-item-left">
                                    <i
                                        className={clsx("workspace-item-icon", makeIconClass(ws.icon, true))}
                                        style={{ color: ws.color }}
                                    />
                                    <span className="workspace-item-name">{ws.name || "Untitled"}</span>
                                    <span className="workspace-tab-count">({tabIds.length})</span>
                                </div>
                                <div className="workspace-item-right">
                                    {isCurrent && <i className="fa fa-check workspace-current-check" />}
                                    {!!entry.windowId && !isCurrent && (
                                        <i
                                            className="fa fa-window-maximize workspace-open-indicator"
                                            title="Open in another window"
                                        />
                                    )}
                                    <button
                                        className="workspace-edit-btn"
                                        title="Edit workspace"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingId(isEditing ? null : ws.oid);
                                        }}
                                    >
                                        <i className="fa fa-pencil" />
                                    </button>
                                </div>
                            </div>
                            {isEditing && (
                                <WorkspaceEditor
                                    title={ws.name ?? ""}
                                    icon={ws.icon ?? ""}
                                    color={ws.color ?? ""}
                                    focusInput={isEditing}
                                    onTitleChange={(title) => handleUpdateWorkspace(entry, { name: title })}
                                    onColorChange={(color) => handleUpdateWorkspace(entry, { color })}
                                    onIconChange={(icon) => handleUpdateWorkspace(entry, { icon })}
                                    onDeleteWorkspace={() => getApi().deleteWorkspace(ws.oid)}
                                />
                            )}
                            {isExpanded && isCurrent && (
                                <div className="workspace-tabs">
                                    {tabIds.map((tabId) => (
                                        <WorkspaceTabItem
                                            key={tabId}
                                            tabId={tabId}
                                            isActive={tabId === activeTabId}
                                            searchQuery={searchQuery}
                                            onClose={onCloseTab}
                                            onDismissPanel={onDismissPanel}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
                {!isWorkspaceSaved && (
                    <div className="workspace-actions">
                        <button className="workspace-action-btn" onClick={handleSaveWorkspace}>
                            <i className="fa fa-floppy-disk" />
                            <span>Save current workspace</span>
                        </button>
                    </div>
                )}
            </div>
        );
    }
);
WorkspacesWithTabs.displayName = "WorkspacesWithTabs";
