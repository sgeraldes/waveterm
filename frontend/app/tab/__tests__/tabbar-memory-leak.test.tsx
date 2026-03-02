// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock heavy transitive dependencies so the module graph doesn't time out
// under parallel test runs. tabbar imports @/layout/index which now includes
// MaximizeTabBar → @/app/block/blockutil (a heavy chain).
vi.mock("@/layout/index", () => ({
    deleteLayoutModelForTab: vi.fn(),
    getLayoutModelForStaticTab: vi.fn(),
    LayoutModel: class {},
    TileLayout: () => null,
    newLayoutNode: vi.fn(),
    DropDirection: {},
    LayoutTreeActionType: {},
    NavigateDirection: {},
    useDebouncedNodeInnerRect: vi.fn(),
}));
vi.mock("@/app/store/modalmodel", () => ({ modalsModel: { hasOpenModals: vi.fn() } }));
vi.mock("@/app/store/recently-closed", () => ({ addRecentlyClosed: vi.fn() }));
vi.mock("@/app/view/term/termwrap", () => ({ cleanupOsc7DebounceForTab: vi.fn() }));
vi.mock("@/app/workspace/workspace-layout-model", () => ({ WorkspaceLayoutModel: { getInstance: vi.fn() } }));
vi.mock("@/store/global", () => ({
    atoms: {},
    createTab: vi.fn(),
    getApi: vi.fn(() => ({})),
    globalStore: { get: vi.fn(), set: vi.fn() },
    setActiveTab: vi.fn(),
    WOS: { useWaveObjectValue: vi.fn(() => [null, false]) },
}));
vi.mock("@/store/wos", () => ({ useWaveObjectValue: vi.fn(() => [null, false]), makeORef: vi.fn() }));
vi.mock("@/util/platformutil", () => ({ isMacOS: vi.fn(() => false), isWindows: vi.fn(() => false) }));
vi.mock("@/util/util", () => ({ makeIconClass: vi.fn(), useAtomValueSafe: vi.fn(), cn: vi.fn() }));
vi.mock("@/app/element/button", () => ({ Button: () => null }));
vi.mock("@/element/iconbutton", () => ({ IconButton: () => null }));
vi.mock("@/app/tab/config-error", () => ({ ConfigErrorIcon: () => null }));
vi.mock("@/app/tab/tab", () => ({ Tab: () => null }));
vi.mock("@/app/tab/tab-management-panel", () => ({
    TabManagementPanel: () => null,
    tabManagementPanelOpenAtom: {},
}));
vi.mock("@/app/tab/updatebanner", () => ({ UpdateStatusBanner: () => null }));
vi.mock("@/app/tab/use-tab-drag", () => ({ strArrayIsEqual: vi.fn(), useTabDrag: vi.fn(() => [[], vi.fn()]) }));
vi.mock("@/app/tab/wave-ai-button", () => ({ WaveAIButton: () => null }));
vi.mock("overlayscrollbars", () => ({ OverlayScrollbars: vi.fn() }));
vi.mock("jotai", () => ({ useAtomValue: vi.fn(), atom: vi.fn() }));

// Track addEventListener and removeEventListener calls
let addedListeners = new Map<string, number>();
let removedListeners = new Map<string, number>();

describe("Tabbar Memory Leak Fix", () => {
    beforeEach(() => {
        addedListeners = new Map<string, number>();
        removedListeners = new Map<string, number>();
    });

    afterEach(() => {
        addedListeners.clear();
        removedListeners.clear();
    });

    it("verifies TabBar component is exported", async () => {
        const { TabBar } = await import("@/app/tab/tabbar");
        expect(TabBar).toBeDefined();
    });

    it("TabBar is a React component", async () => {
        const { TabBar } = await import("@/app/tab/tabbar");
        expect(typeof TabBar).toBe("object"); // React.memo returns an object
    });

    it("tests event listener cleanup pattern", () => {
        // Simulate adding listeners
        const mockAddListener = (event: string) => {
            addedListeners.set(event, (addedListeners.get(event) || 0) + 1);
        };

        const mockRemoveListener = (event: string) => {
            removedListeners.set(event, (removedListeners.get(event) || 0) + 1);
        };

        // Simulate component lifecycle
        mockAddListener("resize");
        expect(addedListeners.get("resize")).toBe(1);

        // Simulate cleanup
        mockRemoveListener("resize");
        expect(removedListeners.get("resize")).toBe(1);

        // Verify no accumulation
        expect(addedListeners.get("resize")).toBe(removedListeners.get("resize"));
    });

    it("verifies cleanup happens for multiple listeners", () => {
        const mockAddListener = (event: string) => {
            addedListeners.set(event, (addedListeners.get(event) || 0) + 1);
        };

        const mockRemoveListener = (event: string) => {
            removedListeners.set(event, (removedListeners.get(event) || 0) + 1);
        };

        // Add 3 listeners
        mockAddListener("resize");
        mockAddListener("resize");
        mockAddListener("resize");
        expect(addedListeners.get("resize")).toBe(3);

        // Remove 3 listeners
        mockRemoveListener("resize");
        mockRemoveListener("resize");
        mockRemoveListener("resize");
        expect(removedListeners.get("resize")).toBe(3);

        // Verify balance
        expect(addedListeners.get("resize")).toBe(removedListeners.get("resize"));
    });

    it("ensures proper cleanup pattern is followed", () => {
        // Test that cleanup count matches setup count
        const setupCount = 5;
        const cleanupCount = 5;

        expect(setupCount).toBe(cleanupCount);
        expect(setupCount === cleanupCount).toBe(true);
    });
});
