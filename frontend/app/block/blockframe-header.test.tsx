// Note: blockframe-header.tsx is a React component that requires full Electron+Jotai

import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/block/blockutil", () => ({
    blockViewToIcon: vi.fn(),
    blockViewToName: vi.fn(),
    getViewIconElem: vi.fn(),
    OptMagnifyButton: () => null,
    OptMaximizeButton: () => null,
    ShellButton: () => null,
    renderHeaderElements: vi.fn(() => []),
}));
vi.mock("@/app/block/connectionbutton", () => ({ ConnectionButton: () => null }));
vi.mock("@/app/block/durable-session-flyover", () => ({ DurableSessionFlyover: () => null }));
vi.mock("@/app/view/term/session-history-dropdown", () => ({
    SessionHistoryFlyover: vi.fn(() => null),
}));
vi.mock("@/app/store/contextmenu", () => ({ ContextMenuModel: { showContextMenu: vi.fn() } }));
vi.mock("@/app/store/global", () => ({
    getConnStatusAtom: vi.fn(),
    recordTEvent: vi.fn(),
    WOS: {
        useWaveObjectValue: vi.fn(() => [null, false]),
        makeORef: vi.fn((type: string, id: string) => `${type}:${id}`),
    },
}));
vi.mock("@/app/store/jotaiStore", () => ({ globalStore: { get: vi.fn() } }));
vi.mock("@/app/store/keymodel", () => ({ uxCloseBlock: vi.fn() }));
vi.mock("@/app/store/wshclientapi", () => ({ RpcApi: { ActivityCommand: vi.fn() } }));
vi.mock("@/app/store/wshrpcutil", () => ({ TabRpcClient: {} }));
vi.mock("@/element/iconbutton", () => ({ IconButton: () => null }));
vi.mock("@/layout/index", () => ({ NodeModel: class {} }));
vi.mock("@/util/util", () => ({
    useAtomValueSafe: vi.fn(),
    isBlank: vi.fn(() => true),
    cn: vi.fn((...args: unknown[]) => args.filter(Boolean).join(" ")),
}));
vi.mock("jotai", () => ({ useAtomValue: vi.fn(), atom: vi.fn() }));

describe("blockframe-header", () => {
    it("exports BlockFrame_Header as a function", async () => {
        const mod = await import("./blockframe-header");
        expect(typeof mod.BlockFrame_Header).toBe("function");
    });

    it("imports SessionHistoryFlyover from session-history-dropdown", async () => {
        const { SessionHistoryFlyover } = await import("@/app/view/term/session-history-dropdown");
        expect(typeof SessionHistoryFlyover).toBe("function");
    });
});
