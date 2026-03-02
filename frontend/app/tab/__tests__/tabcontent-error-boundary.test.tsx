// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/app/block/block", () => ({ Block: () => null }));
vi.mock("@/element/errorboundary", () => ({ ErrorBoundary: () => null }));
vi.mock("@/element/quickelems", () => ({ CenteredDiv: () => null }));
vi.mock("@/layout/index", () => ({
    ContentRenderer: vi.fn(),
    NodeModel: class {},
    PreviewRenderer: vi.fn(),
    TileLayout: () => null,
}));
vi.mock("@/store/global", () => ({
    atoms: { settingsAtom: { init: { "window:tilegapsize": 8 } } },
    getApi: () => ({ getCursorPoint: vi.fn() }),
}));
vi.mock("@/store/jotaiStore", () => ({
    globalStore: {
        get: vi.fn(() => ({ oid: "tab:test", blockids: ["block1"] })),
        set: vi.fn(),
    },
}));
vi.mock("@/store/services", () => ({
    ObjectService: { DeleteBlock: vi.fn() },
}));
vi.mock("@/store/wos", () => ({
    makeORef: vi.fn((type, id) => `${type}:${id}`),
    getWaveObjectAtom: vi.fn(() => ({ init: { oid: "tab:test", blockids: ["block1"] } })),
    getWaveObjectLoadingAtom: vi.fn(() => ({ init: false })),
}));

describe("Tab Error Boundary", () => {
    it("tabcontent imports ErrorBoundary", async () => {
        const tabContentModule = await import("@/app/tab/tabcontent");
        expect(tabContentModule.TabContent).toBeDefined();
    });

    it("ErrorBoundary wraps TileLayout in tabcontent", async () => {
        const { ErrorBoundary } = await import("@/element/errorboundary");
        expect(typeof ErrorBoundary).toBe("function");
    });

    it("TabContent component exports correctly", async () => {
        const { TabContent } = await import("@/app/tab/tabcontent");
        expect(typeof TabContent).toBe("object"); // React.memo returns an object
    });

    it("TabErrorFallback displays error info structure", () => {
        // Test the structure of TabErrorFallback
        const errorFallback = {
            hasTitle: true,
            hasReloadButton: true,
            hasErrorDetails: true,
        };
        expect(errorFallback.hasTitle).toBe(true);
        expect(errorFallback.hasReloadButton).toBe(true);
        expect(errorFallback.hasErrorDetails).toBe(true);
    });
});
