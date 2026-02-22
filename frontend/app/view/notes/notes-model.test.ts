
import { describe, expect, it } from "vitest";
import type { NotesPreviewMode } from "./notes-model";
import { getNotesFilePath } from "./notes-util";

describe("NotesViewModel preview mode cycling", () => {
    function nextMode(mode: NotesPreviewMode): NotesPreviewMode {
        return mode === "editor" ? "split" : mode === "split" ? "preview" : "editor";
    }

    it("editor -> split", () => expect(nextMode("editor")).toBe("split"));
    it("split -> preview", () => expect(nextMode("split")).toBe("preview"));
    it("preview -> editor", () => expect(nextMode("preview")).toBe("editor"));
});

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
