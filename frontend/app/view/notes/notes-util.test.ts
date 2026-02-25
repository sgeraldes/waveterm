
import { describe, expect, it } from "vitest";
import { getNotesFilePath, isDefaultNotesPath, shouldShowNotesStatusBar } from "./notes-util";

describe("getNotesFilePath", () => {
    it("should return metaFile when provided", () => {
        expect(getNotesFilePath("", "/custom/path.md")).toBe("/custom/path.md");
        expect(getNotesFilePath("/some/dir", "/custom/path.md")).toBe("/custom/path.md");
    });

    it("should return default path when no basedir", () => {
        expect(getNotesFilePath("", null)).toBe("~/.wave/NOTES.md");
    });

    it("should return default path when basedir is ~", () => {
        expect(getNotesFilePath("~", null)).toBe("~/.wave/NOTES.md");
    });

    it("should use basedir when provided", () => {
        expect(getNotesFilePath("/home/user/project", null)).toBe("/home/user/project/.wave/NOTES.md");
    });
});

describe("isDefaultNotesPath", () => {
    it("should return true for default paths", () => {
        expect(isDefaultNotesPath("~/.wave/NOTES.md")).toBe(true);
        expect(isDefaultNotesPath("/home/user/project/.wave/NOTES.md")).toBe(true);
    });

    it("should return false for custom paths", () => {
        expect(isDefaultNotesPath("/custom/notes.md")).toBe(false);
        expect(isDefaultNotesPath("NOTES.md")).toBe(false);
    });
});

describe("shouldShowNotesStatusBar", () => {
    it("should hide status bar for default path with no status and local", () => {
        expect(shouldShowNotesStatusBar(true, null, true)).toBe(false);
    });

    it("should show status bar for custom path", () => {
        expect(shouldShowNotesStatusBar(false, null, true)).toBe(true);
    });

    it("should show status bar when save status is active", () => {
        expect(shouldShowNotesStatusBar(true, "saving", true)).toBe(true);
        expect(shouldShowNotesStatusBar(true, "saved", true)).toBe(true);
    });

    it("should show status bar for remote connections", () => {
        expect(shouldShowNotesStatusBar(true, null, false)).toBe(true);
    });
});
