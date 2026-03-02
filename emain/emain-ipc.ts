// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import * as electron from "electron";
import { FastAverageColor } from "fast-average-color";
import fs from "fs";
import * as child_process from "node:child_process";
import * as path from "path";
import { PNG } from "pngjs";
import { Readable } from "stream";
import { RpcApi } from "../frontend/app/store/wshclientapi";
import { getWebServerEndpoint } from "../frontend/util/endpoints";
import * as keyutil from "../frontend/util/keyutil";
import { fireAndForget, parseDataUrl } from "../frontend/util/util";
import { incrementTermCommandsRun } from "./emain-activity";
import { callWithOriginalXdgCurrentDesktopAsync, unamePlatform } from "./emain-platform";
import { getWaveTabViewByWebContentsId } from "./emain-tabview";
import { handleCtrlShiftState } from "./emain-util";
import { getWaveVersion } from "./emain-wavesrv";
import { createNewWaveWindow, focusedWaveWindow, getWaveWindowByWebContentsId } from "./emain-window";
import { ElectronWshClient } from "./emain-wsh";

/**
 * IPC Handler Naming Convention:
 * - Channel names use kebab-case: "get-client-data", "open-external-link"
 * - Handler names use camelCase in code: handleGetClientData(), handleOpenExternalLink()
 * - Event emitters (ipcMain.on) typically don't return values (use event.returnValue for sync)
 * - Request/response (ipcMain.handle) return Promise<T>
 */

const electronApp = electron.app;

let webviewFocusId: number = null;
let webviewKeys: string[] = [];

type UrlInSessionResult = {
    stream: Readable;
    mimeType: string;
    fileName: string;
};

function getSingleHeaderVal(headers: Record<string, string | string[]>, key: string): string {
    const val = headers[key];
    if (val == null) {
        return null;
    }
    if (Array.isArray(val)) {
        return val[0];
    }
    return val;
}

function cleanMimeType(mimeType: string): string {
    if (mimeType == null) {
        return null;
    }
    const parts = mimeType.split(";");
    return parts[0].trim();
}

function getFileNameFromUrl(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
        return filename;
    } catch (e) {
        return null;
    }
}

function getUrlInSession(session: Electron.Session, url: string): Promise<UrlInSessionResult> {
    return new Promise((resolve, reject) => {
        if (url.startsWith("data:")) {
            try {
                const parsed = parseDataUrl(url);
                const buffer = Buffer.from(parsed.buffer);
                const readable = Readable.from(buffer);
                resolve({ stream: readable, mimeType: parsed.mimeType, fileName: "image" });
            } catch (err) {
                return reject(err);
            }
            return;
        }
        const request = electron.net.request({
            url,
            method: "GET",
            session,
        });
        const readable = new Readable({
            read() {},
        });
        request.on("response", (response) => {
            const statusCode = response.statusCode;
            if (statusCode < 200 || statusCode >= 300) {
                readable.destroy();
                request.abort();
                reject(new Error(`HTTP request failed with status ${statusCode}: ${response.statusMessage || ""}`));
                return;
            }

            const mimeType = cleanMimeType(getSingleHeaderVal(response.headers, "content-type"));
            const fileName = getFileNameFromUrl(url) || "image";
            response.on("data", (chunk) => {
                readable.push(chunk);
            });
            response.on("end", () => {
                readable.push(null);
                resolve({ stream: readable, mimeType, fileName });
            });
            response.on("error", (err) => {
                readable.destroy(err);
                reject(err);
            });
        });
        request.on("error", (err) => {
            readable.destroy(err);
            reject(err);
        });
        request.end();
    });
}

