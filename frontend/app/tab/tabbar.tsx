import { Button } from "@/app/element/button";
import { modalsModel } from "@/app/store/modalmodel";
import { cleanupOsc7DebounceForTab } from "@/app/view/term/termwrap";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { deleteLayoutModelForTab } from "@/layout/index";
import { atoms, createTab, getApi, globalStore, setActiveTab } from "@/store/global";
import { isMacOS, isWindows } from "@/util/platformutil";
import { fireAndForget } from "@/util/util";
import { useAtomValue } from "jotai";
import { OverlayScrollbars, PartialOptions } from "overlayscrollbars";
import { createRef, memo, useCallback, useEffect, useRef, useState } from "react";
import { debounce } from "throttle-debounce";
import { IconButton } from "../element/iconbutton";
import { WorkspaceService } from "../store/services";
import { Tab } from "./tab";
import "./tabbar.scss";
import { TabListDropdown } from "./tablistdropdown";
import { UpdateStatusBanner } from "./updatebanner";
import { WorkspaceSwitcher } from "./workspaceswitcher";

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

const WaveAIButton = memo(() => {
    const aiPanelOpen = useAtomValue(WorkspaceLayoutModel.getInstance().panelVisibleAtom);

    const onClick = () => {
        const currentVisible = WorkspaceLayoutModel.getInstance().getAIPanelVisible();
        WorkspaceLayoutModel.getInstance().setAIPanelVisible(!currentVisible);
    };

    return (
        <div
            className={`flex h-[24px] px-1.5 justify-end items-center rounded-md mr-1 mb-0.5 box-border cursor-pointer hover:bg-white/5 transition-colors text-[12px] ${aiPanelOpen ? "text-accent" : "text-secondary"}`}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            onClick={onClick}
        >
            <i className="fa fa-sparkles" />
            <span className="font-bold ml-1 -top-px font-mono">AI</span>
        </div>
    );
});
WaveAIButton.displayName = "WaveAIButton";

