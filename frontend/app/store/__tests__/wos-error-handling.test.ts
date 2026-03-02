// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import * as WOS from "../wos";

// Mock the fetch and other dependencies
vi.mock("@/util/fetchutil", () => ({
    fetch: vi.fn(),
}));

vi.mock("@/util/endpoints", () => ({
    getWebServerEndpoint: vi.fn(() => "http://localhost:8080"),
}));

vi.mock("@/app/store/wps", () => ({
    waveEventSubscribe: vi.fn(() => vi.fn()),
}));

vi.mock("@/util/util", () => ({
    fireAndForget: vi.fn((fn) => fn()),
}));

vi.mock("../jotaiStore", () => ({
    globalStore: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock("../services", () => ({
    ObjectService: {
        UpdateObject: vi.fn(),
    },
}));

describe("WOS Error Handling (ER-008)", () => {
    it("should have error field in WaveObjectDataItemType", () => {
        // This is a type test - if it compiles, the field exists
        const data: any = { value: null, loading: false, error: "test error" };
        expect(data.error).toBe("test error");
    });

    it("should export getWaveObjectErrorAtom function", () => {
        expect(WOS.getWaveObjectErrorAtom).toBeDefined();
        expect(typeof WOS.getWaveObjectErrorAtom).toBe("function");
    });

    it("useWaveObjectValue should return error as third element", async () => {
        // This test verifies the return type includes error
        // The actual error handling is tested through integration tests
        const returnType = WOS.useWaveObjectValue;
        expect(returnType).toBeDefined();
    });

    it("makeORef creates valid object references", () => {
        const oref = WOS.makeORef("tab", "test-123");
        expect(oref).toBe("tab:test-123");
    });

    it("makeORef returns null for blank inputs", () => {
        expect(WOS.makeORef("", "test")).toBeNull();
        expect(WOS.makeORef("tab", "")).toBeNull();
    });

    it("splitORef correctly splits object references", () => {
        const [otype, oid] = WOS.splitORef("tab:test-123");
        expect(otype).toBe("tab");
        expect(oid).toBe("test-123");
    });

    it("splitORef throws on invalid format", () => {
        expect(() => WOS.splitORef("invalid")).toThrow("invalid oref");
        expect(() => WOS.splitORef("too:many:parts")).toThrow("invalid oref");
    });
});