function saveImageFileWithNativeDialog(defaultFileName: string, mimeType: string, readStream: Readable) {
    if (defaultFileName == null || defaultFileName == "") {
        defaultFileName = "image";
    }
    const ww = focusedWaveWindow;
    if (ww == null) {
        return;
    }
    const mimeToExtension: { [key: string]: string } = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/bmp": "bmp",
        "image/tiff": "tiff",
        "image/heic": "heic",
        "image/svg+xml": "svg",
    };
    function addExtensionIfNeeded(fileName: string, mimeType: string): string {
        const extension = mimeToExtension[mimeType];
        if (!path.extname(fileName) && extension) {
            return `${fileName}.${extension}`;
        }
        return fileName;
    }
    defaultFileName = addExtensionIfNeeded(defaultFileName, mimeType);
    electron.dialog
        .showSaveDialog(ww, {
            title: "Save Image",
            defaultPath: defaultFileName,
            filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "heic"] }],
        })
        .then((file) => {
            if (file.canceled) {
                return;
            }
            const writeStream = fs.createWriteStream(file.filePath);
            readStream.pipe(writeStream);
            writeStream.on("finish", () => {
                console.log("saved file", file.filePath);
            });
            writeStream.on("error", (err) => {
                console.log("error saving file (writeStream)", err);
                readStream.destroy();
            });
            readStream.on("error", (err) => {
                console.error("error saving file (readStream)", err);
                writeStream.destroy();
            });
        })
        .catch((err) => {
            console.log("error trying to save file", err);
        });
}

