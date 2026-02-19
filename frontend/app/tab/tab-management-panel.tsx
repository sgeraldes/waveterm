import { recentlyClosedTabsAtom } from "@/app/store/recently-closed";
import { FloatingPortal, flip, offset, shift, useDismiss, useFloating, useInteractions } from "@floating-ui/react";
import { atom, useAtom, useAtomValue } from "jotai";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { atoms, getApi } from "../store/global";
import { CollapsibleSection } from "./collapsible-section";
import { FavoritesSection } from "./sections/favorites-section";
import { RecentlyClosedSection } from "./sections/recently-closed-section";
import { TabGroupsSection } from "./sections/tab-groups-section";
import { WorkspacesWithTabs } from "./sections/workspaces-section";
import "./tab-management-panel.scss";

export const tabManagementPanelOpenAtom = atom(false);

interface TabManagementPanelProps {
    anchorRef: React.RefObject<HTMLElement>;
    tabIds: string[];
    onCloseTab: (tabId: string) => void;
}

export const TabManagementPanel = memo(({ anchorRef, tabIds, onCloseTab }: TabManagementPanelProps) => {
    const [isOpen, setIsOpen] = useAtom(tabManagementPanelOpenAtom);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const recentlyClosed = useAtomValue(recentlyClosedTabsAtom);
    const workspace = useAtomValue(atoms.workspace);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: "bottom-start",
        middleware: [offset(4), flip(), shift()],
        elements: { reference: anchorRef.current },
    });

    const dismiss = useDismiss(context);
    const { getFloatingProps } = useInteractions([dismiss]);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery("");
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === "T") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [setIsOpen]);

    const handleDismissPanel = useCallback(() => setIsOpen(false), [setIsOpen]);
    const handleCloseTab = useCallback((tabId: string) => onCloseTab(tabId), [onCloseTab]);
    const handleNewTab = useCallback(() => getApi().createTab(), []);
    const handleNewWorkspace = useCallback(() => getApi().createWorkspace(), []);

    if (!isOpen) return null;

    const isWorkspaceSaved = !!(workspace?.name && workspace?.icon);

    return (
        <FloatingPortal>
            <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()} className="tab-management-panel">
                <div className="panel-toolbar">
                    <button className="toolbar-btn" onClick={handleNewWorkspace} title="New workspace">
                        <i className="fa fa-layer-group" />
                        <span>New Workspace</span>
                    </button>
                    <button className="toolbar-btn" onClick={handleNewTab} title="New tab">
                        <i className="fa fa-window-maximize" />
                        <span>New Tab</span>
                    </button>
                    <div className="toolbar-spacer" />
                    <span className="toolbar-shortcut">Ctrl+Shift+T</span>
                </div>
                <div className="panel-search">
                    <i className="fa fa-search search-icon" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search tabs & workspaces..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <OverlayScrollbarsComponent className="panel-scroll" options={{ scrollbars: { autoHide: "leave" } }}>
                    <WorkspacesWithTabs
                        currentTabIds={tabIds}
                        searchQuery={searchQuery}
                        onCloseTab={handleCloseTab}
                        onDismissPanel={handleDismissPanel}
                        isWorkspaceSaved={isWorkspaceSaved}
                    />
                    <CollapsibleSection title="Recently Closed" count={recentlyClosed.length} defaultExpanded={false}>
                        <RecentlyClosedSection searchQuery={searchQuery} onDismissPanel={handleDismissPanel} />
                    </CollapsibleSection>
                    <CollapsibleSection title="Tab Groups" defaultExpanded={false}>
                        <TabGroupsSection
                            tabIds={tabIds}
                            searchQuery={searchQuery}
                            onDismissPanel={handleDismissPanel}
                        />
                    </CollapsibleSection>
                    <CollapsibleSection title="Favorites" defaultExpanded={false}>
                        <FavoritesSection
                            tabIds={tabIds}
                            searchQuery={searchQuery}
                            onDismissPanel={handleDismissPanel}
                        />
                    </CollapsibleSection>
                </OverlayScrollbarsComponent>
            </div>
        </FloatingPortal>
    );
});
TabManagementPanel.displayName = "TabManagementPanel";
