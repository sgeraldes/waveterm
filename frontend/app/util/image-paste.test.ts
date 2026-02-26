// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { generateImageFilename, getMarkdownImageRef } from "./image-paste";

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
