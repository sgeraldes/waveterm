// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateImageFilename, getMarkdownImageRef } from "./image-paste";

// Mock the error notification utility
vi.mock("@/util/errorutil", () => ({
    showErrorNotification: vi.fn(),
}));

describe("generateImageFilename", () => {
    it("should generate filename with date prefix", () => {
        const filename = generateImageFilename();
        // Should match YYYY-MM-DD-{12 hex chars}.png (6 random bytes = 12 hex digits)
        expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-[a-f0-9]{12}\.png$/);
    });

    it("should generate unique filenames", () => {
        const names = new Set(Array.from({ length: 100 }, () => generateImageFilename()));
        // All should be unique (random component makes collisions extremely unlikely)
        expect(names.size).toBe(100);
    });

    it("should include today's date", () => {
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        const filename = generateImageFilename();
        expect(filename.startsWith(today + "-")).toBe(true);
    });
});

describe("getMarkdownImageRef", () => {
    it("should return markdown image syntax with relative path", () => {
        const ref = getMarkdownImageRef("2026-02-17-abc12345.png");
        expect(ref).toBe("![](.wave/images/2026-02-17-abc12345.png)");
    });

    it("should handle different filenames", () => {
        const ref = getMarkdownImageRef("my-image.png");
        expect(ref).toBe("![](.wave/images/my-image.png)");
    });
});

describe("image size validation", () => {
    let mockShowErrorNotification: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        // Reset mocks before each test
        const { showErrorNotification } = await import("@/util/errorutil");
        mockShowErrorNotification = showErrorNotification as ReturnType<typeof vi.fn>;
        mockShowErrorNotification.mockClear();
    });

    it("should reject images larger than 10MB", async () => {
        // Create a mock file that's 11MB (exceeds limit)
        const largeSize = 11 * 1024 * 1024;
        const mockFile = new File(["x".repeat(largeSize)], "large-image.png", { type: "image/png" });
        Object.defineProperty(mockFile, "size", { value: largeSize });

        // Create a mock DataTransferItem
        const mockItem = {
            type: "image/png",
            kind: "file" as const,
            getAsFile: () => mockFile,
            getAsString: vi.fn(),
            webkitGetAsEntry: vi.fn(),
        } as unknown as DataTransferItem;

        // We need to import and test the internal function through the module
        // Since imageItemToBase64 is not exported, we test through handleImagePaste
        const { handleImagePaste } = await import("./image-paste");

        // Create mock clipboard data
        const mockClipboardData = {
            items: [mockItem],
            types: ["Files"],
            files: [] as unknown as FileList,
            getData: vi.fn(),
            setData: vi.fn(),
            clearData: vi.fn(),
        } as unknown as DataTransfer;

        // Call handleImagePaste (which calls imageItemToBase64 internally)
        const result = await handleImagePaste(mockClipboardData, "~", "local");

        // Should return null (image rejected)
        expect(result).toBeNull();

        // Should show error notification with 11.00 MB
        expect(mockShowErrorNotification).toHaveBeenCalledWith(
            "Image Too Large",
            "Image size (11.00 MB) exceeds maximum allowed size of 10 MB. Please use a smaller image."
        );
    });

    it("should accept images smaller than 10MB", async () => {
        // Create a mock file that's 5MB (within limit)
        const smallSize = 5 * 1024 * 1024;
        const mockFile = new File(["x".repeat(1000)], "small-image.png", { type: "image/png" });
        Object.defineProperty(mockFile, "size", { value: smallSize });

        // Create a mock DataTransferItem
        const mockItem = {
            type: "image/png",
            kind: "file" as const,
            getAsFile: () => mockFile,
            getAsString: vi.fn(),
            webkitGetAsEntry: vi.fn(),
        } as unknown as DataTransferItem;

        // We test that no error notification is shown for valid files
        // Full integration test would require mocking RpcApi which is complex
        const { handleImagePaste } = await import("./image-paste");

        const mockClipboardData = {
            items: [mockItem],
            types: ["Files"],
            files: [] as unknown as FileList,
            getData: vi.fn(),
            setData: vi.fn(),
            clearData: vi.fn(),
        } as unknown as DataTransfer;

        // This will fail on RpcApi call since we're not mocking it,
        // but we can verify the error notification was NOT called for size
        try {
            await handleImagePaste(mockClipboardData, "~", "local");
        } catch (e) {
            // Expected to fail on RpcApi, but size check should pass
        }

        // Should not show "Image Too Large" error
        expect(mockShowErrorNotification).not.toHaveBeenCalledWith(
            "Image Too Large",
            expect.anything()
        );
    });

    it("should format file size correctly in error message", async () => {
        // Create a file that's exactly 10.5MB
        const exactSize = 10.5 * 1024 * 1024;
        const mockFile = new File(["x"], "exact-size.png", { type: "image/png" });
        Object.defineProperty(mockFile, "size", { value: exactSize });

        const mockItem = {
            type: "image/png",
            kind: "file" as const,
            getAsFile: () => mockFile,
            getAsString: vi.fn(),
            webkitGetAsEntry: vi.fn(),
        } as unknown as DataTransferItem;

        const { handleImagePaste } = await import("./image-paste");

        const mockClipboardData = {
            items: [mockItem],
            types: ["Files"],
            files: [] as unknown as FileList,
            getData: vi.fn(),
            setData: vi.fn(),
            clearData: vi.fn(),
        } as unknown as DataTransfer;

        await handleImagePaste(mockClipboardData, "~", "local");

        // Should show error with size formatted to 2 decimal places
        expect(mockShowErrorNotification).toHaveBeenCalledWith(
            "Image Too Large",
            "Image size (10.50 MB) exceeds maximum allowed size of 10 MB. Please use a smaller image."
        );
    });
});