const ConfigErrorMessage = () => {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);

    if (fullConfig?.configerrors == null || fullConfig?.configerrors.length == 0) {
        return (
            <div className="max-w-[500px] p-5">
                <h3 className="font-bold text-base mb-2.5">Configuration Clean</h3>
                <p>There are no longer any errors detected in your config.</p>
            </div>
        );
    }
    if (fullConfig?.configerrors.length == 1) {
        const singleError = fullConfig.configerrors[0];
        return (
            <div className="max-w-[500px] p-5">
                <h3 className="font-bold text-base mb-2.5">Configuration Error</h3>
                <div>
                    {singleError.file}: {singleError.err}
                </div>
            </div>
        );
    }
    return (
        <div className="max-w-[500px] p-5">
            <h3 className="font-bold text-base mb-2.5">Configuration Error</h3>
            <ul>
                {fullConfig.configerrors.map((error, index) => (
                    <li key={index}>
                        {error.file}: {error.err}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const ConfigErrorIcon = ({ buttonRef }: { buttonRef: React.RefObject<HTMLElement> }) => {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);

    function handleClick() {
        modalsModel.pushModal("MessageModal", { children: <ConfigErrorMessage /> });
    }

    if (fullConfig?.configerrors == null || fullConfig?.configerrors.length == 0) {
        return null;
    }
    return (
        <Button
            ref={buttonRef as React.RefObject<HTMLButtonElement>}
            className="text-black flex-[0_0_fit-content] !h-full !px-3 red"
            onClick={handleClick}
        >
            <i className="fa fa-solid fa-exclamation-triangle" />
            Config Error
        </Button>
    );
};

function strArrayIsEqual(a: string[], b: string[]) {
    if (a == null && b == null) {
        return true;
    }
    if (a == null || b == null) {
        return false;
    }
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

const TabBar = memo(({ workspace }: TabBarProps) => {
    const [tabIds, setTabIds] = useState<string[]>([]);
    const [dragStartPositions, setDragStartPositions] = useState<number[]>([]);
    const [draggingTab, setDraggingTab] = useState<string>();
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
    const draggingRemovedRef = useRef(false);
    const draggingTabDataRef = useRef({
        tabId: "",
        ref: { current: null },
        tabStartX: 0,
        tabStartIndex: 0,
        tabIndex: 0,
        initialOffsetX: null,
        totalScrollOffset: null,
        dragged: false,
    });
    const osInstanceRef = useRef<OverlayScrollbars>(null);
    const draggerLeftRef = useRef<HTMLDivElement>(null);
    const draggerRightRef = useRef<HTMLDivElement>(null);
    const workspaceSwitcherRef = useRef<HTMLDivElement>(null);
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

    let prevDelta: number;
    let prevDragDirection: string;

    useEffect(() => {
        tabRefs.current = tabIds.map((_, index) => tabRefs.current[index] || createRef());
    }, [tabIds]);

    useEffect(() => {
        if (!workspace) {
            return;
        }
        const newTabIdsArr = workspace.tabids ?? [];

        const areEqual = strArrayIsEqual(tabIds, newTabIdsArr);

        if (!areEqual) {
            setTabIds(newTabIdsArr);
        }
    }, [workspace, tabIds]);

    const saveTabsPosition = useCallback(() => {
        const tabs = tabRefs.current;
        if (tabs === null) return;

        const newStartPositions: number[] = [];
        let cumulativeLeft = 0;

        tabRefs.current.forEach((ref) => {
            if (ref.current) {
                newStartPositions.push(cumulativeLeft);
                cumulativeLeft += ref.current.getBoundingClientRect().width;
            }
        });

        setDragStartPositions(newStartPositions);
    }, []);

    const setSizeAndPosition = (animate?: boolean) => {
        const tabBar = tabBarRef.current;
        if (tabBar === null) return;

        const tabbarWrapperWidth = tabbarWrapperRef.current.getBoundingClientRect().width;
        const windowDragLeftWidth = draggerLeftRef.current.getBoundingClientRect().width;
        const windowDragRightWidth = draggerRightRef.current?.getBoundingClientRect().width ?? 0;
        const addBtnWidth = addBtnRef.current.getBoundingClientRect().width;
        const updateStatusLabelWidth = updateStatusBannerRef.current?.getBoundingClientRect().width ?? 0;
        const configErrorWidth = configErrorButtonRef.current?.getBoundingClientRect().width ?? 0;
        const workspaceSwitcherWidth = workspaceSwitcherRef.current?.getBoundingClientRect().width ?? 0;
        const scrollLeftBtnWidth = scrollLeftBtnRef.current?.getBoundingClientRect().width ?? 0;
        const scrollRightBtnWidth = scrollRightBtnRef.current?.getBoundingClientRect().width ?? 0;

        const nonTabElementsWidth =
            windowDragLeftWidth +
            windowDragRightWidth +
            addBtnWidth +
            updateStatusLabelWidth +
            configErrorWidth +
            workspaceSwitcherWidth +
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

    const saveTabsPositionDebounced = useCallback(
        debounce(100, () => saveTabsPosition()),
        [saveTabsPosition]
    );

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

            const scrollLeft = viewport.scrollLeft;
            const scrollWidth = viewport.scrollWidth;
            const clientWidth = viewport.clientWidth;

            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
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

    const getDragDirection = (currentX: number) => {
        let dragDirection: string;
        if (currentX - prevDelta > 0) {
            dragDirection = "+";
        } else if (currentX - prevDelta === 0) {
            dragDirection = prevDragDirection;
        } else {
            dragDirection = "-";
        }
        prevDelta = currentX;
        prevDragDirection = dragDirection;
        return dragDirection;
    };

    const getNewTabIndex = (currentX: number, tabIndex: number, dragDirection: string) => {
        let newTabIndex = tabIndex;
        const tabWidth = tabWidthRef.current;
        if (dragDirection === "+") {
            for (let i = tabIndex + 1; i < tabIds.length; i++) {
                const otherTabStart = dragStartPositions[i];
                if (currentX + tabWidth > otherTabStart + tabWidth / 2) {
                    newTabIndex = i;
                }
            }
        } else {
            for (let i = tabIndex - 1; i >= 0; i--) {
                const otherTabEnd = dragStartPositions[i] + tabWidth;
                if (currentX < otherTabEnd - tabWidth / 2) {
                    newTabIndex = i;
                }
            }
        }
        return newTabIndex;
    };

    const handleMouseMove = (event: MouseEvent) => {
        const { tabId, ref, tabStartX } = draggingTabDataRef.current;

        let initialOffsetX = draggingTabDataRef.current.initialOffsetX;
        let totalScrollOffset = draggingTabDataRef.current.totalScrollOffset;
        if (initialOffsetX === null) {
            initialOffsetX = event.clientX - tabStartX;
            draggingTabDataRef.current.initialOffsetX = initialOffsetX;
        }
        let currentX = event.clientX - initialOffsetX - totalScrollOffset;
        let tabBarRectWidth = tabBarRef.current.getBoundingClientRect().width;
        const tabBarRectLeftOffset = tabBarRef.current.getBoundingClientRect().left;
        const incrementDecrement = tabBarRectLeftOffset * 0.05;
        const dragDirection = getDragDirection(currentX);
        const scrollable = scrollableRef.current;
        const tabWidth = tabWidthRef.current;

        if (scrollable) {
            const { viewport } = osInstanceRef.current.elements();
            const currentScrollLeft = viewport.scrollLeft;

            if (event.clientX <= tabBarRectLeftOffset) {
                viewport.scrollLeft = Math.max(0, currentScrollLeft - incrementDecrement);
                if (viewport.scrollLeft !== currentScrollLeft) {
                    draggingTabDataRef.current.totalScrollOffset += currentScrollLeft - viewport.scrollLeft;
                }
            } else if (event.clientX >= tabBarRectWidth + tabBarRectLeftOffset) {
                viewport.scrollLeft = Math.min(viewport.scrollWidth, currentScrollLeft + incrementDecrement);
                if (viewport.scrollLeft !== currentScrollLeft) {
                    draggingTabDataRef.current.totalScrollOffset -= viewport.scrollLeft - currentScrollLeft;
                }
            }
        }

        initialOffsetX = draggingTabDataRef.current.initialOffsetX;
        totalScrollOffset = draggingTabDataRef.current.totalScrollOffset;
        currentX = event.clientX - initialOffsetX - totalScrollOffset;

        setDraggingTab((prev) => (prev !== tabId ? tabId : prev));

        if (Math.abs(currentX - tabStartX) >= 50) {
            draggingTabDataRef.current.dragged = true;
        }

        if (tabBarRef.current) {
            const numberOfTabs = tabIds.length;
            const totalDefaultTabWidth = numberOfTabs * TabDefaultWidth;
            if (totalDefaultTabWidth < tabBarRectWidth) {
                tabBarRectWidth = totalDefaultTabWidth;
            } else if (scrollable) {
                tabBarRectWidth = tabsWrapperRef.current.scrollWidth;
            }

            const minLeft = 0;
            const maxRight = tabBarRectWidth - tabWidth;

            currentX = Math.min(Math.max(currentX, minLeft), maxRight);
        }

        ref.current!.style.transform = `translate3d(${currentX}px,0,0)`;
        ref.current!.style.zIndex = "100";

        const tabIndex = draggingTabDataRef.current.tabIndex;
        const newTabIndex = getNewTabIndex(currentX, tabIndex, dragDirection);

        if (newTabIndex !== tabIndex) {
            if (!draggingRemovedRef.current) {
                tabIds.splice(tabIndex, 1);
                draggingRemovedRef.current = true;
            }

            const currentIndexOfDraggingTab = tabIds.indexOf(tabId);

            if (currentIndexOfDraggingTab !== -1) {
                tabIds.splice(currentIndexOfDraggingTab, 1);
            }
            tabIds.splice(newTabIndex, 0, tabId);

            tabIds.forEach((localTabId, index) => {
                const ref = tabRefs.current.find((ref) => ref.current.dataset.tabId === localTabId);
                if (ref.current && localTabId !== tabId) {
                    ref.current.style.transform = `translate3d(${index * tabWidth}px,0,0)`;
                    ref.current.classList.add("animate");
                }
            });

            draggingTabDataRef.current.tabIndex = newTabIndex;
        }
    };

    const setUpdatedTabsDebounced = useCallback(
        debounce(300, (tabIds: string[]) => {
            tabRefs.current.forEach((ref) => {
                ref.current.style.zIndex = "0";
                ref.current.classList.remove("animate");
            });
            setDraggingTab(null);
            fireAndForget(() => WorkspaceService.UpdateTabIds(workspace.oid, tabIds));
        }),
        []
    );

    const handleMouseUp = () => {
        const { tabIndex, dragged } = draggingTabDataRef.current;

        const draggingTab = tabIds[tabIndex];
        const tabWidth = tabWidthRef.current;
        const finalLeftPosition = tabIndex * tabWidth;
        const ref = tabRefs.current.find((ref) => ref.current.dataset.tabId === draggingTab);
        if (ref.current) {
            ref.current.classList.add("animate");
            ref.current.style.transform = `translate3d(${finalLeftPosition}px,0,0)`;
        }

        if (dragged) {
            setUpdatedTabsDebounced(tabIds);
        } else {
            tabRefs.current.forEach((ref) => {
                ref.current.style.zIndex = "0";
                ref.current.classList.remove("animate");
            });
            setDraggingTab(null);
        }

        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("mousemove", handleMouseMove);
        draggingRemovedRef.current = false;
    };

    const handleDragStart = useCallback(
        (event: React.MouseEvent<HTMLDivElement, MouseEvent>, tabId: string, ref: React.RefObject<HTMLDivElement>) => {
            if (event.button !== 0) return;

            const tabIndex = tabIds.indexOf(tabId);
            const tabStartX = dragStartPositions[tabIndex];

            console.log("handleDragStart", tabId, tabIndex, tabStartX);
            if (ref.current) {
                draggingTabDataRef.current = {
                    tabId: ref.current.dataset.tabId,
                    ref,
                    tabStartX,
                    tabIndex,
                    tabStartIndex: tabIndex,
                    initialOffsetX: null,
                    totalScrollOffset: 0,
                    dragged: false,
                };

                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
            }
        },
        [tabIds, dragStartPositions]
    );

    const handleSelectTab = (tabId: string) => {
        if (!draggingTabDataRef.current.dragged) {
            setActiveTab(tabId);
        }
    };

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
        const ws = globalStore.get(atoms.workspace);
        cleanupOsc7DebounceForTab(tabId);
        getApi().closeTab(ws.oid, tabId);
        tabsWrapperRef.current.style.setProperty("--tabs-wrapper-transition", "width 0.3s ease");
        deleteLayoutModelForTab(tabId);
    };

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
        const newScrollLeft = Math.max(0, currentScrollLeft - scrollAmount);
        viewport.scrollTo({ left: newScrollLeft, behavior: "smooth" });
    }, []);

    const handleScrollRight = useCallback(() => {
        if (!osInstanceRef.current) return;
        const viewport = osInstanceRef.current.elements().viewport;
        const currentScrollLeft = viewport.scrollLeft;
        const scrollAmount = tabWidthRef.current;
        const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
        const newScrollLeft = Math.min(maxScrollLeft, currentScrollLeft + scrollAmount);
        viewport.scrollTo({ left: newScrollLeft, behavior: "smooth" });
    }, []);

    const tabsWrapperWidth = tabIds.length * tabWidthRef.current;

    let windowDragLeftWidth = 10;
    if (isMacOS() && !isFullScreen) {
        if (zoomFactor > 0) {
            windowDragLeftWidth = 74 / zoomFactor;
        } else {
            windowDragLeftWidth = 74;
        }
    }

    let windowDragRightWidth = 6;
    if (isWindows()) {
        if (zoomFactor > 0) {
            windowDragRightWidth = 139 / zoomFactor;
        } else {
            windowDragRightWidth = 139;
        }
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
            <WorkspaceSwitcher ref={workspaceSwitcherRef} />
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
            <TabListDropdown tabIds={tabIds} />
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
