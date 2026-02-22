import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/store/contextmenu", () => ({
    ContextMenuModel: { showContextMenu: vi.fn() },
}));

import { getFileIcon, flattenNodes, searchNodes } from "./treeview-nodes";
import type { TreeNode } from "./treeview-model";

function makeNode(name: string, isDir = false, depth = 0, children?: TreeNode[]): TreeNode {
    return {
        name,
        path: `/root/${name}`,
        isDir,
        isSymlink: false,
        isExpanded: !!children,
        isLoading: false,
        children: children ?? (isDir ? [] : undefined),
        depth,
        visitedAncestors: new Set(),
    };
}

describe("getFileIcon", () => {
    it("returns folder-open for expanded dirs", () => {
        const node = { ...makeNode("src", true), isExpanded: true };
        expect(getFileIcon(node)).toBe("folder-open");
    });
    it("returns folder for collapsed dirs", () => {
        expect(getFileIcon(makeNode("src", true))).toBe("folder");
    });
    it("returns file-code for .ts files", () => {
        expect(getFileIcon(makeNode("index.ts"))).toBe("file-code");
    });
    it("returns file for unknown extensions", () => {
        expect(getFileIcon(makeNode("data.xyz"))).toBe("file");
    });
});

describe("flattenNodes", () => {
    it("returns only top-level when nothing expanded", () => {
        const nodes = [makeNode("a"), makeNode("b")];
        expect(flattenNodes(nodes)).toHaveLength(2);
    });
    it("includes children when parent is expanded", () => {
        const child = makeNode("child.ts");
        const parent = { ...makeNode("src", true), isExpanded: true, children: [child] };
        expect(flattenNodes([parent])).toHaveLength(2);
    });
});

describe("searchNodes", () => {
    it("finds matching nodes case-insensitively", () => {
        const nodes = [makeNode("Index.ts"), makeNode("styles.css")];
        expect(searchNodes(nodes, "index")).toHaveLength(1);
    });
});
