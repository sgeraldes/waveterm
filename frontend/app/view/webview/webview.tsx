// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Search, useSearch } from "@/app/element/search";
import { createBlock, getApi, getBlockMetaKeyAtom, getSettingsKeyAtom, openLink } from "@/app/store/global";
import {
    BlockHeaderSuggestionControl,
    SuggestionControlNoData,
    SuggestionControlNoResults,
} from "@/app/suggestion/suggestion";
import { globalStore } from "@/store/global";
import { fireAndForget, useAtomValueSafe } from "@/util/util";
import { useAtomValue, useSetAtom } from "jotai";
import * as React from "react";
import { Fragment, memo, useCallback, useEffect, useRef, useState } from "react";
import { WebViewModel, setWebViewComponent } from "./webview-model";
import "./webview.scss";

export { WebViewModel };

const USER_AGENT_IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const USER_AGENT_ANDROID =
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36";

let webviewPreloadUrl: string = null;
function getWebviewPreloadUrl() {
    if (webviewPreloadUrl == null) {
        webviewPreloadUrl = getApi().getWebviewPreload();
    }
    return webviewPreloadUrl ? "file://" + webviewPreloadUrl : null;
}

const BookmarkTypeahead = memo(
    ({ model, blockRef }: { model: WebViewModel; blockRef: React.RefObject<HTMLDivElement> }) => {
        const openBookmarksJson = () => {
            fireAndForget(async () => {
                const path = `${getApi().getConfigDir()}/presets/bookmarks.json`;
                const blockDef: BlockDef = { meta: { view: "preview", file: path } };
                await createBlock(blockDef, false, true);
                model.setTypeaheadOpen(false);
            });
        };
        return (
            <BlockHeaderSuggestionControl
                blockRef={blockRef}
                openAtom={model.typeaheadOpen}
                onClose={() => model.setTypeaheadOpen(false)}
                onSelect={(suggestion) => {
                    if (suggestion == null || suggestion.type != "url") return true;
                    model.loadUrl(suggestion["url:url"], "bookmark-typeahead");
                    return true;
                }}
                fetchSuggestions={model.fetchBookmarkSuggestions}
                placeholderText="Open Bookmark..."
            >
                <SuggestionControlNoData>
                    <div className="text-center">
                        <p className="text-lg font-bold text-gray-100">No Bookmarks Configured</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Edit your <code className="font-mono">bookmarks.json</code> file to configure bookmarks.
                        </p>
                        <button
                            onClick={openBookmarksJson}
                            className="mt-3 px-4 py-2 text-sm font-medium text-black bg-accent hover:bg-accenthover rounded-lg cursor-pointer"
                        >
                            Open bookmarks.json
                        </button>
                    </div>
                </SuggestionControlNoData>
                <SuggestionControlNoResults>
                    <div className="text-center">
                        <p className="text-sm text-gray-400">No matching bookmarks</p>
                        <button
                            onClick={openBookmarksJson}
                            className="mt-3 px-4 py-2 text-sm font-medium text-black bg-accent hover:bg-accenthover rounded-lg cursor-pointer"
                        >
                            Edit bookmarks.json
                        </button>
                    </div>
                </SuggestionControlNoResults>
            </BlockHeaderSuggestionControl>
        );
    }
);

interface WebViewProps {
    blockId: string;
    model: WebViewModel;
    onFailLoad?: (url: string) => void;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    initialSrc?: string;
}

