import { BlockNodeModel } from "@/app/block/blocktypes";
import { getApi, getBlockMetaKeyAtom, getSettingsKeyAtom } from "@/app/store/global";
import { getSimpleControlShiftAtom } from "@/app/store/keymodel";
import { ObjectService } from "@/app/store/services";
import type { TabModel } from "@/app/store/tab-model";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { WOS, globalStore } from "@/store/global";
import { adaptFromReactOrNativeKeyEvent, checkKeyPressed } from "@/util/keyutil";
import { fireAndForget } from "@/util/util";
import type { WebviewTag } from "electron";
import { Atom, PrimitiveAtom, atom } from "jotai";
import * as React from "react";
import { buildEndIconButtonsAtom, buildViewTextAtom, buildWebviewSettingsMenu } from "./webview-settings";

let _webViewComponent: ViewComponent;
export function setWebViewComponent(component: ViewComponent) {
    _webViewComponent = component;
}

export class WebViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    tabModel: TabModel;
    noPadding?: Atom<boolean>;
    blockAtom: Atom<Block>;
    viewIcon: Atom<string | IconButtonDecl>;
    viewName: Atom<string>;
    viewText: Atom<HeaderElem[]>;
    url: PrimitiveAtom<string>;
    homepageUrl: Atom<string>;
    urlInputFocused: PrimitiveAtom<boolean>;
    isLoading: PrimitiveAtom<boolean>;
    urlWrapperClassName: PrimitiveAtom<string>;
    refreshIcon: PrimitiveAtom<string>;
    webviewRef: React.RefObject<WebviewTag>;
    urlInputRef: React.RefObject<HTMLInputElement>;
    nodeModel: BlockNodeModel;
    endIconButtons?: Atom<IconButtonDecl[]>;
    mediaPlaying: PrimitiveAtom<boolean>;
    mediaMuted: PrimitiveAtom<boolean>;
    modifyExternalUrl?: (url: string) => string;
    domReady: PrimitiveAtom<boolean>;
    hideNav: Atom<boolean>;
    searchAtoms?: SearchAtoms;
    typeaheadOpen: PrimitiveAtom<boolean>;
    partitionOverride: PrimitiveAtom<string> | null;
    userAgentType: Atom<string>;

    get viewComponent(): ViewComponent {
        return _webViewComponent;
    }

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.viewType = "web";
        this.blockId = blockId;
        this.noPadding = atom(true);
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.url = atom();
        const defaultUrlAtom = getSettingsKeyAtom("web:defaulturl");
        this.homepageUrl = atom((get) => {
            const defaultUrl = get(defaultUrlAtom);
            const pinnedUrl = get(this.blockAtom).meta.pinnedurl;
            return pinnedUrl ?? defaultUrl;
        });
        this.urlWrapperClassName = atom("");
        this.urlInputFocused = atom(false);
        this.isLoading = atom(false);
        this.refreshIcon = atom("rotate-right");
        this.viewIcon = atom("globe");
        this.viewName = atom("Web");
        this.urlInputRef = React.createRef<HTMLInputElement>();
        this.webviewRef = React.createRef<WebviewTag>();
        this.domReady = atom(false);
        this.hideNav = getBlockMetaKeyAtom(blockId, "web:hidenav");
        this.typeaheadOpen = atom(false);
        this.partitionOverride = null;
        this.userAgentType = getBlockMetaKeyAtom(blockId, "web:useragenttype");
        this.mediaPlaying = atom(false);
        this.mediaMuted = atom(false);
        this.viewText = buildViewTextAtom(this);
        this.endIconButtons = buildEndIconButtonsAtom(this);
    }

    shouldDisableBackButton() {
        try {
            return !this.webviewRef.current?.canGoBack();
        } catch {
            /* webview not ready */
        }
        return true;
    }

    shouldDisableForwardButton() {
        try {
            return !this.webviewRef.current?.canGoForward();
        } catch {
            /* webview not ready */
        }
        return true;
    }

    shouldDisableHomeButton() {
        try {
            const homepageUrl = globalStore.get(this.homepageUrl);
            return !homepageUrl || this.getUrl() === homepageUrl;
        } catch {
            /* webview not ready */
        }
        return true;
    }

    handleHome(e?: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.loadUrl(globalStore.get(this.homepageUrl), "home");
    }

    setMediaPlaying(isPlaying: boolean) {
        globalStore.set(this.mediaPlaying, isPlaying);
    }

    handleMuteChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            const newMutedVal = !this.webviewRef.current?.isAudioMuted();
            globalStore.set(this.mediaMuted, newMutedVal);
            this.webviewRef.current?.setAudioMuted(newMutedVal);
        } catch (err) {
            console.error("Failed to change mute value", err);
        }
    }

    setTypeaheadOpen(open: boolean) {
        globalStore.set(this.typeaheadOpen, open);
    }

    async fetchBookmarkSuggestions(
        query: string,
        reqContext: SuggestionRequestContext
    ): Promise<FetchSuggestionsResponse> {
        const result = await RpcApi.FetchSuggestionsCommand(TabRpcClient, {
            suggestiontype: "bookmark",
            query,
            widgetid: reqContext.widgetid,
            reqnum: reqContext.reqnum,
        });
        return result;
    }

    handleUrlWrapperMouseOver(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        const urlInputFocused = globalStore.get(this.urlInputFocused);
        if (e.type === "mouseover" && !urlInputFocused) {
            globalStore.set(this.urlWrapperClassName, "hovered");
        }
    }

    handleUrlWrapperMouseOut(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        const urlInputFocused = globalStore.get(this.urlInputFocused);
        if (e.type === "mouseout" && !urlInputFocused) {
            globalStore.set(this.urlWrapperClassName, "");
        }
    }

    handleBack(e?: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.webviewRef.current?.goBack();
    }

    handleForward(e?: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        this.webviewRef.current?.goForward();
    }

    goHistoryBack() {
        this.webviewRef.current?.goBack();
    }

    goHistoryForward() {
        this.webviewRef.current?.goForward();
    }

    handleRefresh(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.preventDefault();
        e.stopPropagation();
        try {
            if (this.webviewRef.current) {
                if (globalStore.get(this.isLoading)) {
                    this.webviewRef.current.stop();
                } else {
                    this.webviewRef.current.reload();
                }
            }
        } catch (err) {
            console.warn("handleRefresh catch", err);
        }
    }

    handleUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
        globalStore.set(this.url, event.target.value);
    }

    handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        const waveEvent = adaptFromReactOrNativeKeyEvent(event);
        if (checkKeyPressed(waveEvent, "Enter")) {
            const url = globalStore.get(this.url);
            this.loadUrl(url, "enter");
            this.urlInputRef.current?.blur();
            return;
        }
        if (checkKeyPressed(waveEvent, "Escape")) {
            this.webviewRef.current?.focus();
        }
    }

    handleFocus(event: React.FocusEvent<HTMLInputElement>) {
        globalStore.set(this.urlWrapperClassName, "focused");
        globalStore.set(this.urlInputFocused, true);
        this.urlInputRef.current.focus();
        event.target.select();
    }

    handleBlur() {
        globalStore.set(this.urlWrapperClassName, "");
        globalStore.set(this.urlInputFocused, false);
    }

    handleNavigate(url: string) {
        fireAndForget(() => ObjectService.UpdateObjectMeta(WOS.makeORef("block", this.blockId), { url }));
        globalStore.set(this.url, url);
        if (this.searchAtoms) {
            globalStore.set(this.searchAtoms.isOpen, false);
        }
    }

    ensureUrlScheme(url: string, searchTemplate: string) {
        if (url == null) {
            url = "";
        }
        if (/^(http|https|file):/.test(url)) {
            return url;
        }
        const isLocal = /^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(url.split("/")[0]);
        if (isLocal) {
            return `http://${url}`;
        }
        const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
        const isDomain = domainRegex.test(url.split("/")[0]);
        if (isDomain) {
            return `https://${url}`;
        }
        if (searchTemplate == null) {
            return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
        return searchTemplate.replace("{query}", encodeURIComponent(url));
    }

    loadUrl(newUrl: string, reason: string) {
        const defaultSearchAtom = getSettingsKeyAtom("web:defaultsearch");
        const searchTemplate = globalStore.get(defaultSearchAtom);
        const nextUrl = this.ensureUrlScheme(newUrl, searchTemplate);
        console.log("webview loadUrl", reason, nextUrl, "cur=", this.webviewRef.current.getURL());
        if (!this.webviewRef.current) {
            return;
        }
        if (this.webviewRef.current.getURL() != nextUrl) {
            fireAndForget(() => this.webviewRef.current.loadURL(nextUrl));
        }
        if (newUrl != nextUrl) {
            globalStore.set(this.url, nextUrl);
        }
    }

    loadUrlPromise(newUrl: string, reason: string): Promise<void> {
        const defaultSearchAtom = getSettingsKeyAtom("web:defaultsearch");
        const searchTemplate = globalStore.get(defaultSearchAtom);
        const nextUrl = this.ensureUrlScheme(newUrl, searchTemplate);
        console.log("webview loadUrlPromise", reason, nextUrl, "cur=", this.webviewRef.current?.getURL());
        if (!this.webviewRef.current) {
            return Promise.reject(new Error("WebView ref not available"));
        }
        if (newUrl != nextUrl) {
            globalStore.set(this.url, nextUrl);
        }
        if (this.webviewRef.current.getURL() != nextUrl) {
            return this.webviewRef.current.loadURL(nextUrl);
        }
        return Promise.resolve();
    }

    getUrl() {
        return globalStore.get(this.url);
    }

    setRefreshIcon(refreshIcon: string) {
        globalStore.set(this.refreshIcon, refreshIcon);
    }

    setIsLoading(isLoading: boolean) {
        globalStore.set(this.isLoading, isLoading);
    }

    async setHomepageUrl(url: string, scope: "global" | "block") {
        if (url != null && url != "") {
            switch (scope) {
                case "block":
                    await RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", this.blockId),
                        meta: { pinnedurl: url },
                    });
                    break;
                case "global":
                    await RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", this.blockId),
                        meta: { pinnedurl: "" },
                    });
                    await RpcApi.SetConfigCommand(TabRpcClient, { "web:defaulturl": url });
                    break;
            }
        }
    }

    giveFocus(): boolean {
        console.log("webview giveFocus");
        if (this.searchAtoms && globalStore.get(this.searchAtoms.isOpen)) {
            console.log("search is open, not giving focus");
            return true;
        }
        const ctrlShiftState = globalStore.get(getSimpleControlShiftAtom());
        if (ctrlShiftState) {
            const unsubFn = globalStore.sub(getSimpleControlShiftAtom(), () => {
                const state = globalStore.get(getSimpleControlShiftAtom());
                if (!state) {
                    unsubFn();
                    const isStillFocused = globalStore.get(this.nodeModel.isFocused);
                    if (isStillFocused) {
                        this.webviewRef.current?.focus();
                    }
                }
            });
            return false;
        }
        this.webviewRef.current?.focus();
        return true;
    }

    copyUrlToClipboard() {
        const url = this.getUrl();
        if (url != null && url != "") {
            fireAndForget(() => navigator.clipboard.writeText(url));
        }
    }

    clearHistory() {
        try {
            this.webviewRef.current?.clearHistory();
        } catch (err) {
            console.error("Failed to clear history", err);
        }
    }

    async clearCookiesAndStorage() {
        try {
            const webContentsId = this.webviewRef.current?.getWebContentsId();
            if (webContentsId) {
                await getApi().clearWebviewStorage(webContentsId);
            }
        } catch (err) {
            console.error("Failed to clear cookies and storage", err);
        }
    }

    keyDownHandler(e: WaveKeyboardEvent): boolean {
        if (checkKeyPressed(e, "Cmd:l")) {
            this.urlInputRef?.current?.focus();
            this.urlInputRef?.current?.select();
            return true;
        }
        if (checkKeyPressed(e, "Cmd:r")) {
            this.webviewRef.current?.reload();
            return true;
        }
        if (checkKeyPressed(e, "Cmd:ArrowLeft")) {
            this.handleBack(null);
            return true;
        }
        if (checkKeyPressed(e, "Cmd:ArrowRight")) {
            this.handleForward(null);
            return true;
        }
        if (checkKeyPressed(e, "Cmd:o")) {
            const curVal = globalStore.get(this.typeaheadOpen);
            globalStore.set(this.typeaheadOpen, !curVal);
            return true;
        }
        return false;
    }

    setZoomFactor(factor: number | null) {
        if (factor != null && factor < 0.1) {
            factor = 0.1;
        }
        if (factor != null && factor > 5) {
            factor = 5;
        }
        const domReady = globalStore.get(this.domReady);
        if (!domReady) {
            return;
        }
        this.webviewRef.current?.setZoomFactor(factor || 1);
        RpcApi.SetMetaCommand(TabRpcClient, {
            oref: WOS.makeORef("block", this.blockId),
            meta: { "web:zoom": factor },
        });
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        return buildWebviewSettingsMenu(this);
    }
}
