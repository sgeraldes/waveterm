import { atoms, globalStore, setActiveTab } from "@/app/store/global";
import { ObjectService } from "@/app/store/services";
import { makeORef, useWaveObjectValue } from "@/app/store/wos";
import { fireAndForget } from "@/util/util";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

const TAB_COLORS = [
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Yellow", value: "#eab308" },
    { name: "Green", value: "#22c55e" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Purple", value: "#a855f7" },
    { name: "Pink", value: "#ec4899" },
];

interface TabGroupsSectionProps {
    tabIds: string[];
    searchQuery: string;
    onDismissPanel: () => void;
}

interface GroupInfo {
    name: string;
    color: string;
    tabIds: string[];
    tabNames: string[];
}

/** Reads a single tab and reports its data to the parent via callback. */
const TabDataReader = memo(
    ({ tabId, onTabData }: { tabId: string; onTabData: (tabId: string, tab: Tab | null) => void }) => {
        const [tabData] = useWaveObjectValue<Tab>(makeORef("tab", tabId));
        useEffect(() => {
            onTabData(tabId, tabData ?? null);
        }, [tabId, tabData, onTabData]);
        return null;
    }
);
TabDataReader.displayName = "TabDataReader";

export const TabGroupsSection = memo(({ tabIds, searchQuery, onDismissPanel }: TabGroupsSectionProps) => {
    const [tabDataMap, setTabDataMap] = useState<Map<string, Tab>>(new Map());
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [newGroupColor, setNewGroupColor] = useState(TAB_COLORS[0].value);

    const handleTabData = useCallback((tabId: string, tab: Tab | null) => {
        setTabDataMap((prev) => {
            if (tab == null) {
                if (!prev.has(tabId)) return prev;
                const next = new Map(prev);
                next.delete(tabId);
                return next;
            }
            const existing = prev.get(tabId);
            if (existing === tab) return prev;
            const next = new Map(prev);
            next.set(tabId, tab);
            return next;
        });
    }, []);

    const groups = useMemo(() => {
        const groupMap = new Map<string, GroupInfo>();
        for (const [tabId, tab] of tabDataMap) {
            const groupName = tab.meta?.["tab:group"];
            if (!groupName) continue;
            let group = groupMap.get(groupName);
            if (!group) {
                group = {
                    name: groupName,
                    color: tab.meta?.["tab:groupcolor"] ?? TAB_COLORS[0].value,
                    tabIds: [],
                    tabNames: [],
                };
                groupMap.set(groupName, group);
            }
            group.tabIds.push(tabId);
            group.tabNames.push(tab.name || "Untitled");
        }
        const allGroups = Array.from(groupMap.values());
        if (!searchQuery) return allGroups;
        const lowerQuery = searchQuery.toLowerCase();
        return allGroups.filter((g) => g.name.toLowerCase().includes(lowerQuery));
    }, [tabDataMap, searchQuery]);

    const handleCreateGroup = useCallback(() => {
        const name = newGroupName.trim();
        if (!name) return;
        const activeTabId = globalStore.get(atoms.staticTabId);
        if (!activeTabId) return;
        fireAndForget(() =>
            ObjectService.UpdateObjectMeta(makeORef("tab", activeTabId), {
                "tab:group": name,
                "tab:groupcolor": newGroupColor,
            })
        );
        setNewGroupName("");
        setNewGroupColor(TAB_COLORS[0].value);
        setShowCreateForm(false);
    }, [newGroupName, newGroupColor]);

    const handleDeleteGroup = useCallback(
        (group: GroupInfo) => {
            if (expandedGroup === group.name) setExpandedGroup(null);
            fireAndForget(async () => {
                await Promise.all(
                    group.tabIds.map((tabId) =>
                        ObjectService.UpdateObjectMeta(makeORef("tab", tabId), {
                            "tab:group": null,
                            "tab:groupcolor": null,
                        })
                    )
                );
            });
        },
        [expandedGroup]
    );

    const handleTabClick = useCallback(
        (tabId: string) => {
            setActiveTab(tabId);
            onDismissPanel();
        },
        [onDismissPanel]
    );

    return (
        <div className="tab-groups-section">
            {tabIds.map((id) => (
                <TabDataReader key={id} tabId={id} onTabData={handleTabData} />
            ))}
            {groups.map((group) => (
                <div key={group.name} className="group-item">
                    <div
                        className="group-header"
                        onClick={() => setExpandedGroup(expandedGroup === group.name ? null : group.name)}
                    >
                        <span className="group-color-dot" style={{ backgroundColor: group.color }} />
                        <span className="group-name">{group.name}</span>
                        <span className="group-count">({group.tabIds.length})</span>
                        <button
                            className="group-action-btn"
                            title="Delete group"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteGroup(group);
                            }}
                        >
                            <i className="fa fa-trash" />
                        </button>
                    </div>
                    {expandedGroup === group.name && (
                        <div className="group-members">
                            {group.tabIds.map((tabId, idx) => (
                                <div key={tabId} className="group-member" onClick={() => handleTabClick(tabId)}>
                                    {group.tabNames[idx]}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {groups.length === 0 && !showCreateForm && (
                <div className="placeholder">
                    {searchQuery ? "No matching groups" : "No tab groups"}
                </div>
            )}
            {showCreateForm ? (
                <div className="create-group-form">
                    <input
                        type="text"
                        className="group-name-input"
                        placeholder="Group name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateGroup();
                            if (e.key === "Escape") setShowCreateForm(false);
                        }}
                        autoFocus
                    />
                    <div className="color-picker">
                        {TAB_COLORS.map((c) => (
                            <button
                                key={c.value}
                                className={`color-dot ${newGroupColor === c.value ? "selected" : ""}`}
                                style={{ backgroundColor: c.value }}
                                title={c.name}
                                onClick={() => setNewGroupColor(c.value)}
                            />
                        ))}
                    </div>
                    <div className="form-actions">
                        <button className="action-btn" onClick={handleCreateGroup}>
                            Create
                        </button>
                        <button className="action-btn cancel" onClick={() => setShowCreateForm(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button className="add-group-btn" onClick={() => setShowCreateForm(true)}>
                    <i className="fa fa-plus" /> New Group
                </button>
            )}
        </div>
    );
});
TabGroupsSection.displayName = "TabGroupsSection";
