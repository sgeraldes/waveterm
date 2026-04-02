import ClaudeColorSvg from "@/app/asset/claude-color.svg";
import { Search, useSearch } from "@/app/element/search";
import { ContextMenuModel } from "@/app/store/contextmenu";
import { useTabModel } from "@/app/store/tab-model";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import type { TermViewModel } from "@/app/view/term/term-model";
import { TermTabStrip } from "@/app/view/term/term-tab-strip";
import { atoms, getOverrideConfigAtom, getSettingsPrefixAtom, globalStore, WOS } from "@/store/global";
import { fireAndForget, stringToBase64, useAtomValueSafe } from "@/util/util";
import { computeBgStyleFromMeta } from "@/util/waveutil";
import { ISearchOptions } from "@xterm/addon-search";
import clsx from "clsx";
import * as jotai from "jotai";
import * as React from "react";
import { TermStickers } from "./termsticker";
import { TermThemeUpdater } from "./termtheme";
import { computeTheme } from "./termutil";
import { TermWrap } from "./termwrap";
import "./xterm.css";

interface TerminalViewProps {
    blockId: string;
    model: TermViewModel;
}

const TermClaudeIcon = React.memo(() => {
    return (
        <div className="[&_svg]:w-[15px] [&_svg]:h-[15px]" aria-hidden="true">
            <ClaudeColorSvg />
        </div>
    );
});

TermClaudeIcon.displayName = "TermClaudeIcon";

const TermResyncHandler = React.memo(({ model }: TerminalViewProps) => {
    const connStatus = jotai.useAtomValue(model.connStatus);
    const [lastConnStatus, setLastConnStatus] = React.useState<ConnStatus>(connStatus);

    React.useEffect(() => {
        if (!model.termRef.current?.hasResized) {
            return;
        }
        const isConnected = connStatus?.status == "connected";
        const wasConnected = lastConnStatus?.status == "connected";
        const curConnName = connStatus?.connection;
        const lastConnName = lastConnStatus?.connection;
        if (isConnected == wasConnected && curConnName == lastConnName) {
            return;
        }
        model.termRef.current?.resyncController("resync handler");
        setLastConnStatus(connStatus);
    }, [connStatus]);

    return null;
});

// A single terminal session rendered inside the parent view.
// When multiple sessions exist, inactive ones are hidden via visibility:hidden + absolute positioning
// (NOT display:none) so FitAddon retains correct dimensions.
interface TermSessionProps {
    sessionBlockId: string; // blockId for this session (parent or sub-block)
    isActive: boolean;
    model: TermViewModel; // The parent model (for hooks like termRef on the active session)
    termSettings: Record<string, any>;
    termFontSize: number;
    connFontFamily: string;
    isFocused: boolean;
    isMI: boolean;
    isBasicTerm: boolean;
    searchProps: ReturnType<typeof useSearch>;
    onTermWrapReady: (sessionId: string, termWrap: TermWrap) => void;
    onTermWrapDispose: (sessionId: string) => void;
    containerRef: React.RefObject<HTMLDivElement>; // The parent container for sizing
}

