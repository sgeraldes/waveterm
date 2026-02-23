
// Note: termhistory.tsx is a React component that requires xterm.js and Electron+Jotai environment.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/store/global", () => ({
    WOS: {
        useWaveObjectValue: vi.fn(() => [null, false]),
        makeORef: vi.fn((type: string, id: string) => `${type}:${id}`),
    },
}));
vi.mock("@/store/services", () => ({
    SessionHistoryService: {
        ReadLatestSegments: vi.fn().mockResolvedValue(""),
    },
}));
vi.mock("@/util/util", () => ({
    fireAndForget: vi.fn(),
    base64ToArray: vi.fn(() => new Uint8Array()),
}));
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
    FitAddon: vi.fn().mockImplementation(() => ({
        fit: vi.fn(),
    })),
}));
vi.mock("./termutil", () => ({
    computeTheme: vi.fn(() => ({})),
}));
vi.mock("./xterm.css", () => ({}));
vi.mock("jotai", () => ({
    atom: vi.fn(),
    useAtomValue: vi.fn(),
}));

describe("TermHistoryView", () => {
    it("exports TermHistoryView as a function", async () => {
        const mod = await import("./termhistory");
        expect(typeof mod.TermHistoryView).toBe("function");
    });
});
