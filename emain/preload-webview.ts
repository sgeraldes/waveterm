import { ipcRenderer } from "electron";

document.addEventListener("contextmenu", (event) => {
    console.log("contextmenu event", event);
    if (event.target == null) {
        return;
    }
    const targetElement = event.target as HTMLElement;
    if (targetElement.tagName === "IMG") {
        setTimeout(() => {
            if (event.defaultPrevented) {
                return;
            }
            event.preventDefault();
            const imgElem = targetElement as HTMLImageElement;
            const imageUrl = imgElem.src;
            ipcRenderer.send("webview-image-contextmenu", { src: imageUrl });
        }, 50);
        return;
    }
});

document.addEventListener("mousedown", (event) => {
    if (event.button === 3) {
        event.preventDefault();
        ipcRenderer.sendToHost("wave-mouse-navigate", "back");
    } else if (event.button === 4) {
        event.preventDefault();
        ipcRenderer.sendToHost("wave-mouse-navigate", "forward");
    }
});

console.log("loaded wave preload-webview.ts");
