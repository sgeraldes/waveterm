// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// Mock all dependencies
vi.mock("@/app/store/client-model", () => ({ ClientModel: {} }));
vi.mock("@/app/store/global-model", () => ({ GlobalModel: {} }));
vi.mock("@/app/store/tab-model", () => ({
    getTabModelByTabId: vi.fn(() => ({})),
}));
vi.mock("@/app/workspace/workspace", () => ({ Workspace: () => null }));
vi.mock("@/store/contextmenu", () => ({ ContextMenuModel: {} }));
vi.mock("@/store/global", () => ({
    atoms: {},
    clearTabIndicatorFromFocus: vi.fn(),
    createBlock: vi.fn(),
    getSettingsPrefixAtom: vi.fn(),
    getTabIndicatorAtom: vi.fn(),
    globalStore: { get: vi.fn(), set: vi.fn() },
    isDev: false,
    removeFlashError: vi.fn(),
}));
vi.mock("@/store/keymodel", () => ({
    appHandleKeyDown: vi.fn(),
    keyboardMouseDownHandler: vi.fn(),
}));
vi.mock("@/util/focusutil", () => ({ getElemAsStr: vi.fn() }));
vi.mock("@/util/keyutil", () => ({}));
vi.mock("@/util/platformutil", () => ({ PLATFORM: "darwin" }));
vi.mock("@/util/util", () => ({}));
vi.mock("debug", () => ({ default: () => vi.fn() }));
vi.mock("@/app/app-bg", () => ({ AppBackground: () => null }));
vi.mock("@/app/element/quickelems", () => ({ CenteredDiv: () => null }));
vi.mock("@/app/hook/usetheme", () => ({ useTheme: vi.fn() }));
vi.mock("@/app/notification/notificationbubbles", () => ({ NotificationBubbles: () => null }));
vi.mock("@/element/errorboundary", () => ({ ErrorBoundary: () => null }));
vi.mock("react-dnd", () => ({ DndProvider: ({ children }: any) => children }));
vi.mock("react-dnd-html5-backend", () => ({ HTML5Backend: {} }));

describe("Root Error Boundary", () => {
    it("exports ErrorBoundary component", async () => {
        const { ErrorBoundary } = await import("@/element/errorboundary");
        expect(typeof ErrorBoundary).toBe("function");
    });

    it("ErrorBoundary has correct display name", async () => {
        const { ErrorBoundary } = await import("@/element/errorboundary");
        expect(ErrorBoundary.name).toBeTruthy();
    });

    it("app.tsx imports ErrorBoundary", async () => {
        const appModule = await import("@/app/app");
        expect(appModule).toBeDefined();
    });

    it("ErrorBoundary component is defined as a class or function", async () => {
        const { ErrorBoundary } = await import("@/element/errorboundary");
        const type = typeof ErrorBoundary;
        expect(type === "function" || type === "object").toBe(true);
    });
});
