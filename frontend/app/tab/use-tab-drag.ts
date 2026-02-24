import { setActiveTab } from "@/store/global";
import { fireAndForget } from "@/util/util";
import { OverlayScrollbars } from "overlayscrollbars";
import { useCallback, useRef, useState } from "react";
import { debounce } from "throttle-debounce";
import { WorkspaceService } from "../store/services";

const TabDefaultWidth = 130;

export function strArrayIsEqual(a: string[] | null, b: string[] | null): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

export interface TabDragRefs {
    tabRefs: React.MutableRefObject<React.RefObject<HTMLDivElement>[]>;
    tabBarRef: React.RefObject<HTMLDivElement>;
    tabsWrapperRef: React.RefObject<HTMLDivElement>;
    tabWidthRef: React.MutableRefObject<number>;
    scrollableRef: React.MutableRefObject<boolean>;
    osInstanceRef: React.MutableRefObject<OverlayScrollbars | null>;
}

export function useTabDrag(tabIds: string[], workspaceOid: string, refs: TabDragRefs) {
    const { tabRefs, tabBarRef, tabsWrapperRef, tabWidthRef, scrollableRef, osInstanceRef } = refs;

    const [dragStartPositions, setDragStartPositions] = useState<number[]>([]);
    const [draggingTab, setDraggingTab] = useState<string>();
    const draggingRemovedRef = useRef(false);
    const draggingTabDataRef = useRef({
        tabId: "",
        ref: { current: null } as React.RefObject<HTMLDivElement>,
        tabStartX: 0,
        tabStartIndex: 0,
        tabIndex: 0,
        initialOffsetX: null as number | null,
        totalScrollOffset: 0,
        dragged: false,
    });

    const prevDeltaRef = useRef<number>(0);
    const prevDragDirectionRef = useRef<string>("");

    const getDragDirection = (currentX: number) => {
        let dragDirection: string;
        if (currentX - prevDeltaRef.current > 0) {
            dragDirection = "+";
        } else if (currentX - prevDeltaRef.current === 0) {
            dragDirection = prevDragDirectionRef.current;
        } else {
            dragDirection = "-";
        }
        prevDeltaRef.current = currentX;
        prevDragDirectionRef.current = dragDirection;
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
        debounce(300, (updatedTabIds: string[]) => {
            tabRefs.current.forEach((ref) => {
                ref.current.style.zIndex = "0";
                ref.current.classList.remove("animate");
            });
            setDraggingTab(null);
            fireAndForget(() => WorkspaceService.UpdateTabIds(workspaceOid, updatedTabIds));
        }),
        []
    );

    const handleMouseUp = () => {
        const { tabIndex, dragged } = draggingTabDataRef.current;

        const currentDraggingTab = tabIds[tabIndex];
        const tabWidth = tabWidthRef.current;
        const finalLeftPosition = tabIndex * tabWidth;
        const ref = tabRefs.current.find((ref) => ref.current.dataset.tabId === currentDraggingTab);
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

    const saveTabsPositionDebounced = useCallback(
        debounce(100, () => saveTabsPosition()),
        [saveTabsPosition]
    );

    const handleDragStart = useCallback(
        (event: React.MouseEvent<HTMLDivElement, MouseEvent>, tabId: string, ref: React.RefObject<HTMLDivElement>) => {
            if (event.button !== 0) return;

            const tabIndex = tabIds.indexOf(tabId);
            const tabStartX = dragStartPositions[tabIndex];

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

    return {
        draggingTab,
        dragStartPositions,
        saveTabsPosition,
        saveTabsPositionDebounced,
        handleDragStart,
        handleSelectTab,
    };
}
