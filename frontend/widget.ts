// Widget window entrypoint — renders a single popped-out block
// This is a lean version of wave.ts that doesn't need tab/workspace context.

import { getApi } from "@/store/global";
import { setKeyUtilPlatform } from "@/util/keyutil";
import { loadFonts } from "@/util/fontutil";

import "./app/app.scss";
import "./tailwindsetup.css";

const platform = getApi().getPlatform();

function getPopoutBlockId(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get("blockId") || params.get("popout");
}

function renderPlaceholder(container: HTMLElement, blockId: string | null) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;background:var(--main-bg-color, #1e1e1e);color:var(--main-text-color, #ccc);font-family:system-ui;";

    const title = document.createElement("div");
    title.style.cssText = "font-size:14px;font-weight:600;";
    title.textContent = "Widget Window";
    wrapper.appendChild(title);

    if (blockId) {
        const idElem = document.createElement("div");
        idElem.style.cssText = "font-size:12px;color:var(--secondary-text-color, #888);font-family:monospace;";
        idElem.textContent = blockId;
        wrapper.appendChild(idElem);
    }

    const msg = document.createElement("div");
    msg.style.cssText = "font-size:11px;color:var(--secondary-text-color, #666);max-width:300px;text-align:center;line-height:1.6;";
    msg.textContent = blockId
        ? "Block rendering in widget windows is being implemented. Close this window to return the block to its original position."
        : "No block ID provided.";
    wrapper.appendChild(msg);

    container.appendChild(wrapper);
}

async function initWidget() {
    const blockId = getPopoutBlockId();
    setKeyUtilPlatform(platform);
    loadFonts();

    if (blockId) {
        document.title = `Wave Widget — ${blockId.substring(0, 8)}`;
    }

    const container = document.getElementById("main");
    renderPlaceholder(container, blockId);
}

document.addEventListener("DOMContentLoaded", initWidget);