const TermSession = React.memo(
    ({
        sessionBlockId,
        isActive,
        model,
        termSettings,
        termFontSize,
        connFontFamily,
        isFocused,
        isMI,
        isBasicTerm,
        searchProps,
        onTermWrapReady,
        onTermWrapDispose,
    }: TermSessionProps) => {
        const connectElemRef = React.useRef<HTMLDivElement>(null);
        const scrollbarHideObserverRef = React.useRef<HTMLDivElement>(null);
        const termWrapRef = React.useRef<TermWrap>(null);
        const tabModel = useTabModel();
        const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", sessionBlockId));

        const onScrollbarShowObserver = React.useCallback(() => {
            if (!connectElemRef.current) return;
            const termViewport = connectElemRef.current.getElementsByClassName("xterm-viewport")[0] as HTMLDivElement;
            if (termViewport) termViewport.style.zIndex = "var(--zindex-xterm-viewport-overlay)";
            if (scrollbarHideObserverRef.current) scrollbarHideObserverRef.current.style.display = "block";
        }, []);
        const onScrollbarHideObserver = React.useCallback(() => {
            if (!connectElemRef.current) return;
            const termViewport = connectElemRef.current.getElementsByClassName("xterm-viewport")[0] as HTMLDivElement;
            if (termViewport) termViewport.style.zIndex = "auto";
            if (scrollbarHideObserverRef.current) scrollbarHideObserverRef.current.style.display = "none";
        }, []);

        React.useEffect(() => {
            const fullConfig = globalStore.get(atoms.fullConfigAtom);
            const termThemeName = globalStore.get(model.termThemeNameAtom);
            const termTransparency = globalStore.get(model.termTransparencyAtom);
            const termMacOptionIsMetaAtom = getOverrideConfigAtom(sessionBlockId, "term:macoptionismeta");
            const [termTheme, _] = computeTheme(fullConfig, termThemeName, termTransparency);
            let termScrollback = 2000;
            if (termSettings?.["term:scrollback"]) {
                termScrollback = Math.floor(termSettings["term:scrollback"]);
            }
            if (blockData?.meta?.["term:scrollback"]) {
                termScrollback = Math.floor(blockData.meta["term:scrollback"]);
            }
            if (termScrollback < 0) termScrollback = 0;
            if (termScrollback > 50000) termScrollback = 50000;

            const termAllowBPM = globalStore.get(model.termBPMAtom) ?? true;
            const termMacOptionIsMeta = globalStore.get(termMacOptionIsMetaAtom) ?? false;
            const wasFocused = model.termRef.current != null && globalStore.get(model.nodeModel.isFocused);

            const termWrap = new TermWrap(
                tabModel.tabId,
                sessionBlockId,
                connectElemRef.current,
                {
                    theme: termTheme,
                    fontSize: termFontSize,
                    fontFamily: termSettings?.["term:fontfamily"] ?? connFontFamily ?? "Hack",
                    drawBoldTextInBrightColors: false,
                    fontWeight: "normal",
                    fontWeightBold: "bold",
                    allowTransparency: true,
                    scrollback: termScrollback,
                    allowProposedApi: true,
                    ignoreBracketedPasteMode: !termAllowBPM,
                    macOptionIsMeta: termMacOptionIsMeta,
                    reflowCursorLine: true,
                    cursorStyle: ((): "block" | "underline" | "bar" => {
                        const raw = termSettings?.["term:cursorstyle"] ?? blockData?.meta?.["term:cursorstyle"];
                        if (raw === "block" || raw === "underline" || raw === "bar") return raw;
                        return "block";
                    })(),
                    cursorBlink:
                        termSettings?.["term:cursorblink"] ?? blockData?.meta?.["term:cursorblink"] ?? true,
                    lineHeight:
                        (termSettings?.["term:lineheight"] as number) ??
                        (blockData?.meta?.["term:lineheight"] as number) ??
                        1.0,
                    vtExtensions: {
                        colorSchemeQuery: false,
                    },
                },
                {
                    keydownHandler: model.handleTerminalKeydown.bind(model),
                    useWebGl: isActive && !termSettings?.["term:disablewebgl"],
                    useLigatures: termSettings?.["term:ligatures"],
                    sendDataHandler: (data: string) => {
                        const b64data = stringToBase64(data);
                        RpcApi.ControllerInputCommand(TabRpcClient, {
                            blockid: sessionBlockId,
                            inputdata64: b64data,
                        }).catch((error) => {
                            console.error("Failed to send data to controller:", error);
                        });
                    },
                    nodeModel: model.nodeModel,
                }
            );

            termWrapRef.current = termWrap;

            if (isActive) {
                (window as any).term = termWrap;
                model.termRef.current = termWrap;

                termWrap.onShellIntegrationStatusChange = () => {
                    model.updateTabTerminalStatus();
                };
                model.updateTabTerminalStatus();
            }

            const statusRefreshTimer = isActive
                ? setTimeout(() => {
                      model.updateTabTerminalStatus();
                  }, 500)
                : null;

            // ResizeObserver only on active session
            let rszObs: ResizeObserver | null = null;
            if (isActive && connectElemRef.current) {
                rszObs = new ResizeObserver(() => {
                    termWrap.handleResize_debounced();
                });
                rszObs.observe(connectElemRef.current);
            }

            if (isActive) {
                termWrap.onSearchResultsDidChange = (results) => {
                    globalStore.set(searchProps.resultsIndex, results.resultIndex);
                    globalStore.set(searchProps.resultsCount, results.resultCount);
                };
            }

            fireAndForget(termWrap.initTerminal.bind(termWrap));

            if (isActive && wasFocused) {
                setTimeout(() => {
                    model.giveFocus();
                }, 10);
            }

            onTermWrapReady(sessionBlockId, termWrap);

            return () => {
                if (statusRefreshTimer) clearTimeout(statusRefreshTimer);
                termWrap.dispose();
                rszObs?.disconnect();
                onTermWrapDispose(sessionBlockId);
            };
        }, [sessionBlockId, termSettings, termFontSize, connFontFamily, isActive]);

        React.useEffect(() => {
            if (!termWrapRef.current) return;
            if (isMI && isBasicTerm && isFocused && isActive) {
                termWrapRef.current.multiInputCallback = (data: string) => {
                    model.multiInputHandler(data);
                };
            } else {
                termWrapRef.current.multiInputCallback = null;
            }
        }, [isMI, isBasicTerm, isFocused, isActive]);

        // Position/visibility style for inactive sessions:
        // Must keep in DOM (not display:none) for FitAddon to work correctly
        const sessionStyle: React.CSSProperties = isActive
            ? { flex: "1 1 0", minHeight: 0, overflow: "visible", display: "flex" }
            : {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  visibility: "hidden",
                  overflow: "hidden",
                  pointerEvents: "none",
              };

        return (
            <div style={sessionStyle}>
                <div className="term-connectelem" ref={connectElemRef} style={{ flex: "1 1 0", minHeight: 0 }}>
                    <div className="term-scrollbar-show-observer" onPointerOver={onScrollbarShowObserver} />
                    <div
                        ref={scrollbarHideObserverRef}
                        className="term-scrollbar-hide-observer"
                        onPointerOver={onScrollbarHideObserver}
                    />
                </div>
            </div>
        );
    }
);
TermSession.displayName = "TermSession";

