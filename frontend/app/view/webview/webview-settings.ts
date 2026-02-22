import { openLink } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { WOS, globalStore } from "@/store/global";
import { fireAndForget } from "@/util/util";
import clsx from "clsx";
import { Atom, atom } from "jotai";
import type { WebViewModel } from "./webview-model";

export function buildViewTextAtom(self: WebViewModel): Atom<HeaderElem[]> {
    return atom((get) => {
        const homepageUrl = get(self.homepageUrl);
        const metaUrl = get(self.blockAtom)?.meta?.url;
        const currUrl = get(self.url);
        const urlWrapperClassName = get(self.urlWrapperClassName);
        const refreshIcon = get(self.refreshIcon);
        const mediaPlaying = get(self.mediaPlaying);
        const mediaMuted = get(self.mediaMuted);
        const url = currUrl ?? metaUrl ?? homepageUrl;
        const rtn: HeaderElem[] = [];
        if (get(self.hideNav)) {
            return rtn;
        }
        rtn.push({
            elemtype: "iconbutton",
            icon: "chevron-left",
            click: self.handleBack.bind(self),
            disabled: self.shouldDisableBackButton(),
        });
        rtn.push({
            elemtype: "iconbutton",
            icon: "chevron-right",
            click: self.handleForward.bind(self),
            disabled: self.shouldDisableForwardButton(),
        });
        rtn.push({
            elemtype: "iconbutton",
            icon: "house",
            click: self.handleHome.bind(self),
            disabled: self.shouldDisableHomeButton(),
        });
        const divChildren: HeaderElem[] = [];
        divChildren.push({
            elemtype: "input",
            value: url,
            ref: self.urlInputRef,
            className: "url-input",
            onChange: self.handleUrlChange.bind(self),
            onKeyDown: self.handleKeyDown.bind(self),
            onFocus: self.handleFocus.bind(self),
            onBlur: self.handleBlur.bind(self),
        });
        if (mediaPlaying) {
            divChildren.push({
                elemtype: "iconbutton",
                icon: mediaMuted ? "volume-slash" : "volume",
                click: self.handleMuteChange.bind(self),
            });
        }
        divChildren.push({
            elemtype: "iconbutton",
            icon: refreshIcon,
            click: self.handleRefresh.bind(self),
        });
        rtn.push({
            elemtype: "div",
            className: clsx("block-frame-div-url", urlWrapperClassName),
            onMouseOver: self.handleUrlWrapperMouseOver.bind(self),
            onMouseOut: self.handleUrlWrapperMouseOut.bind(self),
            children: divChildren,
        });
        return rtn;
    });
}

export function buildEndIconButtonsAtom(self: WebViewModel): Atom<IconButtonDecl[]> {
    return atom((get) => {
        if (get(self.hideNav)) {
            return null;
        }
        const url = get(self.url);
        const userAgentType = get(self.userAgentType);
        const buttons: IconButtonDecl[] = [];
        if (userAgentType === "mobile:iphone" || userAgentType === "mobile:android") {
            const mobileIcon = userAgentType === "mobile:iphone" ? "mobile-screen" : "mobile-screen-button";
            const mobileTitle =
                userAgentType === "mobile:iphone" ? "Mobile User Agent: iPhone" : "Mobile User Agent: Android";
            buttons.push({
                elemtype: "iconbutton",
                icon: mobileIcon,
                title: mobileTitle,
                click: () =>
                    fireAndForget(() =>
                        RpcApi.SetMetaCommand(TabRpcClient, {
                            oref: WOS.makeORef("block", self.blockId),
                            meta: { "web:useragenttype": null },
                        })
                    ),
            });
        }
        if (url != null && url != "") {
            buttons.push({
                elemtype: "iconbutton",
                icon: "arrow-up-right-from-square",
                title: "Open in Browser",
                click: () => fireAndForget(() => openLink(url, true)),
            });
        }
        buttons.push({
            elemtype: "iconbutton",
            icon: "bookmark",
            title: "Open Bookmarks (Cmd+O)",
            click: () => self.setTypeaheadOpen(true),
        });
        return buttons;
    });
}

