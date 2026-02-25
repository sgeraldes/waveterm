import { describe, expect, it, vi } from "vitest";

describe("preload-webview", () => {
    it("should send wave-mouse-navigate back when button 3 mousedown fires", () => {
        const sendToHost = vi.fn();
        const mockIpcRenderer = { sendToHost };

        const handler = (event: { button: number; preventDefault: () => void }) => {
            if (event.button === 3) {
                event.preventDefault();
                mockIpcRenderer.sendToHost("wave-mouse-navigate", "back");
            } else if (event.button === 4) {
                event.preventDefault();
                mockIpcRenderer.sendToHost("wave-mouse-navigate", "forward");
            }
        };

        const preventDefault = vi.fn();
        handler({ button: 3, preventDefault });
        expect(preventDefault).toHaveBeenCalled();
        expect(sendToHost).toHaveBeenCalledWith("wave-mouse-navigate", "back");
    });

    it("should send wave-mouse-navigate forward when button 4 mousedown fires", () => {
        const sendToHost = vi.fn();
        const mockIpcRenderer = { sendToHost };

        const handler = (event: { button: number; preventDefault: () => void }) => {
            if (event.button === 3) {
                event.preventDefault();
                mockIpcRenderer.sendToHost("wave-mouse-navigate", "back");
            } else if (event.button === 4) {
                event.preventDefault();
                mockIpcRenderer.sendToHost("wave-mouse-navigate", "forward");
            }
        };

        const preventDefault = vi.fn();
        handler({ button: 4, preventDefault });
        expect(preventDefault).toHaveBeenCalled();
        expect(sendToHost).toHaveBeenCalledWith("wave-mouse-navigate", "forward");
    });

    it("should not send navigation for other mouse buttons", () => {
        const sendToHost = vi.fn();
        const mockIpcRenderer = { sendToHost };

        const handler = (event: { button: number; preventDefault: () => void }) => {
            if (event.button === 3) {
                event.preventDefault();
                mockIpcRenderer.sendToHost("wave-mouse-navigate", "back");
            } else if (event.button === 4) {
                event.preventDefault();
                mockIpcRenderer.sendToHost("wave-mouse-navigate", "forward");
            }
        };

        const preventDefault = vi.fn();
        handler({ button: 0, preventDefault });
        handler({ button: 1, preventDefault });
        handler({ button: 2, preventDefault });
        expect(sendToHost).not.toHaveBeenCalled();
    });
});