export function initIpcHandlers() {
    /**
     * Opens an external URL in the default browser.
     * Uses the system's default XDG_CURRENT_DESKTOP for better desktop environment compatibility.
     * @param event - IPC event object (unused)
     * @param url - The URL to open in the default browser
     * @returns void - This is a fire-and-forget operation
     */
    electron.ipcMain.on("open-external", (event, url) => {
        if (url && typeof url === "string") {
            fireAndForget(() =>
                callWithOriginalXdgCurrentDesktopAsync(() =>
                    electron.shell.openExternal(url).catch((err) => {
                        console.error(`Failed to open URL ${url}:`, err);
                    })
                )
            );
        } else {
            console.error("Invalid URL received in open-external event:", url);
        }
    });

    /**
     * Displays a context menu for an image in a webview.
     * Currently shows a "Save Image" option that downloads the image from its URL.
     * @param event - IPC event object with sender information
     * @param payload - Menu payload
     * @param payload.src - The image source URL (can be http/https or data: URI)
     * @returns void
     */
    electron.ipcMain.on("webview-image-contextmenu", (event: electron.IpcMainEvent, payload: { src: string }) => {
        // Validate input
        if (!payload || typeof payload.src !== "string" || !payload.src.trim()) {
            console.error("webview-image-contextmenu: invalid payload or src");
            return;
        }

        const menu = new electron.Menu();
        const win = getWaveWindowByWebContentsId(event.sender.hostWebContents.id);
        if (win == null) {
            console.error("webview-image-contextmenu: no window found for webContentsId", event.sender.hostWebContents.id);
            return;
        }
        menu.append(
            new electron.MenuItem({
                label: "Save Image",
                click: () => {
                    const resultP = getUrlInSession(event.sender.session, payload.src);
                    resultP
                        .then((result) => {
                            saveImageFileWithNativeDialog(result.fileName, result.mimeType, result.stream);
                        })
                        .catch((e) => {
                            console.error("webview-image-contextmenu: error getting image", e);
                        });
                },
            })
        );
        menu.popup();
    });

    /**
     * Initiates a file download from a wsh:// URI.
     * Converts the wsh:// path to a streaming URL and triggers the browser's download.
     * @param event - IPC event object with sender information
     * @param payload - Download request payload
     * @param payload.filePath - The wsh:// URI of the file to download (validated)
     * @returns void
     * @throws {Error} If filePath is invalid or not a wsh:// URI
     */
    electron.ipcMain.on("download", async (event, payload) => {
        const { filePath } = payload;

        // SECURITY: Validate wsh:// URI format to prevent injection attacks
        if (typeof filePath !== "string" || filePath.trim() === "") {
            console.error("download: invalid file path - empty or not a string");
            throw new Error("Invalid file path");
        }

        // Validate wsh:// URI format
        if (!filePath.startsWith("wsh://")) {
            console.error("download: invalid file path - must be wsh:// URI format:", filePath);
            throw new Error("Invalid file path: must be wsh:// URI format");
        }

        // Parse URI to prevent injection attacks
        try {
            const parsedUri = new URL(filePath);
            if (parsedUri.protocol !== "wsh:") {
                console.error("download: invalid protocol:", parsedUri.protocol);
                throw new Error("Invalid file path: must use wsh:// protocol");
            }
        } catch (err) {
            console.error("download: malformed URI:", filePath, err);
            throw new Error("Invalid file path: malformed URI");
        }

        // Construct streaming URL with validated path
        // Backend will perform additional validation via connparse.ParseURIAndReplaceCurrentHost
        const baseName = encodeURIComponent(path.basename(filePath));
        const streamingUrl =
            getWebServerEndpoint() + "/wave/stream-file/" + baseName + "?path=" + encodeURIComponent(filePath);
        event.sender.downloadURL(streamingUrl);
    });

    /**
     * Gets the cursor position relative to the current tab view.
     * Returns coordinates as { x, y } relative to the tab view's bounds.
     * @param event - IPC event object (synchronous, uses event.returnValue)
     * @returns Electron.Point | null - Cursor position relative to tab view, or null on error
     */
    electron.ipcMain.on("get-cursor-point", (event) => {
        try {
            const tabView = getWaveTabViewByWebContentsId(event.sender.id);
            if (tabView == null) {
                console.error("get-cursor-point: no tabView found for webContentsId", event.sender.id);
                event.returnValue = null;
                return;
            }
            const screenPoint = electron.screen.getCursorScreenPoint();
            const windowRect = tabView.getBounds();
            const retVal: Electron.Point = {
                x: screenPoint.x - windowRect.x,
                y: screenPoint.y - windowRect.y,
            };
            event.returnValue = retVal;
        } catch (err) {
            console.error("get-cursor-point: error", err);
            event.returnValue = null;
        }
    });

    /**
     * Captures a screenshot of the current tab view.
     * @param event - IPC event object with sender information
     * @param rect - Optional rectangle to capture (x, y, width, height). If null, captures entire page.
     * @returns Promise<string> - Data URI containing the PNG screenshot (data:image/png;base64,...)
     * @throws {Error} If rect parameters are invalid or tab view not found
     */
    electron.ipcMain.handle("capture-screenshot", async (event, rect) => {
        try {
            // Validate rect parameter
            if (rect && typeof rect === "object") {
                if (rect.x != null && (typeof rect.x !== "number" || !Number.isFinite(rect.x))) {
                    throw new Error("Invalid rect.x: must be a finite number");
                }
                if (rect.y != null && (typeof rect.y !== "number" || !Number.isFinite(rect.y))) {
                    throw new Error("Invalid rect.y: must be a finite number");
                }
                if (rect.width != null && (typeof rect.width !== "number" || !Number.isFinite(rect.width) || rect.width < 0)) {
                    throw new Error("Invalid rect.width: must be a non-negative finite number");
                }
                if (rect.height != null && (typeof rect.height !== "number" || !Number.isFinite(rect.height) || rect.height < 0)) {
                    throw new Error("Invalid rect.height: must be a non-negative finite number");
                }
            }

            const tabView = getWaveTabViewByWebContentsId(event.sender.id);
            if (!tabView) {
                throw new Error("No tab view found for the given webContents id");
            }
            const image = await tabView.webContents.capturePage(rect);
            const base64String = image.toPNG().toString("base64");
            return `data:image/png;base64,${base64String}`;
        } catch (err) {
            console.error("capture-screenshot: error", err);
            throw err;
        }
    });

    /**
     * Gets an environment variable value from the main process.
     * @param event - IPC event object (synchronous, uses event.returnValue)
     * @param varName - Name of the environment variable to retrieve
     * @returns string | null - Environment variable value or null if not found
     */
    electron.ipcMain.on("get-env", (event, varName) => {
        try {
            // Validate varName
            if (typeof varName !== "string" || !varName.trim()) {
                console.error("get-env: invalid varName - must be non-empty string");
                event.returnValue = null;
                return;
            }
            event.returnValue = process.env[varName] ?? null;
        } catch (err) {
            console.error("get-env: error", err);
            event.returnValue = null;
        }
    });

    /**
     * Gets Wave Terminal version information for the About modal.
     * @param event - IPC event object (synchronous, uses event.returnValue)
     * @returns AboutModalDetails | null - Version details or null on error
     */
    electron.ipcMain.on("get-about-modal-details", (event) => {
        try {
            event.returnValue = getWaveVersion() as AboutModalDetails;
        } catch (err) {
            console.error("get-about-modal-details: error", err);
            event.returnValue = null;
        }
    });

    /**
     * Gets the current zoom factor for the sender's webContents.
     * @param event - IPC event object (synchronous, uses event.returnValue)
     * @returns number - Current zoom factor (1.0 = 100%), defaults to 1.0 on error
     */
    electron.ipcMain.on("get-zoom-factor", (event) => {
        try {
            if (!event.sender || event.sender.isDestroyed()) {
                console.error("get-zoom-factor: sender is destroyed or invalid");
                event.returnValue = 1.0;
                return;
            }
            event.returnValue = event.sender.getZoomFactor();
        } catch (err) {
            console.error("get-zoom-factor: error", err);
            event.returnValue = 1.0;
        }
    });

    const hasBeforeInputRegisteredMap = new Map<number, boolean>();

    /**
     * Sets the focused webview and registers key event handlers.
     * When a webview is focused, certain keys (registered via register-global-webview-keys)
     * will be intercepted and re-injected into the parent window.
     * @param event - IPC event object with parent webContents
     * @param focusedId - WebContents ID of the focused webview, or null to clear focus
     * @returns void
     */
    electron.ipcMain.on("webview-focus", (event: Electron.IpcMainEvent, focusedId: number) => {
        try {
            // Validate focusedId
            if (focusedId != null && (typeof focusedId !== "number" || !Number.isFinite(focusedId) || focusedId < 0)) {
                console.error("webview-focus: invalid focusedId - must be null or non-negative finite number");
                return;
            }

            webviewFocusId = focusedId;
            console.log("webview-focus", focusedId);
            if (focusedId == null) {
                return;
            }
            const parentWc = event.sender;
            if (!parentWc || parentWc.isDestroyed()) {
                console.error("webview-focus: parent webContents is destroyed");
                webviewFocusId = null;
                return;
            }
            const webviewWc = electron.webContents.fromId(focusedId);
            if (webviewWc == null) {
                console.error("webview-focus: webview webContents not found for id", focusedId);
                webviewFocusId = null;
                return;
            }
            if (!hasBeforeInputRegisteredMap.get(focusedId)) {
                hasBeforeInputRegisteredMap.set(focusedId, true);
                webviewWc.on("before-input-event", (e, input) => {
                    let waveEvent = keyutil.adaptFromElectronKeyEvent(input);
                    handleCtrlShiftState(parentWc, waveEvent);
                    if (webviewFocusId != focusedId) {
                        return;
                    }
                    if (input.type != "keyDown") {
                        return;
                    }
                    for (let keyDesc of webviewKeys) {
                        if (keyutil.checkKeyPressed(waveEvent, keyDesc)) {
                            e.preventDefault();
                            parentWc.send("reinject-key", waveEvent);
                            console.log("webview reinject-key", keyDesc);
                            return;
                        }
                    }
                });
                webviewWc.on("destroyed", () => {
                    hasBeforeInputRegisteredMap.delete(focusedId);
                });
            }
        } catch (err) {
            console.error("webview-focus: error", err);
            webviewFocusId = null;
        }
    });

    /**
     * Registers keyboard shortcuts that should be intercepted from webviews.
     * Keys registered here will be captured and re-injected into the parent window
     * when a webview has focus (see webview-focus handler).
     * @param event - IPC event object (unused)
     * @param keys - Array of key descriptors (e.g., ["Cmd+T", "Ctrl+W"])
     * @returns void
     */
    electron.ipcMain.on("register-global-webview-keys", (event, keys: string[]) => {
        try {
            // Validate keys parameter
            if (keys != null && !Array.isArray(keys)) {
                console.error("register-global-webview-keys: keys must be an array or null");
                webviewKeys = [];
                return;
            }
            // Validate all elements are strings
            if (keys != null && keys.some(k => typeof k !== "string")) {
                console.error("register-global-webview-keys: all keys must be strings");
                webviewKeys = [];
                return;
            }
            webviewKeys = keys ?? [];
        } catch (err) {
            console.error("register-global-webview-keys: error", err);
            webviewKeys = [];
        }
    });

    /**
     * Enables keyboard chord mode for the current tab view.
     * In chord mode, the next key event is interpreted as part of a key sequence.
     * @param event - IPC event object (synchronous, returns null)
     * @returns void - Sets event.returnValue to null
     */
    electron.ipcMain.on("set-keyboard-chord-mode", (event) => {
        try {
            event.returnValue = null;
            const tabView = getWaveTabViewByWebContentsId(event.sender.id);
            if (!tabView) {
                console.error("set-keyboard-chord-mode: no tabView found for webContentsId", event.sender.id);
                return;
            }
            tabView.setKeyboardChordMode(true);
        } catch (err) {
            console.error("set-keyboard-chord-mode: error", err);
            event.returnValue = null;
        }
    });

    const fac = new FastAverageColor();
    /**
     * Updates the window controls overlay color on Windows/Linux.
     * Captures a screenshot of the title bar area, calculates the average color,
     * and updates the overlay to match (for visual consistency with custom title bars).
     * @param event - IPC event object with sender information
     * @param rect - Rectangle defining the overlay area (left, top, width, height)
     * @returns void - Silently ignores "display surface not available" errors
     */
    electron.ipcMain.on("update-window-controls-overlay", async (event, rect: Dimensions) => {
        if (unamePlatform === "darwin") return;
        try {
            // Validate rect parameter
            if (!rect || typeof rect !== "object") {
                console.error("update-window-controls-overlay: rect must be an object");
                return;
            }
            if (typeof rect.left !== "number" || typeof rect.top !== "number" ||
                typeof rect.height !== "number" || typeof rect.width !== "number") {
                console.error("update-window-controls-overlay: rect properties must be numbers");
                return;
            }
            if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
                !Number.isFinite(rect.height) || !Number.isFinite(rect.width)) {
                console.error("update-window-controls-overlay: rect properties must be finite");
                return;
            }
            if (rect.height < 0 || rect.width < 0) {
                console.error("update-window-controls-overlay: rect dimensions must be non-negative");
                return;
            }

            const fullConfig = await RpcApi.GetFullConfigCommand(ElectronWshClient);
            if (fullConfig?.settings?.["window:nativetitlebar"] && unamePlatform !== "win32") return;

            if (!event.sender || event.sender.isDestroyed()) {
                console.error("update-window-controls-overlay: sender is destroyed");
                return;
            }

            const zoomFactor = event.sender.getZoomFactor();
            const electronRect: Electron.Rectangle = {
                x: rect.left * zoomFactor,
                y: rect.top * zoomFactor,
                height: rect.height * zoomFactor,
                width: rect.width * zoomFactor,
            };
            const overlay = await event.sender.capturePage(electronRect);
            const overlayBuffer = overlay.toPNG();
            const png = PNG.sync.read(overlayBuffer);
            const color = fac.prepareResult(fac.getColorFromArray4(png.data));
            const ww = getWaveWindowByWebContentsId(event.sender.id);
            if (!ww || ww.isDestroyed()) {
                console.error("update-window-controls-overlay: window not found or destroyed");
                return;
            }
            ww.setTitleBarOverlay({
                color: unamePlatform === "linux" ? color.rgba : "#00000000",
                symbolColor: color.isDark ? "white" : "black",
            });
        } catch (e) {
            // Silently ignore "display surface not available" - expected during rapid tab switching
            const errMsg = e instanceof Error ? e.message : String(e);
            if (!errMsg.includes("display surface not available")) {
                console.error("Error updating window controls overlay:", e);
            }
        }
    });

    /**
     * Opens macOS Quick Look preview for a file.
     * Only available on macOS. Uses /usr/bin/qlmanage to display the preview.
     * @param event - IPC event object (unused)
     * @param filePath - Absolute path to the file to preview
     * @returns void - macOS only, no-op on other platforms
     */
    electron.ipcMain.on("quicklook", (event, filePath: string) => {
        if (unamePlatform !== "darwin") return;

        // Validate filePath
        if (typeof filePath !== "string" || !filePath.trim()) {
            console.error("quicklook: invalid filePath - must be non-empty string");
            return;
        }

        // Note: execFile is already secure - it does not use shell
        child_process.execFile("/usr/bin/qlmanage", ["-p", filePath], (error, stdout, stderr) => {
            if (error) {
                console.error(`quicklook: error opening Quick Look for ${filePath}:`, error);
            }
        });
    });

    /**
     * Clears all storage data (cookies, localStorage, etc.) for a webview.
     * @param event - IPC event object (unused)
     * @param webContentsId - The WebContents ID of the webview to clear
     * @returns Promise<void> - Resolves when storage is cleared
     * @throws {Error} If webContentsId is invalid or webContents not found
     */
    electron.ipcMain.handle("clear-webview-storage", async (event, webContentsId: number) => {
        try {
            // Validate webContentsId
            if (typeof webContentsId !== "number" || !Number.isFinite(webContentsId) || webContentsId < 0) {
                const error = new Error("Invalid webContentsId: must be a non-negative finite number");
                console.error("clear-webview-storage:", error.message);
                throw error;
            }

            const wc = electron.webContents.fromId(webContentsId);
            if (!wc) {
                const error = new Error(`WebContents not found for id: ${webContentsId}`);
                console.error("clear-webview-storage:", error.message);
                throw error;
            }
            if (!wc.session) {
                const error = new Error(`WebContents session not available for id: ${webContentsId}`);
                console.error("clear-webview-storage:", error.message);
                throw error;
            }
            await wc.session.clearStorageData();
            console.log("clear-webview-storage: cleared cookies and storage for webContentsId:", webContentsId);
        } catch (e) {
            console.error("clear-webview-storage: failed:", e);
            throw e;
        }
    });

    /**
     * Opens a file or directory in the system's default application.
     * Security: Blocks UNC paths, paths outside home directory, and validates existence.
     * @param event - IPC event object (unused)
     * @param filePath - Path to open (can start with ~, will be resolved)
     * @returns Promise<string> - Empty string on success, error message on failure
     */
    electron.ipcMain.handle("open-native-path", async (event, filePath: string) => {
        console.log("open-native-path", filePath);

        // SECURITY: Properly expand tilde to home directory
        if (filePath.startsWith("~")) {
            filePath = path.join(electronApp.getPath("home"), filePath.slice(1));
        }

        // SECURITY: Resolve to absolute path (prevents path traversal)
        const resolvedPath = path.resolve(filePath);

        // SECURITY: Block UNC paths on Windows to prevent network attacks
        if (process.platform === "win32" && /^[\\/]{2}[^\\/]/.test(resolvedPath)) {
            console.warn("open-native-path: blocked UNC path:", resolvedPath);
            return "UNC paths not allowed";
        }

        // SECURITY: Validate path exists and is accessible
        try {
            await fs.promises.access(resolvedPath, fs.constants.R_OK);
        } catch {
            console.warn("open-native-path: path does not exist or is not accessible:", resolvedPath);
            return "Path does not exist or is not accessible";
        }

        // SECURITY: Block paths outside home directory
        const homeDir = electronApp.getPath("home");
        if (!resolvedPath.startsWith(homeDir)) {
            console.warn("open-native-path: blocked path outside home directory:", resolvedPath);
            return "Path outside home directory not allowed";
        }

        let excuse = "";
        await callWithOriginalXdgCurrentDesktopAsync(async () => {
            excuse = await electron.shell.openPath(resolvedPath);
            if (excuse) console.error(`Failed to open ${resolvedPath} in native application: ${excuse}`);
        });
        return excuse;
    });

    /**
     * Sets the initialization status of a tab view.
     * "ready" - Tab DOM is loaded, ready to receive wave-init
     * "wave-ready" - Tab has completed wave initialization and is fully ready
     * @param event - IPC event object with sender information
     * @param status - Initialization status ("ready" or "wave-ready")
     * @returns void
     */
    electron.ipcMain.on("set-window-init-status", (event, status: "ready" | "wave-ready") => {
        try {
            // Validate status parameter
            if (status !== "ready" && status !== "wave-ready") {
                console.error("set-window-init-status: invalid status - must be 'ready' or 'wave-ready'");
                return;
            }

            const tabView = getWaveTabViewByWebContentsId(event.sender.id);
            if (tabView != null && tabView.initResolve != null) {
                if (status === "ready") {
                    tabView.initResolve();
                    if (tabView.savedInitOpts) {
                        console.log("set-window-init-status: savedInitOpts calling wave-init", tabView.waveTabId);
                        tabView.webContents.send("wave-init", tabView.savedInitOpts);
                    }
                } else if (status === "wave-ready") {
                    if (tabView.waveReadyResolve) {
                        tabView.waveReadyResolve();
                    } else {
                        console.error("set-window-init-status: waveReadyResolve not available for tabView", tabView.waveTabId);
                    }
                }
                return;
            }

            console.log("set-window-init-status: no window found for webContentsId", event.sender.id);
        } catch (err) {
            console.error("set-window-init-status: error", err);
        }
    });

    /**
     * Logs a message from the frontend to the main process console.
     * Useful for debugging renderer process issues in the main log.
     * @param event - IPC event object (unused)
     * @param logStr - The log message to output
     * @returns void
     */
    electron.ipcMain.on("fe-log", (event, logStr: string) => {
        try {
            // Validate logStr
            if (typeof logStr !== "string") {
                console.error("fe-log: logStr must be a string");
                return;
            }
            console.log("fe-log", logStr);
        } catch (err) {
            console.error("fe-log: error", err);
        }
    });

    /**
     * Increments the count of terminal commands run (for activity tracking).
     * @returns void
     */
    electron.ipcMain.on("increment-term-commands", () => {
        incrementTermCommandsRun();
    });

    /**
     * Triggers a native paste operation in the sender's webContents.
     * @param event - IPC event object with sender information
     * @returns void
     */
    electron.ipcMain.on("native-paste", (event) => {
        try {
            if (!event.sender || event.sender.isDestroyed()) {
                console.error("native-paste: sender is destroyed or invalid");
                return;
            }
            event.sender.paste();
        } catch (err) {
            console.error("native-paste: error", err);
        }
    });

    /**
     * Creates a new Wave Terminal window.
     * @returns void - Fire-and-forget operation
     */
    electron.ipcMain.on("open-new-window", () => fireAndForget(createNewWaveWindow));

    /**
     * Reloads the sender's webContents, ignoring cache.
     * @param event - IPC event object with sender information
     * @returns void
     */
    electron.ipcMain.on("do-refresh", (event) => {
        try {
            if (!event.sender || event.sender.isDestroyed()) {
                console.error("do-refresh: sender is destroyed or invalid");
                return;
            }
            event.sender.reloadIgnoringCache();
        } catch (err) {
            console.error("do-refresh: error", err);
        }
    });

    /**
     * Sets Electron's native theme source (affects window chrome on some platforms).
     * @param event - IPC event object (unused)
     * @param theme - Theme mode: "light", "dark", or "system" (follows OS preference)
     * @returns void
     */
    electron.ipcMain.on("set-native-theme-source", (event, theme: "light" | "dark" | "system") => {
        try {
            // Validate theme parameter
            if (theme !== "light" && theme !== "dark" && theme !== "system") {
                console.error("set-native-theme-source: invalid theme - must be 'light', 'dark', or 'system'");
                return;
            }
            electron.nativeTheme.themeSource = theme;
        } catch (err) {
            console.error("set-native-theme-source: error", err);
        }
    });

    /**
     * Logs webview navigation events for debugging and tracking.
     * Called when a webview navigates to a new URL.
     * @param event - IPC event object (unused)
     * @param payload - Navigation event details
     * @param payload.blockId - Block ID containing the webview
     * @param payload.url - The URL being navigated to
     * @param payload.eventType - Type of navigation event
     * @param payload.isMainFrame - Whether this is the main frame (optional)
     * @returns void
     */
    electron.ipcMain.on(
        "webview-navigation",
        (
            event,
            payload: {
                blockId: string;
                url: string;
                eventType: "did-navigate" | "did-navigate-in-page" | "will-navigate";
                isMainFrame?: boolean;
            }
        ) => {
            try {
                // Validate payload
                if (!payload || typeof payload.blockId !== "string" || typeof payload.url !== "string") {
                    console.error("webview-navigation: invalid payload");
                    return;
                }
                // Log navigation event for debugging/tracking
                console.log(`WebView Navigation [${payload.eventType}]:`, {
                    blockId: payload.blockId,
                    url: payload.url,
                    isMainFrame: payload.isMainFrame,
                });
                // Future: Could emit to analytics, history tracking, etc.
            } catch (err) {
                console.error("webview-navigation: error", err);
            }
        }
    );

    /**
     * Shows a native file/directory picker dialog.
     * Security: Restricted to directory selection only, blocks UNC paths, validates returned paths.
     * @param event - IPC event object with sender information
     * @param options - Dialog options
     * @param options.title - Dialog title (default: "Select Directory")
     * @param options.defaultPath - Initial directory (will be sanitized)
     * @param options.properties - Dialog properties (filtered to openDirectory/showHiddenFiles only)
     * @param options.filters - File type filters (optional)
     * @returns Promise<string[]> - Array of selected directory paths (empty if canceled)
     */
    electron.ipcMain.handle(
        "show-open-dialog",
        async (
            event: electron.IpcMainInvokeEvent,
            options: {
                title?: string;
                defaultPath?: string;
                properties?: Array<"openFile" | "openDirectory" | "multiSelections" | "showHiddenFiles">;
                filters?: Array<{ name: string; extensions: string[] }>;
            }
        ): Promise<string[]> => {
            // SECURITY: Restrict to directory selection only for this feature
            const allowedProperties =
                options.properties?.filter((p) => ["openDirectory", "showHiddenFiles"].includes(p)) ||
                ["openDirectory"];

            // SECURITY: Sanitize defaultPath
            let sanitizedDefaultPath = options.defaultPath;
            if (sanitizedDefaultPath) {
                // CRITICAL SECURITY: Block UNC paths on Windows to prevent network attacks
                // UNC paths like \\attacker.com\share can leak credentials or data
                if (process.platform === "win32" && /^[\\/]{2}[^\\/]/.test(sanitizedDefaultPath)) {
                    console.warn("show-open-dialog: blocked UNC path in defaultPath:", sanitizedDefaultPath);
                    sanitizedDefaultPath = electronApp.getPath("home");
                } else {
                    // Expand home directory shorthand
                    if (sanitizedDefaultPath.startsWith("~")) {
                        sanitizedDefaultPath = sanitizedDefaultPath.replace(/^~/, electronApp.getPath("home"));
                    }
                    // Normalize path to resolve any .. components
                    sanitizedDefaultPath = path.normalize(sanitizedDefaultPath);

                    // Validate the path exists and is accessible
                    try {
                        await fs.promises.access(sanitizedDefaultPath, fs.constants.R_OK);
                    } catch {
                        // Fall back to home directory if path doesn't exist or isn't readable
                        sanitizedDefaultPath = electronApp.getPath("home");
                    }
                }
            }

            // Get the appropriate parent window
            const ww = getWaveWindowByWebContentsId(event.sender.id);
            const parentWindow = ww ?? electron.BrowserWindow.getFocusedWindow();

            const result = await electron.dialog.showOpenDialog(parentWindow, {
                title: options.title ?? "Select Directory",
                defaultPath: sanitizedDefaultPath,
                properties: allowedProperties as electron.OpenDialogOptions["properties"],
                filters: options.filters,
            });

            // Return empty array if canceled
            if (result.canceled || !result.filePaths) {
                return [];
            }

            // SECURITY: Validate returned paths
            const validPaths: string[] = [];
            for (const filePath of result.filePaths) {
                // CRITICAL SECURITY: Block UNC paths in returned values on Windows
                if (process.platform === "win32" && /^[\\/]{2}[^\\/]/.test(filePath)) {
                    console.warn("show-open-dialog: blocked UNC path in result:", filePath);
                    continue;
                }

                try {
                    const stats = await fs.promises.stat(filePath);
                    if (allowedProperties.includes("openDirectory")) {
                        if (stats.isDirectory()) {
                            validPaths.push(filePath);
                        }
                    } else {
                        validPaths.push(filePath);
                    }
                } catch {
                    // Skip paths that can't be accessed
                    console.warn("show-open-dialog: skipping inaccessible path:", filePath);
                }
            }

            return validPaths;
        }
    );
}
