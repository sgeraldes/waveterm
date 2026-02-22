import { describe, expect, it } from "vitest";

describe("TreeViewModel.getNodeContextMenu", () => {
    function makeMenu(isDir: boolean, path: string, name: string) {
        const menu: { label?: string; type?: string }[] = [
            { label: path, type: "normal" },
            { type: "separator" },
            { label: "Copy Full Path" },
            { label: "Copy Filename" },
        ];
        if (!isDir) {
            menu.push({ type: "separator" });
            menu.push({ label: "Open in Preview" });
        }
        if (isDir) {
            menu.push({ type: "separator" });
            menu.push({ label: "Set as Tab Base Directory" });
        }
        return menu;
    }

    it("includes copy actions for files", () => {
        const menu = makeMenu(false, "/home/user/file.ts", "file.ts");
        const labels = menu.map((m) => m.label).filter(Boolean);
        expect(labels).toContain("Copy Full Path");
        expect(labels).toContain("Copy Filename");
        expect(labels).toContain("Open in Preview");
        expect(labels).not.toContain("Set as Tab Base Directory");
    });

    it("includes set-basedir for directories but not open-in-preview", () => {
        const menu = makeMenu(true, "/home/user/project", "project");
        const labels = menu.map((m) => m.label).filter(Boolean);
        expect(labels).toContain("Set as Tab Base Directory");
        expect(labels).not.toContain("Open in Preview");
    });

    it("first item shows full path", () => {
        const menu = makeMenu(false, "/some/long/path/file.md", "file.md");
        expect(menu[0].label).toBe("/some/long/path/file.md");
    });
});
