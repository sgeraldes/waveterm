
import { describe, expect, it, vi } from "vitest";

describe("ipc-message mouse navigate handler", () => {
    function makeHandler(goBack: ReturnType<typeof vi.fn>, goForward: ReturnType<typeof vi.fn>) {
        return (e: { channel: string; args: unknown[] }) => {
            if (e.channel === "wave-mouse-navigate") {
                const direction = e.args?.[0];
                if (direction === "back") goBack();
                else if (direction === "forward") goForward();
            }
        };
    }

    it("calls goBack on wave-mouse-navigate back", () => {
        const goBack = vi.fn();
        const goForward = vi.fn();
        const handler = makeHandler(goBack, goForward);
        handler({ channel: "wave-mouse-navigate", args: ["back"] });
        expect(goBack).toHaveBeenCalledTimes(1);
        expect(goForward).not.toHaveBeenCalled();
    });

    it("calls goForward on wave-mouse-navigate forward", () => {
        const goBack = vi.fn();
        const goForward = vi.fn();
        const handler = makeHandler(goBack, goForward);
        handler({ channel: "wave-mouse-navigate", args: ["forward"] });
        expect(goForward).toHaveBeenCalledTimes(1);
        expect(goBack).not.toHaveBeenCalled();
    });

    it("ignores unrelated ipc channels", () => {
        const goBack = vi.fn();
        const goForward = vi.fn();
        const handler = makeHandler(goBack, goForward);
        handler({ channel: "some-other-channel", args: ["back"] });
        expect(goBack).not.toHaveBeenCalled();
        expect(goForward).not.toHaveBeenCalled();
    });
});