export function buildWebviewSettingsMenu(model: WebViewModel): ContextMenuItem[] {
    const zoomSubMenu: ContextMenuItem[] = [];
    let curZoom = 1;
    if (globalStore.get(model.domReady)) {
        curZoom = model.webviewRef.current?.getZoomFactor() || 1;
    }
    const makeZoomFactorMenuItem = (label: string, factor: number): ContextMenuItem => ({
        label,
        type: "checkbox",
        click: () => model.setZoomFactor(factor),
        checked: curZoom == factor,
    });
    zoomSubMenu.push({ label: "Reset", click: () => model.setZoomFactor(null) });
    zoomSubMenu.push(makeZoomFactorMenuItem("25%", 0.25));
    zoomSubMenu.push(makeZoomFactorMenuItem("50%", 0.5));
    zoomSubMenu.push(makeZoomFactorMenuItem("70%", 0.7));
    zoomSubMenu.push(makeZoomFactorMenuItem("80%", 0.8));
    zoomSubMenu.push(makeZoomFactorMenuItem("90%", 0.9));
    zoomSubMenu.push(makeZoomFactorMenuItem("100%", 1));
    zoomSubMenu.push(makeZoomFactorMenuItem("110%", 1.1));
    zoomSubMenu.push(makeZoomFactorMenuItem("120%", 1.2));
    zoomSubMenu.push(makeZoomFactorMenuItem("130%", 1.3));
    zoomSubMenu.push(makeZoomFactorMenuItem("150%", 1.5));
    zoomSubMenu.push(makeZoomFactorMenuItem("175%", 1.75));
    zoomSubMenu.push(makeZoomFactorMenuItem("200%", 2));

    const curUserAgentType = globalStore.get(model.userAgentType) || "default";
    const userAgentSubMenu: ContextMenuItem[] = [
        {
            label: "Default",
            type: "checkbox",
            click: () =>
                fireAndForget(() =>
                    RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", model.blockId),
                        meta: { "web:useragenttype": null },
                    })
                ),
            checked: curUserAgentType === "default" || curUserAgentType === "",
        },
        {
            label: "Mobile: iPhone",
            type: "checkbox",
            click: () =>
                fireAndForget(() =>
                    RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", model.blockId),
                        meta: { "web:useragenttype": "mobile:iphone" },
                    })
                ),
            checked: curUserAgentType === "mobile:iphone",
        },
        {
            label: "Mobile: Android",
            type: "checkbox",
            click: () =>
                fireAndForget(() =>
                    RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", model.blockId),
                        meta: { "web:useragenttype": "mobile:android" },
                    })
                ),
            checked: curUserAgentType === "mobile:android",
        },
    ];

    const isNavHidden = globalStore.get(model.hideNav);
    return [
        { label: "Copy URL to Clipboard", click: () => model.copyUrlToClipboard() },
        {
            label: "Set Block Homepage",
            click: () => fireAndForget(() => model.setHomepageUrl(model.getUrl(), "block")),
        },
        {
            label: "Set Default Homepage",
            click: () => fireAndForget(() => model.setHomepageUrl(model.getUrl(), "global")),
        },
        { type: "separator" },
        { label: "User Agent Type", submenu: userAgentSubMenu },
        { type: "separator" },
        {
            label: isNavHidden ? "Un-Hide Navigation" : "Hide Navigation",
            click: () =>
                fireAndForget(() =>
                    RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("block", model.blockId),
                        meta: { "web:hidenav": !isNavHidden },
                    })
                ),
        },
        { label: "Set Zoom Factor", submenu: zoomSubMenu },
        {
            label: model.webviewRef.current?.isDevToolsOpened() ? "Close DevTools" : "Open DevTools",
            click: () => {
                if (model.webviewRef.current) {
                    if (model.webviewRef.current.isDevToolsOpened()) {
                        model.webviewRef.current.closeDevTools();
                    } else {
                        model.webviewRef.current.openDevTools();
                    }
                }
            },
        },
        { type: "separator" },
        { label: "Clear History", click: () => model.clearHistory() },
        {
            label: "Clear Cookies and Storage (All Web Widgets)",
            click: () => fireAndForget(() => model.clearCookiesAndStorage()),
        },
    ];
}
