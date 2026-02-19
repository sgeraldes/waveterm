import { addRecentlyClosed } from "@/app/store/recently-closed";
import { cleanupOsc7DebounceForTab } from "@/app/view/term/termwrap";
import { deleteLayoutModelForTab } from "@/layout/index";
import { atoms, createTab, getApi, globalStore } from "@/store/global";
import * as WOS from "@/store/wos";
import { isMacOS, isWindows } from "@/util/platformutil";
import { makeIconClass } from "@/util/util";
import { useAtomValue } from "jotai";
import { OverlayScrollbars, PartialOptions } from "overlayscrollbars";
import { createRef, memo, useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "throttle-debounce";
import { IconButton } from "../element/iconbutton";
import { ConfigErrorIcon } from "./config-error";
import { Tab } from "./tab";
import { TabManagementPanel, tabManagementPanelOpenAtom } from "./tab-management-panel";
import "./tabbar.scss";
import { UpdateStatusBanner } from "./updatebanner";
import { strArrayIsEqual, useTabDrag } from "./use-tab-drag";
import { WaveAIButton } from "./wave-ai-button";

type DragRegionStyle = React.CSSProperties & { WebkitAppRegion: "drag" | "no-drag" };

const TabDefaultWidth = 130;
const TabMinWidth = 100;
const OSOptions: PartialOptions = {
    overflow: {
        x: "scroll",
        y: "hidden",
    },
    scrollbars: {
        theme: "os-theme-dark",
        visibility: "auto",
        autoHide: "leave",
        autoHideDelay: 1300,
        autoHideSuspend: false,
        dragScroll: true,
        clickScroll: false,
        pointers: ["mouse", "touch", "pen"],
    },
};

interface TabBarProps {
    workspace: Workspace;
}

const TabBar = memo(({ workspace }: TabBarProps) => {
    const [tabIds, setTabIds] = useState<string[]>([]);
    const [tabsLoaded, setTabsLoaded] = useState({});
    const [newTabId, setNewTabId] = useState<string | null>(null);
    const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
    const [canScrollRight, setCanScrollRight] = useState<boolean>(false);
    const [isScrollable, setIsScrollable] = useState<boolean>(false);

    const tabbarWrapperRef = useRef<HTMLDivElement>(null);
    const tabBarRef = useRef<HTMLDivElement>(null);
    const tabsWrapperRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<React.RefObject<HTMLDivElement>[]>([]);
    const addBtnRef = useRef<HTMLButtonElement>(null);
    const osInstanceRef = useRef<OverlayScrollbars>(null);
    const draggerLeftRef = useRef<HTMLDivElement>(null);
    const draggerRightRef = useRef<HTMLDivElement>(null);
    const tabManagementBtnRef = useRef<HTMLDivElement>(null);
    const tabWidthRef = useRef<number>(TabDefaultWidth);
    const scrollableRef = useRef<boolean>(false);
    const scrollLeftBtnRef = useRef<HTMLButtonElement>(null);
    const scrollRightBtnRef = useRef<HTMLButtonElement>(null);
    const updateStatusBannerRef = useRef<HTMLButtonElement>(null);
    const configErrorButtonRef = useRef<HTMLElement>(null);
    const prevAllLoadedRef = useRef<boolean>(false);
    const activeTabId = useAtomValue(atoms.staticTabId);
    const isFullScreen = useAtomValue(atoms.isFullScreen);
    const zoomFactor = useAtomValue(atoms.zoomFactorAtom);

    const { draggingTab, saveTabsPosition, saveTabsPositionDebounced, handleDragStart, handleSelectTab } = useTabDrag(
        tabIds,
        workspace?.oid,
        { tabRefs, tabBarRef, tabsWrapperRef, tabWidthRef, scrollableRef, osInstanceRef }
    );

    useEffect(() => {
        tabRefs.current = tabIds.map((_, index) => tabRefs.current[index] || createRef());
    }, [tabIds]);

    useEffect(() => {
        if (!workspace) return;
        const newTabIdsArr = workspace.tabids ?? [];
        if (!strArrayIsEqual(tabIds, newTabIdsArr)) {
            setTabIds(newTabIdsArr);
        }
    }, [workspace, tabIds]);

    const setSizeAndPosition = (animate?: boolean) => {
        const tabBar = tabBarRef.current;
        if (tabBar === null) return;

        const tabbarWrapperWidth = tabbarWrapperRef.current.getBoundingClientRect().width;
        const windowDragLeftWidth = draggerLeftRef.current.getBoundingClientRect().width;
        const windowDragRightWidth = draggerRightRef.current?.getBoundingClientRect().width ?? 0;
        const addBtnWidth = addBtnRef.current.getBoundingClientRect().width;
        const updateStatusLabelWidth = updateStatusBannerRef.current?.getBoundingClientRect().width ?? 0;
        const configErrorWidth = configErrorButtonRef.current?.getBoundingClientRect().width ?? 0;
        const tabManagementBtnWidth = tabManagementBtnRef.current?.getBoundingClientRect().width ?? 0;
        const scrollLeftBtnWidth = scrollLeftBtnRef.current?.getBoundingClientRect().width ?? 0;
        const scrollRightBtnWidth = scrollRightBtnRef.current?.getBoundingClientRect().width ?? 0;

        const nonTabElementsWidth =
            windowDragLeftWidth +
            windowDragRightWidth +
            addBtnWidth +
            updateStatusLabelWidth +
            configErrorWidth +
            tabManagementBtnWidth +
            scrollLeftBtnWidth +
            scrollRightBtnWidth;
        const spaceForTabs = tabbarWrapperWidth - nonTabElementsWidth;

        const numberOfTabs = tabIds.length;
        let idealTabWidth = spaceForTabs / numberOfTabs;
        idealTabWidth = Math.max(TabMinWidth, Math.min(idealTabWidth, TabDefaultWidth));

        const newScrollable = idealTabWidth * numberOfTabs > spaceForTabs;

        tabRefs.current.forEach((ref, index) => {
            if (ref.current) {
                if (animate) {
                    ref.current.classList.add("animate");
                } else {
                    ref.current.classList.remove("animate");
                }
                ref.current.style.width = `${idealTabWidth}px`;
                ref.current.style.transform = `translate3d(${index * idealTabWidth}px,0,0)`;
                ref.current.style.opacity = "1";
            }
        });

        if (idealTabWidth !== tabWidthRef.current) {
            tabWidthRef.current = idealTabWidth;
        }

        if (newScrollable !== scrollableRef.current) {
            scrollableRef.current = newScrollable;
            setIsScrollable(newScrollable);
        }

        if (newScrollable) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            osInstanceRef.current = OverlayScrollbars(tabBarRef.current, { ...(OSOptions as any) });
        } else {
            if (osInstanceRef.current) {
                osInstanceRef.current.destroy();
            }
        }
    };

    const handleResizeTabs = useCallback(() => {
        setSizeAndPosition();
        saveTabsPositionDebounced();
    }, [tabIds, newTabId, isFullScreen]);

    const reinitVersion = useAtomValue(atoms.reinitVersion);
    useEffect(() => {
        if (reinitVersion > 0) {
            setSizeAndPosition();
        }
    }, [reinitVersion]);

    useEffect(() => {
        window.addEventListener("resize", () => handleResizeTabs());
        return () => {
            window.removeEventListener("resize", () => handleResizeTabs());
        };
    }, [handleResizeTabs]);

    useEffect(() => {
        const allLoaded = tabIds.length > 0 && tabIds.every((id) => tabsLoaded[id]);
        if (allLoaded) {
            setSizeAndPosition(newTabId === null && prevAllLoadedRef.current);
            saveTabsPosition();
            if (!prevAllLoadedRef.current) {
                prevAllLoadedRef.current = true;
            }
        }
    }, [tabIds, tabsLoaded, newTabId, saveTabsPosition]);

    useEffect(() => {
        if (!isScrollable || !osInstanceRef.current) {
            setCanScrollLeft(false);
            setCanScrollRight(false);
            return;
        }

        const updateScrollButtonStates = () => {
            const viewport = osInstanceRef.current?.elements().viewport;
            if (!viewport) return;
            setCanScrollLeft(viewport.scrollLeft > 0);
            setCanScrollRight(viewport.scrollLeft < viewport.scrollWidth - viewport.clientWidth - 1);
        };

        const viewport = osInstanceRef.current.elements().viewport;
        viewport.addEventListener("scroll", updateScrollButtonStates);
        updateScrollButtonStates();

        return () => {
            viewport.removeEventListener("scroll", updateScrollButtonStates);
        };
    }, [isScrollable]);

    useEffect(() => {
        if (!isScrollable || !osInstanceRef.current || !activeTabId) return;

        const activeTabIndex = tabIds.indexOf(activeTabId);
        if (activeTabIndex === -1) return;

        const tabRef = tabRefs.current[activeTabIndex];
        if (!tabRef?.current) return;

        const viewport = osInstanceRef.current.elements().viewport;
        if (!viewport) return;

        const tabRect = tabRef.current.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();

        const tabLeftRelative = tabRect.left - viewportRect.left + viewport.scrollLeft;
        const tabRightRelative = tabLeftRelative + tabRect.width;
        const viewportLeft = viewport.scrollLeft;
        const viewportRight = viewport.scrollLeft + viewport.clientWidth;

        if (tabLeftRelative < viewportLeft) {
            viewport.scrollTo({ left: tabLeftRelative, behavior: "smooth" });
        } else if (tabRightRelative > viewportRight) {
            viewport.scrollTo({ left: tabRightRelative - viewport.clientWidth, behavior: "smooth" });
        }
    }, [activeTabId, isScrollable, tabIds]);

    const updateScrollDebounced = useCallback(
        debounce(30, () => {
            if (scrollableRef.current) {
                const { viewport } = osInstanceRef.current.elements();
                viewport.scrollLeft = tabIds.length * tabWidthRef.current;
            }
        }),
        [tabIds]
    );

    const setNewTabIdDebounced = useCallback(
        debounce(100, (tabId: string) => {
            setNewTabId(tabId);
        }),
        []
    );

    const handleAddTab = () => {
        createTab();
        void tabsWrapperRef.current.style.transition;
        tabsWrapperRef.current.style.setProperty("--tabs-wrapper-transition", "width 0.1s ease");
        updateScrollDebounced();
        setNewTabIdDebounced(null);
    };

    const handleCloseTab = (event: React.MouseEvent<HTMLButtonElement, MouseEvent> | null, tabId: string) => {
        event?.stopPropagation();
        const tabData = WOS.getObjectValue<Tab>(WOS.makeORef("tab", tabId));
        if (tabData) {
            addRecentlyClosed(tabData);
        }
        const ws = globalStore.get(atoms.workspace);
        cleanupOsc7DebounceForTab(tabId);
        getApi().closeTab(ws.oid, tabId);
        tabsWrapperRef.current.style.setProperty("--tabs-wrapper-transition", "width 0.3s ease");
        deleteLayoutModelForTab(tabId);
    };

    const handleCloseTabFromPanel = useCallback(
        (tabId: string) => {
            handleCloseTab(null, tabId);
        },
        [tabIds]
    );

    const handleTabLoaded = useCallback((tabId: string) => {
        setTabsLoaded((prev) => {
            if (!prev[tabId]) {
                return { ...prev, [tabId]: true };
            }
            return prev;
        });
    }, []);

    const isBeforeActive = (tabId: string) => {
        return tabIds.indexOf(tabId) === tabIds.indexOf(activeTabId) - 1;
    };

    const handleScrollLeft = useCallback(() => {
        if (!osInstanceRef.current) return;
        const viewport = osInstanceRef.current.elements().viewport;
        const currentScrollLeft = viewport.scrollLeft;
        const scrollAmount = tabWidthRef.current;
        viewport.scrollTo({ left: Math.max(0, currentScrollLeft - scrollAmount), behavior: "smooth" });
    }, []);

    const handleScrollRight = useCallback(() => {
        if (!osInstanceRef.current) return;
        const viewport = osInstanceRef.current.elements().viewport;
        const currentScrollLeft = viewport.scrollLeft;
        const scrollAmount = tabWidthRef.current;
        const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
        viewport.scrollTo({ left: Math.min(maxScrollLeft, currentScrollLeft + scrollAmount), behavior: "smooth" });
    }, []);

    const handleTogglePanel = useCallback(() => {
        globalStore.set(tabManagementPanelOpenAtom, (prev) => !prev);
    }, []);

    const tabsWrapperWidth = tabIds.length * tabWidthRef.current;

    let windowDragLeftWidth = 10;
    if (isMacOS() && !isFullScreen) {
        windowDragLeftWidth = zoomFactor > 0 ? 74 / zoomFactor : 74;
    }

    let windowDragRightWidth = 6;
    if (isWindows()) {
        windowDragRightWidth = zoomFactor > 0 ? 139 / zoomFactor : 139;
    }

    const addtabButtonDecl: IconButtonDecl = {
        elemtype: "iconbutton",
        icon: "plus",
        click: handleAddTab,
        title: "Add Tab",
    };

    const scrollLeftButtonDecl: IconButtonDecl = {
        elemtype: "iconbutton",
        icon: "chevron-left",
        click: handleScrollLeft,
        title: "Scroll Left",
        disabled: !canScrollLeft,
    };

    const scrollRightButtonDecl: IconButtonDecl = {
        elemtype: "iconbutton",
        icon: "chevron-right",
        click: handleScrollRight,
        title: "Scroll Right",
        disabled: !canScrollRight,
    };

    return (
        <div ref={tabbarWrapperRef} className="tab-bar-wrapper">
            <div
                ref={draggerLeftRef}
                className="h-full shrink-0 z-window-drag"
                style={{ width: windowDragLeftWidth, WebkitAppRegion: "drag" } as DragRegionStyle}
            />
            <WaveAIButton />
            <div
                ref={tabManagementBtnRef}
                className="tab-management-btn"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                onClick={handleTogglePanel}
                title="Tab Management (Ctrl+Shift+T)"
            >
                <i
                    className={makeIconClass(workspace.icon || "globe", true)}
                    style={workspace.color ? { color: workspace.color } : undefined}
                />
            </div>
            <TabManagementPanel anchorRef={tabManagementBtnRef} tabIds={tabIds} onCloseTab={handleCloseTabFromPanel} />
            {isScrollable && (
                <IconButton className="scroll-left-btn" ref={scrollLeftBtnRef} decl={scrollLeftButtonDecl} />
            )}
            <div className="tab-bar" ref={tabBarRef} data-overlayscrollbars-initialize>
                <div className="tabs-wrapper" ref={tabsWrapperRef} style={{ width: `${tabsWrapperWidth}px` }}>
                    {tabIds.map((tabId, index) => {
                        return (
                            <Tab
                                key={tabId}
                                ref={tabRefs.current[index]}
                                id={tabId}
                                isFirst={index === 0}
                                onSelect={() => handleSelectTab(tabId)}
                                active={activeTabId === tabId}
                                onDragStart={(event) => handleDragStart(event, tabId, tabRefs.current[index])}
                                onClose={(event) => handleCloseTab(event, tabId)}
                                onLoaded={() => handleTabLoaded(tabId)}
                                isBeforeActive={isBeforeActive(tabId)}
                                isDragging={draggingTab === tabId}
                                tabWidth={tabWidthRef.current}
                                isNew={tabId === newTabId}
                            />
                        );
                    })}
                </div>
            </div>
            {isScrollable && (
                <IconButton className="scroll-right-btn" ref={scrollRightBtnRef} decl={scrollRightButtonDecl} />
            )}
            <IconButton className="add-tab" ref={addBtnRef} decl={addtabButtonDecl} />
            <div className="tab-bar-right">
                <UpdateStatusBanner ref={updateStatusBannerRef} />
                <ConfigErrorIcon buttonRef={configErrorButtonRef} />
                <div
                    ref={draggerRightRef}
                    className="h-full shrink-0 z-window-drag"
                    style={{ width: windowDragRightWidth, WebkitAppRegion: "drag" } as DragRegionStyle}
                />
            </div>
        </div>
    );
});

export { TabBar };
