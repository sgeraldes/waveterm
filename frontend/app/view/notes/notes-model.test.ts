// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { getNotesFilePath } from "./notes-util";

describe("getNotesFilePath", () => {
    it("should return basedir NOTES.md when basedir set", () => {
        const path = getNotesFilePath("/home/user/project", null);
        expect(path).toBe("/home/user/project/.wave/NOTES.md");
    });

    it("should use home dir fallback when basedir is empty", () => {
        const path = getNotesFilePath("", null);
        expect(path).toBe("~/.wave/NOTES.md");
    });

    it("should use home dir fallback when basedir is tilde", () => {
        const path = getNotesFilePath("~", null);
        expect(path).toBe("~/.wave/NOTES.md");
    });

    it("should use custom file when meta.file is set", () => {
        const path = getNotesFilePath("/home/user/project", "/home/user/project/custom-notes.md");
        expect(path).toBe("/home/user/project/custom-notes.md");
    });

    it("should return meta.file as-is when no basedir", () => {
        const path = getNotesFilePath("", "/home/user/custom.md");
        expect(path).toBe("/home/user/custom.md");
    });
});