const WebView = memo(({ model, onFailLoad, blockRef, initialSrc }: WebViewProps) => {
    const blockData = useAtomValue(model.blockAtom);
    const defaultUrl = useAtomValue(model.homepageUrl);
    const defaultSearchAtom = getSettingsKeyAtom("web:defaultsearch");
    const defaultSearch = useAtomValue(defaultSearchAtom);
    let metaUrl = blockData?.meta?.url || defaultUrl;
    metaUrl = model.ensureUrlScheme(metaUrl, defaultSearch);
    const metaUrlRef = useRef(metaUrl);
    const zoomFactor = useAtomValue(getBlockMetaKeyAtom(model.blockId, "web:zoom")) || 1;
    const partitionOverride = useAtomValueSafe(model.partitionOverride);
    const metaPartition = useAtomValue(getBlockMetaKeyAtom(model.blockId, "web:partition"));
    const webPartition = partitionOverride || metaPartition || undefined;
    const userAgentType = useAtomValue(model.userAgentType) || "default";

    let userAgent: string | undefined = undefined;
    if (userAgentType === "mobile:iphone") userAgent = USER_AGENT_IPHONE;
    else if (userAgentType === "mobile:android") userAgent = USER_AGENT_ANDROID;

    const searchProps = useSearch({ anchorRef: model.webviewRef, viewModel: model });
    const searchVal = useAtomValue<string>(searchProps.searchValue);
    const setSearchIndex = useSetAtom(searchProps.resultsIndex);
    const setNumSearchResults = useSetAtom(searchProps.resultsCount);

    searchProps.onSearch = useCallback((search: string) => {
        if (!globalStore.get(model.domReady)) return;
        try {
            if (search) model.webviewRef.current?.findInPage(search, { findNext: true });
            else model.webviewRef.current?.stopFindInPage("clearSelection");
        } catch (e) {
            console.error("Failed to search", e);
        }
    }, []);
    searchProps.onNext = useCallback(() => {
        if (!globalStore.get(model.domReady)) return;
        try {
            model.webviewRef.current?.findInPage(searchVal, { findNext: false, forward: true });
        } catch (e) {
            console.error("Failed to search next", e);
        }
    }, [searchVal]);
    searchProps.onPrev = useCallback(() => {
        if (!globalStore.get(model.domReady)) return;
        try {
            model.webviewRef.current?.findInPage(searchVal, { findNext: false, forward: false });
        } catch (e) {
            console.error("Failed to search prev", e);
        }
    }, [searchVal]);

    const onFoundInPage = useCallback((e: { result: { matches: number; activeMatchOrdinal: number } | null }) => {
        const result = e.result;
        if (!result) return;
        setNumSearchResults(result.matches);
        setSearchIndex(result.activeMatchOrdinal - 1);
    }, []);

    const [metaUrlInitial] = useState(initialSrc || metaUrl);
    const prevUserAgentTypeRef = useRef(userAgentType);
    const [webContentsId, setWebContentsId] = useState(null);
    const domReady = useAtomValue(model.domReady);
    const [errorText, setErrorText] = useState("");

    function setBgColor() {
        const webview = model.webviewRef.current;
        if (!webview) return;
        setTimeout(() => {
            webview
                .executeJavaScript(
                    `!!document.querySelector('meta[name="color-scheme"]') && document.querySelector('meta[name="color-scheme"]').content?.includes('dark') || false`
                )
                .then((hasDarkMode) => {
                    webview.style.backgroundColor = hasDarkMode ? "black" : "white";
                })
                .catch(() => {
                    webview.style.backgroundColor = "black";
                });
        }, 100);
    }

    useEffect(() => {
        return () => {
            globalStore.set(model.domReady, false);
        };
    }, []);

    useEffect(() => {
        if (model.webviewRef.current == null || !domReady) return;
        try {
            const wcId = model.webviewRef.current.getWebContentsId?.();
            if (wcId) {
                setWebContentsId(wcId);
                if (model.webviewRef.current.getZoomFactor() != zoomFactor) {
                    model.webviewRef.current.setZoomFactor(zoomFactor);
                }
            }
        } catch (e) {
            console.error("Failed to get webcontentsid / setzoomlevel (webview)", e);
        }
    }, [model.webviewRef.current, domReady, zoomFactor]);

    useEffect(() => {
        if (initialSrc) return;
        if (metaUrlRef.current != metaUrl) {
            metaUrlRef.current = metaUrl;
            model.loadUrl(metaUrl, "meta");
        }
    }, [metaUrl, initialSrc]);

    useEffect(() => {
        if (prevUserAgentTypeRef.current !== userAgentType && domReady && model.webviewRef.current) {
            let newUserAgent: string | undefined = undefined;
            if (userAgentType === "mobile:iphone") newUserAgent = USER_AGENT_IPHONE;
            else if (userAgentType === "mobile:android") newUserAgent = USER_AGENT_ANDROID;
            try {
                model.webviewRef.current.setUserAgent(newUserAgent || "");
            } catch {
                /* ignore */
            }
        }
        prevUserAgentTypeRef.current = userAgentType;
    }, [userAgentType, domReady]);

    useEffect(() => {
        const webview = model.webviewRef.current;
        if (!webview) return;

        const navigateListener = (e: { isMainFrame: boolean; url: string }) => {
            setErrorText("");
            if (e.isMainFrame) model.handleNavigate(e.url);
        };
        const newWindowHandler = (e: Event & { detail: { url: string } }) => {
            e.preventDefault();
            fireAndForget(() => openLink(e.detail.url, true));
        };
        const startLoadingHandler = () => {
            model.setRefreshIcon("xmark-large");
            model.setIsLoading(true);
            webview.style.backgroundColor = "transparent";
        };
        const stopLoadingHandler = () => {
            model.setRefreshIcon("rotate-right");
            model.setIsLoading(false);
            setBgColor();
        };
        const failLoadHandler = (e: { errorCode: number; validatedURL: string; errorDescription: string }) => {
            if (e.errorCode === -3) {
                console.warn("Suppressed ERR_ABORTED error", e);
            } else {
                const errorMessage = `Failed to load ${e.validatedURL}: ${e.errorDescription}`;
                console.error(errorMessage);
                setErrorText(errorMessage);
                if (onFailLoad) onFailLoad(model.webviewRef.current.getURL());
            }
        };
        const webviewFocus = () => {
            getApi().setWebviewFocus(webview.getWebContentsId());
            model.nodeModel.focusNode();
        };
        const webviewBlur = () => {
            getApi().setWebviewFocus(null);
        };
        const handleDomReady = () => {
            globalStore.set(model.domReady, true);
            setBgColor();
        };
        const handleMediaPlaying = () => {
            model.setMediaPlaying(true);
        };
        const handleMediaPaused = () => {
            model.setMediaPlaying(false);
        };
        const handleIpcMessage = (e: { channel: string; args: unknown[] }) => {
            if (e.channel === "wave-mouse-navigate") {
                const direction = e.args?.[0];
                if (direction === "back") model.goHistoryBack();
                else if (direction === "forward") model.goHistoryForward();
            }
        };

        webview.addEventListener("did-frame-navigate", navigateListener as unknown as EventListener);
        webview.addEventListener("did-navigate-in-page", navigateListener as unknown as EventListener);
        webview.addEventListener("did-navigate", navigateListener as unknown as EventListener);
        webview.addEventListener("did-start-loading", startLoadingHandler);
        webview.addEventListener("did-stop-loading", stopLoadingHandler);
        webview.addEventListener("new-window", newWindowHandler);
        webview.addEventListener("did-fail-load", failLoadHandler);
        webview.addEventListener("focus", webviewFocus);
        webview.addEventListener("blur", webviewBlur);
        webview.addEventListener("dom-ready", handleDomReady);
        webview.addEventListener("media-started-playing", handleMediaPlaying);
        webview.addEventListener("media-paused", handleMediaPaused);
        webview.addEventListener("found-in-page", onFoundInPage);
        webview.addEventListener("ipc-message", handleIpcMessage);

        return () => {
            webview.removeEventListener("did-frame-navigate", navigateListener as unknown as EventListener);
            webview.removeEventListener("did-navigate", navigateListener as unknown as EventListener);
            webview.removeEventListener("did-navigate-in-page", navigateListener as unknown as EventListener);
            webview.removeEventListener("new-window", newWindowHandler);
            webview.removeEventListener("did-fail-load", failLoadHandler);
            webview.removeEventListener("did-start-loading", startLoadingHandler);
            webview.removeEventListener("did-stop-loading", stopLoadingHandler);
            webview.removeEventListener("focus", webviewFocus);
            webview.removeEventListener("blur", webviewBlur);
            webview.removeEventListener("dom-ready", handleDomReady);
            webview.removeEventListener("media-started-playing", handleMediaPlaying);
            webview.removeEventListener("media-paused", handleMediaPaused);
            webview.removeEventListener("found-in-page", onFoundInPage);
            webview.removeEventListener("ipc-message", handleIpcMessage);
        };
    }, []);

    return (
        <Fragment>
            <webview
                id="webview"
                className="webview"
                ref={model.webviewRef}
                src={metaUrlInitial}
                data-blockid={model.blockId}
                data-webcontentsid={webContentsId}
                preload={getWebviewPreloadUrl()}
                // @ts-expect-error React typing vs Chromium webviewTag discrepancy
                allowpopups="true"
                partition={webPartition}
                useragent={userAgent}
            />
            {errorText && (
                <div className="webview-error">
                    <div>{errorText}</div>
                </div>
            )}
            <Search {...searchProps} />
            <BookmarkTypeahead model={model} blockRef={blockRef} />
        </Fragment>
    );
});

setWebViewComponent(WebView as ViewComponent);

export { WebView };
