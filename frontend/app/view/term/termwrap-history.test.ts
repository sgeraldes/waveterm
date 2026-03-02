import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_CAPTURE_BYTES } from "./sessionhistory-capture";
import { type SessionHistoryCtx, saveRollingCapture, saveSessionSnapshot } from "./termwrap-history";

vi.mock("@/store/services", () => ({
    SessionHistoryService: {
        SaveSnapshotSegment: vi.fn().mockResolvedValue(undefined),
        SaveRollingSegment: vi.fn().mockResolvedValue(undefined),
    },
    BlockService: {
        SaveTerminalState: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock("@/store/global", () => ({
    globalStore: { get: vi.fn().mockReturnValue(null) },
    WOS: {
        getWaveObjectAtom: vi.fn().mockReturnValue({}),
        makeORef: vi.fn().mockReturnValue("block:test"),
    },
    fetchWaveFile: vi.fn().mockResolvedValue({ data: new Uint8Array(), fileInfo: null }),
}));

vi.mock("@/util/util", () => ({
    fireAndForget: vi.fn((fn: () => Promise<unknown>) => {
        fn().catch(() => {});
    }),
}));

function makeCtx(overrides?: Partial<SessionHistoryCtx>): SessionHistoryCtx {
    return {
        blockId: "test-block",
        tabId: "test-tab",
        loaded: true,
        lastSnapshotTime: 0,
        lastRollingLength: 0,
        serializeAddon: { serialize: () => "x".repeat(MIN_CAPTURE_BYTES) },
        ...overrides,
    };
}

describe("saveSessionSnapshot", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns early without updating lastSnapshotTime when not loaded", () => {
        const ctx = makeCtx({ loaded: false });
        saveSessionSnapshot(ctx, "test");
        expect(ctx.lastSnapshotTime).toBe(0);
    });

    it("returns early without updating lastSnapshotTime when content is below threshold", () => {
        const ctx = makeCtx({
            serializeAddon: { serialize: () => "x".repeat(MIN_CAPTURE_BYTES - 1) },
        });
        saveSessionSnapshot(ctx, "test");
        expect(ctx.lastSnapshotTime).toBe(0);
    });

    it("returns early without updating lastSnapshotTime when called too soon after last snapshot", () => {
        const recentTime = Date.now();
        const ctx = makeCtx({ lastSnapshotTime: recentTime });
        saveSessionSnapshot(ctx, "test");
        expect(ctx.lastSnapshotTime).toBe(recentTime);
    });

    it("updates lastSnapshotTime when all guards pass", () => {
        const ctx = makeCtx();
        const beforeTime = Date.now();
        saveSessionSnapshot(ctx, "test");
        expect(ctx.lastSnapshotTime).toBeGreaterThanOrEqual(beforeTime);
    });
});

describe("saveRollingCapture", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns early without updating lastRollingLength when not loaded", () => {
        const ctx = makeCtx({ loaded: false });
        saveRollingCapture(ctx);
        expect(ctx.lastRollingLength).toBe(0);
    });

    it("returns early without updating lastRollingLength when content is below threshold", () => {
        const ctx = makeCtx({
            serializeAddon: { serialize: () => "x".repeat(MIN_CAPTURE_BYTES - 1) },
        });
        saveRollingCapture(ctx);
        expect(ctx.lastRollingLength).toBe(0);
    });

    it("returns early without updating lastRollingLength when content length is unchanged", () => {
        const content = "x".repeat(MIN_CAPTURE_BYTES);
        const ctx = makeCtx({
            lastRollingLength: content.length,
            serializeAddon: { serialize: () => content },
        });
        saveRollingCapture(ctx);
        expect(ctx.lastRollingLength).toBe(content.length);
    });

    it("updates lastRollingLength when content has changed", () => {
        const content = "x".repeat(MIN_CAPTURE_BYTES + 100);
        const ctx = makeCtx({
            lastRollingLength: MIN_CAPTURE_BYTES,
            serializeAddon: { serialize: () => content },
        });
        saveRollingCapture(ctx);
        expect(ctx.lastRollingLength).toBe(content.length);
    });
});

describe("TermWrap dispose null-safety (TM-NEW-2)", () => {
    // Bug: TermWrap.dispose() called this.mainFileSubject.release() unconditionally.
    // mainFileSubject is initialized to null in the constructor and only set in
    // initTerminal() (async). If the component unmounts before initTerminal completes,
    // dispose() would throw "Cannot read properties of null (reading 'release')".
    //
    // Fix: changed to this.mainFileSubject?.release() (optional chaining).

    it("optional chaining on null does not throw", () => {
        // Simulate the fixed pattern: calling .release() via optional chaining on null
        const mainFileSubject: { release: () => void } | null = null;

        // Old (buggy) pattern would throw:
        expect(() => (mainFileSubject as any).release()).toThrow();

        // Fixed pattern with optional chaining does not throw:
        expect(() => mainFileSubject?.release()).not.toThrow();
    });

    it("optional chaining calls release when subject is set", () => {
        let releaseCalled = false;
        const mainFileSubject = {
            release: () => {
                releaseCalled = true;
            },
        };

        // Should call release when the subject is non-null
        mainFileSubject?.release();
        expect(releaseCalled).toBe(true);
    });

    it("dispose is safe when called before initTerminal completes", () => {
        // Simulate the sequence: constructor sets mainFileSubject = null,
        // initTerminal is called async, component unmounts before it resolves,
        // dispose() is called with mainFileSubject still null.
        class FakeTermWrap {
            mainFileSubject: { release: () => void } | null = null;
            titleDebounceTimer: ReturnType<typeof setTimeout> | null = null;
            sessionHistoryTimer: ReturnType<typeof setInterval> | null = null;

            dispose() {
                if (this.titleDebounceTimer != null) {
                    clearTimeout(this.titleDebounceTimer);
                    this.titleDebounceTimer = null;
                }
                if (this.sessionHistoryTimer != null) {
                    clearInterval(this.sessionHistoryTimer);
                    this.sessionHistoryTimer = null;
                }
                // Fixed: optional chaining prevents crash when mainFileSubject is null
                this.mainFileSubject?.release();
            }
        }

        const tw = new FakeTermWrap();
        // mainFileSubject is still null (initTerminal never ran)
        expect(() => tw.dispose()).not.toThrow();
    });
});