function formatSessionTime(ms: number): string {
    const d = new Date(ms);
    const now = new Date();
    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === now.toDateString()) {
        return `today at ${timeStr}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
        return `yesterday at ${timeStr}`;
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ` at ${timeStr}`;
}

const RestoredSessionBanner = React.memo(({ model }: { model: TermViewModel }) => {
    const restoredState = jotai.useAtomValue(model.restoredModeAtom);
    if (!restoredState) return null;

    const timeLabel = formatSessionTime(restoredState.sessionTime);
    const title = restoredState.sessionTitle ? ` — ${restoredState.sessionTitle}` : "";

    return (
        <div
            className="flex items-center justify-center gap-3 px-3 text-[11px] font-medium select-none"
            style={{
                height: 24,
                flexShrink: 0,
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                color: "var(--main-text-color)",
                borderBottom: "1px solid rgba(59, 130, 246, 0.3)",
            }}
        >
            <span className="opacity-70">
                <i className="fa-sharp fa-regular fa-clock-rotate-left mr-1.5" />
                Showing session from {timeLabel}{title}
            </span>
            <button
                className="px-2 py-0.5 rounded text-[11px] font-semibold transition-colors"
                style={{
                    backgroundColor: "rgba(59, 130, 246, 0.25)",
                    color: "rgb(147, 197, 253)",
                }}
                onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = "rgba(59, 130, 246, 0.4)";
                }}
                onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = "rgba(59, 130, 246, 0.25)";
                }}
                onClick={() => fireAndForget(() => model.returnToLive())}
            >
                Return to live session
            </button>
        </div>
    );
});
RestoredSessionBanner.displayName = "RestoredSessionBanner";

const TerminalView = ({ blockId, model }: ViewComponentProps<TermViewModel>) => {
    const viewRef = React.useRef<HTMLDivElement>(null);
    const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", blockId));
    const termSettingsAtom = getSettingsPrefixAtom("term");
    const termSettings = jotai.useAtomValue(termSettingsAtom);
    let termMode = blockData?.meta?.["term:mode"] ?? "term";
    if (termMode != "term") {
        termMode = "term";
    }
    const termModeRef = React.useRef(termMode);

    const tabModel = useTabModel();
    const termFontSize = jotai.useAtomValue(model.fontSizeAtom);
    const fullConfig = globalStore.get(atoms.fullConfigAtom);
    const connFontFamily = fullConfig.connections?.[blockData?.meta?.connection]?.["term:fontfamily"];
    const isFocused = jotai.useAtomValue(model.nodeModel.isFocused);
    const isMI = jotai.useAtomValue(tabModel.isTermMultiInput);
    const isBasicTerm = blockData?.meta?.controller != "cmd";

    // Multi-session state
    const subBlockIds = jotai.useAtomValue(model.subBlockIdsAtom);
    const activeTabId = jotai.useAtomValue(model.activeTabIdAtom);
    const hasMultipleSessions = subBlockIds.length > 0;

    // All session IDs: null represents the primary session (parent block)
    // When hasMultipleSessions: activeTabId is null (primary) or a subBlockId
    // When !hasMultipleSessions: single session = primary
    const activeSessionId = hasMultipleSessions ? activeTabId : null;

    const searchProps = useSearch({
        anchorRef: viewRef,
        viewModel: model,
        caseSensitive: false,
        wholeWord: false,
        regex: false,
    });
    const searchIsOpen = jotai.useAtomValue<boolean>(searchProps.isOpen);
    const caseSensitive = useAtomValueSafe<boolean>(searchProps.caseSensitive);
    const wholeWord = useAtomValueSafe<boolean>(searchProps.wholeWord);
    const regex = useAtomValueSafe<boolean>(searchProps.regex);
    const searchVal = jotai.useAtomValue<string>(searchProps.searchValue);
    const searchDecorations = React.useMemo(
        () => ({
            matchOverviewRuler: "#FFFF00",
            activeMatchColorOverviewRuler: "#FF9632",
            activeMatchBorder: "#FF9632",
            matchBorder: "#555555",
        }),
        []
    );
    const searchOpts = React.useMemo<ISearchOptions>(
        () => ({
            regex,
            wholeWord,
            caseSensitive,
            decorations: searchDecorations,
        }),
        [regex, wholeWord, caseSensitive]
    );
    const handleSearchError = React.useCallback((e: Error) => {
        console.warn("search error:", e);
    }, []);
    const executeSearch = React.useCallback(
        (searchText: string, direction: "next" | "previous") => {
            model.termRef.current?.searchAddon.clearDecorations();
            if (searchText === "") return;
            try {
                model.termRef.current?.searchAddon[direction === "next" ? "findNext" : "findPrevious"](
                    searchText,
                    searchOpts
                );
            } catch (e) {
                handleSearchError(e);
            }
        },
        [searchOpts, handleSearchError]
    );
    searchProps.onSearch = React.useCallback(
        (searchText: string) => executeSearch(searchText, "previous"),
        [executeSearch]
    );
    searchProps.onPrev = React.useCallback(() => executeSearch(searchVal, "previous"), [executeSearch, searchVal]);
    searchProps.onNext = React.useCallback(() => executeSearch(searchVal, "next"), [executeSearch, searchVal]);
    React.useEffect(() => {
        if (!searchIsOpen) {
            model.termRef.current?.searchAddon.clearDecorations();
            model.giveFocus();
        }
    }, [searchIsOpen]);
    React.useEffect(() => {
        model.termRef.current?.searchAddon.clearDecorations();
        searchProps.onSearch(searchVal);
    }, [searchOpts]);

    React.useEffect(() => {
        termModeRef.current = termMode;
    }, [termMode]);

    React.useEffect(() => {
        if (isFocused) {
            const timer = setTimeout(() => {
                model.updateTabTerminalStatus();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isFocused, model]);

    const handleTermWrapReady = React.useCallback(
        (sessionId: string, termWrap: TermWrap) => {
            // For the primary session (parent blockId), keep model.termRef updated
            if (sessionId === blockId) {
                model.termRef.current = termWrap;
            }
        },
        [blockId, model]
    );

    const handleTermWrapDispose = React.useCallback(
        (sessionId: string) => {
            if (sessionId === blockId && model.termRef.current) {
                // Don't null out — TermWrap handles its own dispose
            }
        },
        [blockId, model]
    );

    const stickerConfig = {
        charWidth: 8,
        charHeight: 16,
        rows: model.termRef.current?.terminal.rows ?? 24,
        cols: model.termRef.current?.terminal.cols ?? 80,
        blockId: blockId,
    };

    const customTermBg = computeBgStyleFromMeta(blockData?.meta);
    const termThemeBgColor = jotai.useAtomValue(model.termBgColor);

    const handleContextMenu = React.useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            const menuItems = model.getContextMenuItems();
            ContextMenuModel.showContextMenu(menuItems, e);
        },
        [model]
    );

    React.useEffect(() => {
        const elem = viewRef.current;
        if (!elem) return;

        const handlePointerDown = () => {
            if (!globalStore.get(model.nodeModel.isFocused)) {
                model.nodeModel.focusNode();
            }
        };

        elem.addEventListener("pointerdown", handlePointerDown, true);

        let sliderElem: Element | null = null;
        const attachSliderListener = () => {
            sliderElem = elem.querySelector(".xterm-scrollable-element > .scrollbar.vertical > .slider");
            if (sliderElem) {
                sliderElem.addEventListener("pointerdown", handlePointerDown, true);
            }
        };

        attachSliderListener();
        const timer = setTimeout(attachSliderListener, 500);

        const observer = new MutationObserver(() => {
            const newSlider = elem.querySelector(".xterm-scrollable-element > .scrollbar.vertical > .slider");
            if (newSlider && newSlider !== sliderElem) {
                if (sliderElem) {
                    sliderElem.removeEventListener("pointerdown", handlePointerDown, true);
                }
                sliderElem = newSlider;
                sliderElem.addEventListener("pointerdown", handlePointerDown, true);
            }
        });
        observer.observe(elem, { childList: true, subtree: true });

        return () => {
            clearTimeout(timer);
            observer.disconnect();
            elem.removeEventListener("pointerdown", handlePointerDown, true);
            if (sliderElem) {
                sliderElem.removeEventListener("pointerdown", handlePointerDown, true);
            }
        };
    }, [model.nodeModel]);

    // Build all session block IDs to render
    // Primary is always rendered; sub-blocks added when they exist
    const allSessionIds: string[] = [blockId, ...subBlockIds];

    return (
        <div
            className={clsx("view-term", "term-mode-" + termMode)}
            ref={viewRef}
            onContextMenu={handleContextMenu}
            style={{ backgroundColor: termThemeBgColor }}
        >
            {customTermBg && <div className="absolute inset-0 z-0 pointer-events-none" style={customTermBg} />}
            <TermResyncHandler blockId={blockId} model={model} />
            <TermThemeUpdater blockId={blockId} model={model} termRef={model.termRef} />
            <TermStickers config={stickerConfig} />
            {hasMultipleSessions && <TermTabStrip model={model} />}
            <RestoredSessionBanner model={model} />
            <div
                className="term-sessions-container"
                style={{ flex: "1 1 0", minHeight: 0, position: "relative", display: "flex" }}
            >
                {allSessionIds.map((sessionId) => {
                    const isActiveSess =
                        !hasMultipleSessions
                            ? sessionId === blockId
                            : activeSessionId === null
                              ? sessionId === blockId
                              : sessionId === activeSessionId;
                    return (
                        <TermSession
                            key={sessionId}
                            sessionBlockId={sessionId}
                            isActive={isActiveSess}
                            model={model}
                            termSettings={termSettings}
                            termFontSize={termFontSize}
                            connFontFamily={connFontFamily}
                            isFocused={isFocused}
                            isMI={isMI}
                            isBasicTerm={isBasicTerm}
                            searchProps={searchProps}
                            onTermWrapReady={handleTermWrapReady}
                            onTermWrapDispose={handleTermWrapDispose}
                            containerRef={viewRef}
                        />
                    );
                })}
            </div>
            <Search {...searchProps} />
        </div>
    );
};

export { TermClaudeIcon, TerminalView };
