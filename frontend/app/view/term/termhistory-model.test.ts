
import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/store/global", () => ({
    globalStore: { get: vi.fn().mockReturnValue(null) },
    WOS: {
        getWaveObjectAtom: vi.fn().mockReturnValue({ init: false, val: null }),
        makeORef: vi.fn((type: string, id: string) => `${type}:${id}`),
        useWaveObjectValue: vi.fn(() => [null, false]),
    },
    atoms: {},
}));
vi.mock("@/store/services", () => ({
    SessionHistoryService: {
        ReadLatestSegments: vi.fn().mockResolvedValue(""),
    },
}));
vi.mock("@/util/util", () => ({
    fireAndForget: vi.fn((fn: () => Promise<unknown>) => fn().catch(() => {})),
    base64ToArray: vi.fn(() => new Uint8Array()),
}));
vi.mock("./termutil", () => ({
    computeTheme: vi.fn(() => [{}]),
}));
vi.mock("./xterm.css", () => ({}));
vi.mock("@xterm/xterm", () => ({
    Terminal: vi.fn().mockImplementation(() => ({
        loadAddon: vi.fn(),
        open: vi.fn(),
        write: vi.fn(),
        dispose: vi.fn(),
        attachCustomKeyEventHandler: vi.fn(),
    })),
}));
vi.mock("@xterm/addon-fit", () => ({
    FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })),
}));
vi.mock("jotai", () => ({
    atom: vi.fn((initOrRead: unknown) => ({ init: initOrRead, read: initOrRead })),
    useAtomValue: vi.fn(),
}));

describe("TermHistoryViewModel", () => {
    const mockNodeModel = {
        blockId: "test-block",
        isFocused: { init: false },
        isMagnified: { init: false },
        isEphemeral: { init: false },
        numLeafs: { init: 1 },
        dragHandleRef: { current: null },
        toggleMagnify: vi.fn(),
        addEphemeralNodeToLayout: vi.fn(),
    } as unknown as BlockNodeModel;
    const mockTabModel = {} as unknown as TabModel;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("has viewType set to 'termhistory'", async () => {
        const { TermHistoryViewModel } = await import("./termhistory-model");
        const model = new TermHistoryViewModel("test-block", mockNodeModel, mockTabModel);
        expect(model.viewType).toBe("termhistory");
    });

    it("has a viewComponent function", async () => {
        const { TermHistoryViewModel } = await import("./termhistory-model");
        const model = new TermHistoryViewModel("test-block", mockNodeModel, mockTabModel);
        expect(typeof model.viewComponent).toBe("function");
    });

    it("has noPadding set to true atom", async () => {
        const { atom } = await import("jotai");
        const { TermHistoryViewModel } = await import("./termhistory-model");
        const model = new TermHistoryViewModel("test-block", mockNodeModel, mockTabModel);
        expect(model.noPadding).toBeDefined();
        const calls = vi.mocked(atom).mock.calls;
        const hasTrueAtom = calls.some(([arg]) => arg === true);
        expect(hasTrueAtom).toBe(true);
    });
});
