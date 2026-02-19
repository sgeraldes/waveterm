import { describe, expect, it } from "vitest";
import { isDefaultNotesPath, shouldShowNotesStatusBar, getNotesFilePath, NOTES_FILENAME } from "./notes-util";

describe("notes-util", () => {
    describe("isDefaultNotesPath", () => {
        it("should return true for default notes path", () => {
            expect(isDefaultNotesPath(`~/${NOTES_FILENAME}`)).toBe(true);
        });

        it("should return false for custom path", () => {
            expect(isDefaultNotesPath("/home/user/custom-notes.md")).toBe(false);
        });
    });

    describe("shouldShowNotesStatusBar", () => {
        it("should hide for default path, no save status, local", () => {
            expect(shouldShowNotesStatusBar(true, null, true)).toBe(false);
        });

        it("should show when saving", () => {
            expect(shouldShowNotesStatusBar(true, "saving", true)).toBe(true);
        });

        it("should show for non-default path", () => {
            expect(shouldShowNotesStatusBar(false, null, true)).toBe(true);
        });

        it("should show for remote connection", () => {
            expect(shouldShowNotesStatusBar(true, null, false)).toBe(true);
        });
    });

    describe("getNotesFilePath", () => {
        it("should use metaFile when provided", () => {
            expect(getNotesFilePath("/home", "/custom/path.md")).toBe("/custom/path.md");
        });

        it("should use default path with basedir", () => {
            expect(getNotesFilePath("/home/user/project", null)).toBe(`/home/user/project/${NOTES_FILENAME}`);
        });

        it("should use home default when basedir is empty", () => {
            expect(getNotesFilePath("", null)).toBe(`~/${NOTES_FILENAME}`);
        });
    });
});
