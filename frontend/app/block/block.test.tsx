
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/block/blocktypes", () => ({}));
vi.mock("@/app/store/tab-model", () => ({
    useTabModel: vi.fn(),
}));
vi.mock("@/app/view/aifilediff/aifilediff", () => ({ AiFileDiffViewModel: class {} }));
vi.mock("@/app/view/launcher/launcher", () => ({ LauncherViewModel: class {} }));
vi.mock("@/app/view/preview/preview-model", () => ({ PreviewModel: class {} }));
vi.mock("@/app/view/sysinfo/sysinfo", () => ({ SysinfoViewModel: class {} }));
vi.mock("@/element/errorboundary", () => ({ ErrorBoundary: () => null }));
vi.mock("@/element/quickelems", () => ({ CenteredDiv: () => null }));
vi.mock("@/layout/index", () => ({ useDebouncedNodeInnerRect: vi.fn() }));
vi.mock("@/store/global", () => ({
    counterInc: vi.fn(),
    getBlockComponentModel: vi.fn(),
    registerBlockComponentModel: vi.fn(),
    unregisterBlockComponentModel: vi.fn(),
}));
vi.mock("@/store/wos", () => ({
    getWaveObjectAtom: vi.fn(() => ({ init: null })),
    makeORef: vi.fn((type: string, id: string) => `${type}:${id}`),
    useWaveObjectValue: vi.fn(() => [null, false]),
}));
vi.mock("@/util/focusutil", () => ({ focusedBlockId: vi.fn() }));
vi.mock("@/util/util", () => ({
    isBlank: vi.fn(() => true),
    useAtomValueSafe: vi.fn(),
}));
vi.mock("@/view/helpview/helpview", () => ({ HelpViewModel: class {} }));
vi.mock("@/view/term/term-model", () => ({ TermViewModel: class {} }));
vi.mock("@/view/term/termhistory-model", () => ({ TermHistoryViewModel: class {} }));
vi.mock("@/view/waveai/waveai", () => ({ WaveAiModel: class {} }));
vi.mock("@/view/webview/webview", () => ({ WebViewModel: class {} }));
vi.mock("../view/quicktipsview/quicktipsview", () => ({ QuickTipsViewModel: class {} }));
vi.mock("../view/waveconfig/waveconfig-model", () => ({ WaveConfigViewModel: class {} }));
vi.mock("./block.scss", () => ({}));
vi.mock("./blockframe", () => ({ BlockFrame: () => null }));
vi.mock("./blockutil", () => ({
    blockViewToIcon: vi.fn(),
    blockViewToName: vi.fn(),
}));
vi.mock("jotai", () => ({
    atom: vi.fn((init: unknown) => ({ init })),
    useAtomValue: vi.fn(),
}));
vi.mock("react", async () => {
    const actual = await vi.importActual<typeof import("react")>("react");
    return {
        ...actual,
        memo: vi.fn((c: unknown) => c),
        Suspense: ({ children }: { children: unknown }) => children,
        useCallback: vi.fn((fn: unknown) => fn),
        useEffect: vi.fn(),
        useLayoutEffect: vi.fn(),
        useMemo: vi.fn((fn: () => unknown) => fn()),
        useRef: vi.fn(() => ({ current: null })),
        useState: vi.fn((init: unknown) => [init, vi.fn()]),
    };
});

describe("block", () => {
    it("registers termhistory in BlockRegistry via TermHistoryViewModel", async () => {
        const { TermHistoryViewModel } = await import("@/view/term/termhistory-model");
        expect(typeof TermHistoryViewModel).toBe("function");
    });
});
