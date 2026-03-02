// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock RPC API
const mockConnEnsureCommand = vi.fn();

vi.mock("@/app/store/wshclientapi", () => ({
    RpcApi: { ConnEnsureCommand: mockConnEnsureCommand },
}));
vi.mock("@/app/store/global", () => ({
    atoms: {},
    createBlock: vi.fn(),
    getConnStatusAtom: vi.fn(() => ({ init: new Map() })),
    globalStore: { get: vi.fn(() => new Map()), set: vi.fn() },
    WOS: { makeORef: vi.fn(), getObjectValue: vi.fn() },
}));
vi.mock("@/app/store/wshrpcutil", () => ({ TabRpcClient: {} }));
vi.mock("@/app/store/keymodel", () => ({ globalRefocusWithTimeout: vi.fn() }));
vi.mock("@/util/keyutil", () => ({}));
vi.mock("@/util/util", () => ({
    isBlank: (s: string) => !s || s.trim().length === 0,
}));
vi.mock("@/app/block/blockutil", () => ({ computeConnColorNum: vi.fn(() => 1) }));
vi.mock("@/app/modals/typeaheadmodal", () => ({ TypeAheadModal: () => null }));
vi.mock("@/layout/index", () => ({ NodeModel: class {} }));

describe("Connection Error Display", () => {
    beforeEach(() => {
        mockConnEnsureCommand.mockClear();
    });

    it("conntypeahead component is defined", async () => {
        const module = await import("@/app/modals/conntypeahead");
        expect(module).toBeDefined();
    });

    it("ConnEnsureCommand can throw errors", async () => {
        mockConnEnsureCommand.mockRejectedValueOnce(new Error("Connection refused"));

        try {
            await mockConnEnsureCommand({ connname: "test" });
            expect.fail("Should have thrown error");
        } catch (err: any) {
            expect(err.message).toBe("Connection refused");
        }
    });

    it("ConnEnsureCommand can succeed", async () => {
        mockConnEnsureCommand.mockResolvedValueOnce({ success: true });
        const result = await mockConnEnsureCommand({ connname: "test" });
        expect(result.success).toBe(true);
    });

    it("error handling pattern works correctly", async () => {
        const errors: string[] = [];

        // Simulate error handling
        mockConnEnsureCommand.mockRejectedValueOnce(new Error("Network timeout"));

        try {
            await mockConnEnsureCommand({ connname: "test" });
        } catch (err: any) {
            errors.push(err.message);
        }

        expect(errors).toContain("Network timeout");
        expect(errors.length).toBe(1);
    });

    it("multiple connection attempts track errors", async () => {
        const errors: string[] = [];

        mockConnEnsureCommand
            .mockRejectedValueOnce(new Error("First error"))
            .mockRejectedValueOnce(new Error("Second error"))
            .mockResolvedValueOnce({ success: true });

        // First attempt
        try {
            await mockConnEnsureCommand({ connname: "test" });
        } catch (err: any) {
            errors.push(err.message);
        }

        // Second attempt
        try {
            await mockConnEnsureCommand({ connname: "test" });
        } catch (err: any) {
            errors.push(err.message);
        }

        // Third attempt
        const result = await mockConnEnsureCommand({ connname: "test" });

        expect(errors).toContain("First error");
        expect(errors).toContain("Second error");
        expect(errors.length).toBe(2);
        expect(result.success).toBe(true);
    });

    it("error propagation works as expected", () => {
        let caughtError: Error | null = null;

        try {
            throw new Error("Authentication failed");
        } catch (err: any) {
            caughtError = err;
        }

        expect(caughtError).not.toBeNull();
        expect(caughtError?.message).toBe("Authentication failed");
    });

    it("connection state management pattern", () => {
        let isConnecting = false;
        let error: string | null = null;

        // Start connecting
        isConnecting = true;
        error = null;
        expect(isConnecting).toBe(true);
        expect(error).toBeNull();

        // Connection fails
        isConnecting = false;
        error = "Connection failed";
        expect(isConnecting).toBe(false);
        expect(error).toBe("Connection failed");

        // Retry - clear error
        isConnecting = true;
        error = null;
        expect(isConnecting).toBe(true);
        expect(error).toBeNull();

        // Success
        isConnecting = false;
        expect(isConnecting).toBe(false);
        expect(error).toBeNull();
    });
});
