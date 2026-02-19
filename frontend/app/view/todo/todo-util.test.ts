
import { describe, expect, it } from "vitest";
import { getTodoFilePath, isDefaultTodoPath, parseTodoItems, toggleTodoItem, serializeTodoItems } from "./todo-util";

describe("getTodoFilePath", () => {
    it("should return basedir TODO.md when basedir set", () => {
        const path = getTodoFilePath("/home/user/project", null);
        expect(path).toBe("/home/user/project/.wave/TODO.md");
    });

    it("should use home dir fallback when basedir is empty", () => {
        const path = getTodoFilePath("", null);
        expect(path).toBe("~/.wave/TODO.md");
    });

    it("should use home dir fallback when basedir is tilde", () => {
        const path = getTodoFilePath("~", null);
        expect(path).toBe("~/.wave/TODO.md");
    });

    it("should use custom file when meta.file is set", () => {
        const path = getTodoFilePath("/home/user/project", "/home/user/project/custom.md");
        expect(path).toBe("/home/user/project/custom.md");
    });
});

describe("isDefaultTodoPath", () => {
    it("should return true for default paths", () => {
        expect(isDefaultTodoPath("~/.wave/TODO.md")).toBe(true);
        expect(isDefaultTodoPath("/home/user/project/.wave/TODO.md")).toBe(true);
    });

    it("should return false for custom paths", () => {
        expect(isDefaultTodoPath("/custom/todo.md")).toBe(false);
        expect(isDefaultTodoPath("TODO.md")).toBe(false);
    });
});

describe("parseTodoItems", () => {
    it("should parse unchecked items", () => {
        const items = parseTodoItems("- [ ] Buy milk\n- [ ] Walk dog\n");
        expect(items).toHaveLength(2);
        expect(items[0]).toEqual({ text: "Buy milk", checked: false, lineIndex: 0, raw: "- [ ] Buy milk" });
        expect(items[1]).toEqual({ text: "Walk dog", checked: false, lineIndex: 1, raw: "- [ ] Walk dog" });
    });

    it("should parse checked items", () => {
        const items = parseTodoItems("- [x] Done task\n");
        expect(items).toHaveLength(1);
        expect(items[0]).toEqual({ text: "Done task", checked: true, lineIndex: 0, raw: "- [x] Done task" });
    });

    it("should ignore non-todo lines", () => {
        const items = parseTodoItems("# Heading\n- [ ] A task\nSome paragraph\n- [x] Done\n");
        expect(items).toHaveLength(2);
    });

    it("should return empty array for empty content", () => {
        const items = parseTodoItems("");
        expect(items).toHaveLength(0);
    });
});

describe("toggleTodoItem", () => {
    it("should toggle unchecked to checked", () => {
        const content = "- [ ] Buy milk\n- [ ] Walk dog\n";
        const result = toggleTodoItem(content, 0);
        expect(result).toBe("- [x] Buy milk\n- [ ] Walk dog\n");
    });

    it("should toggle checked to unchecked", () => {
        const content = "- [x] Done\n- [ ] Pending\n";
        const result = toggleTodoItem(content, 0);
        expect(result).toBe("- [ ] Done\n- [ ] Pending\n");
    });

    it("should only toggle the specified line index", () => {
        const content = "- [ ] First\n- [ ] Second\n- [ ] Third\n";
        const result = toggleTodoItem(content, 1);
        expect(result).toBe("- [ ] First\n- [x] Second\n- [ ] Third\n");
    });
});

describe("serializeTodoItems", () => {
    it("should convert items back to markdown", () => {
        const items = [
            { text: "Buy milk", checked: false, lineIndex: 0, raw: "- [ ] Buy milk" },
            { text: "Walk dog", checked: true, lineIndex: 1, raw: "- [x] Walk dog" },
        ];
        const result = serializeTodoItems(items);
        expect(result).toBe("- [ ] Buy milk\n- [x] Walk dog\n");
    });
});
