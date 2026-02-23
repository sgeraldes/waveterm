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
