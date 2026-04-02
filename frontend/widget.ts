// Widget window entrypoint — renders a single popped-out block.
// This is a lean version of wave.ts that doesn't need tab/workspace context.
// It initializes WPS/WOS directly, loads the block, and renders it via React.

import { RpcApi } from "@/app/store/wshclientapi";
import { initWshrpc, TabRpcClient } from "@/app/store/wshrpcutil";
import { getFileSubject, waveEventSubscribe } from "@/app/store/wps";
import { atoms, getApi, globalStore, initGlobal } from "@/store/global";
import * as WOS from "@/store/wos";
import { loadFonts } from "@/util/fontutil";
import { setKeyUtilPlatform } from "@/util/keyutil";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import debug from "debug";

import "./app/app.scss";
import "./tailwindsetup.css";

const dlog = debug("wave:widget");
const platform = getApi().getPlatform();

function getPopoutBlockId(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get("blockId") || params.get("popout");
}

function renderError(container: HTMLElement, message: string) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
        "display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;background:var(--main-bg-color, #1e1e1e);color:var(--main-text-color, #ccc);font-family:system-ui;";

    const title = document.createElement("div");
    title.style.cssText = "font-size:14px;font-weight:600;";
    title.textContent = "Widget Error";
    wrapper.appendChild(title);

    const msg = document.createElement("div");
    msg.style.cssText =
        "font-size:11px;color:var(--secondary-text-color, #888);max-width:400px;text-align:center;line-height:1.6;";
    msg.textContent = message;
    wrapper.appendChild(msg);

    container.appendChild(wrapper);
}

async function initWidget() {
    const blockId = getPopoutBlockId();
    setKeyUtilPlatform(platform);
    loadFonts();

    const container = document.getElementById("main");
    if (!blockId) {
        renderError(container, "No block ID provided in query parameters.");
        return;
    }

    document.title = `Wave Widget — ${blockId.substring(0, 8)}`;

    try {
        // Step 1: Initialize global state with minimal options.
        // We use a synthetic tabId and windowId since widgets don't have these contexts.
        const globalInitOpts: GlobalInitOptions = {
            tabId: "",
            clientId: "",
            windowId: "",
            platform,
            environment: "renderer",
        };
        initGlobal(globalInitOpts);

        // Step 2: Connect to wavesrv websocket via WPS.
        const routeId = "widget:" + blockId;
        dlog("connecting wshrpc with routeId:", routeId);
        const ws = initWshrpc(routeId);

        // Wait for the websocket to be ready (poll with timeout).
        // initWshrpc already calls connectNow internally.
        await waitForWSOpen(ws, 5000);
        dlog("websocket connected");

        // Step 3: Subscribe to waveobj:update events so WOS cache stays in sync.
        waveEventSubscribe({
            eventType: "waveobj:update",
            handler: (event) => {
                const update: WaveObjUpdate = event.data;
                WOS.updateWaveObject(update);
            },
        });

        // Subscribe to blockfile events for terminal data streaming.
        waveEventSubscribe({
            eventType: "blockfile",
            handler: (event) => {
                const fileData: WSFileEventData = event.data;
                const fileSubject = getFileSubject(fileData.zoneid, fileData.filename);
                if (fileSubject != null) {
                    fileSubject.next(fileData);
                }
            },
        });

        // Step 4: Load config so settings atoms work (needed for theming, font sizes, etc.)
        const fullConfig = await RpcApi.GetFullConfigCommand(TabRpcClient);
        globalStore.set(atoms.fullConfigAtom, fullConfig);
        dlog("config loaded");

        // Step 5: Load the block data from WOS.
        const blockData = await WOS.loadAndPinWaveObject<Block>(WOS.makeORef("block", blockId));
        if (!blockData) {
            renderError(container, `Block ${blockId} not found.`);
            return;
        }
        dlog("block loaded", blockData.meta?.view);

        // Step 6: Render the React widget app.
        const { WidgetApp } = await import("./widget-app");
        const root = createRoot(container);
        const reactElem = createElement(WidgetApp, { blockId, blockData });
        root.render(reactElem);
        dlog("widget rendered");
    } catch (e) {
        console.error("Widget init error:", e);
        getApi().sendLog("Widget init error: " + e.message + "\n" + e.stack);
        renderError(container, `Failed to initialize widget: ${e.message}`);
    }
}

function waitForWSOpen(ws: any, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        function check() {
            if (ws.open) {
                resolve();
                return;
            }
            if (Date.now() - start > timeoutMs) {
                reject(new Error("WebSocket connection timeout"));
                return;
            }
            setTimeout(check, 50);
        }
        check();
    });
}

document.addEventListener("DOMContentLoaded", initWidget);
