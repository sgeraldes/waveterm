import { Popover, PopoverButton, PopoverContent } from "@/element/popover";
import { atoms, setActiveTab } from "@/store/global";
import { makeORef, useWaveObjectValue } from "@/store/wos";
import { useAtomValue } from "jotai";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { memo } from "react";
import "./tablistdropdown.scss";

interface TabListDropdownProps {
    tabIds: string[];
}

const TabListDropdown = memo(({ tabIds }: TabListDropdownProps) => {
    const activeTabId = useAtomValue(atoms.staticTabId);

    const handleTabClick = (tabId: string) => {
        setActiveTab(tabId);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    };

    if (tabIds.length < 2) {
        return null;
    }

    return (
        <Popover className="tab-list-dropdown-popover" placement="bottom-end">
            <PopoverButton className="tab-list-dropdown-button" as="button" title="All Tabs" aria-label="Show all tabs">
                <i className="fa fa-caret-down" />
            </PopoverButton>
            <PopoverContent className="tab-list-dropdown-content">
                <div className="title">All Tabs</div>
                <OverlayScrollbarsComponent className="scrollable" options={{ scrollbars: { autoHide: "leave" } }}>
                    <div className="tab-list">
                        {tabIds.map((tabId) => (
                            <TabListItem
                                key={tabId}
                                tabId={tabId}
                                isActive={tabId === activeTabId}
                                onClick={() => handleTabClick(tabId)}
                            />
                        ))}
                    </div>
                </OverlayScrollbarsComponent>
            </PopoverContent>
        </Popover>
    );
});

TabListDropdown.displayName = "TabListDropdown";

interface TabListItemProps {
    tabId: string;
    isActive: boolean;
    onClick: () => void;
}

const TabListItem = memo(({ tabId, isActive, onClick }: TabListItemProps) => {
    const [tabData] = useWaveObjectValue<Tab>(makeORef("tab", tabId));
    const tabColor = tabData?.meta?.["tab:color"];

    return (
        <div className={`tab-list-item ${isActive ? "active" : ""}`} onClick={onClick}>
            <div className="tab-item-content">
                {tabColor && <div className="tab-color-indicator" style={{ backgroundColor: tabColor }}></div>}
                <div className="tab-name">{tabData?.name || "Tab"}</div>
                {isActive && (
                    <div className="tab-active-indicator">
                        <i className="fa fa-check" />
                    </div>
                )}
            </div>
        </div>
    );
});

TabListItem.displayName = "TabListItem";

export { TabListDropdown };
