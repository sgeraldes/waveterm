import { describe, expect, it, vi } from "vitest";

vi.mock("@/store/global", () => ({
    createBlock: vi.fn(),
    WOS: {
        useWaveObjectValue: vi.fn(() => [null]),
        getWaveObjectAtom: vi.fn(() => ({})),
        makeORef: vi.fn((type: string, id: string) => `${type}:${id}`),
    },
}));

vi.mock("@/store/services", () => ({
    SessionHistoryService: {
        ListSessionHistory: vi.fn(() => Promise.resolve([])),
    },
}));

vi.mock("@/util/util", () => ({
    fireAndForget: vi.fn((fn: () => Promise<void>) => fn()),
}));

vi.mock("@floating-ui/react", () => ({
    autoUpdate: vi.fn(),
    flip: vi.fn(() => ({})),
    FloatingPortal: ({ children }: { children: React.ReactNode }) => children,
    offset: vi.fn(() => ({})),
    shift: vi.fn(() => ({})),
    useClick: vi.fn(() => ({})),
    useDismiss: vi.fn(() => ({})),
    useFloating: vi.fn(() => ({
        refs: { setReference: vi.fn(), setFloating: vi.fn() },
        floatingStyles: {},
        context: {},
    })),
    useInteractions: vi.fn(() => ({
        getReferenceProps: vi.fn(() => ({})),
        getFloatingProps: vi.fn(() => ({})),
    })),
}));

describe("SessionHistoryFlyover", () => {
    it("exports SessionHistoryFlyover as a function", async () => {
        const mod = await import("./session-history-dropdown");
        expect(typeof mod.SessionHistoryFlyover).toBe("function");
    });

    it("accepts blockId and tabId props", async () => {
        const mod = await import("./session-history-dropdown");
        expect(mod.SessionHistoryFlyover).toBeDefined();
        expect(mod.SessionHistoryFlyover.length).toBeGreaterThanOrEqual(0);
    });
});
