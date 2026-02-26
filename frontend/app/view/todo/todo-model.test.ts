import { describe, expect, it } from "vitest";
import { getTodoFilePath, isDefaultTodoPath, parseTodoItems, toggleTodoItem, TODO_FILENAME } from "./todo-util";

describe("todo-model dependencies", () => {
    it("should get todo file path with basedir", () => {
        expect(getTodoFilePath("/home/user/project", null)).toBe(`/home/user/project/${TODO_FILENAME}`);
    });

    it("should detect default todo path", () => {
        expect(isDefaultTodoPath(`~/${TODO_FILENAME}`)).toBe(true);
        expect(isDefaultTodoPath("/custom/path.md")).toBe(false);
    });

    it("should parse todo items from markdown", () => {
        const content = "- [ ] task 1\n- [x] task 2\nsome text\n- [ ] task 3\n";
        const items = parseTodoItems(content);
        expect(items).toHaveLength(3);
        expect(items[0].checked).toBe(false);
        expect(items[1].checked).toBe(true);
    });

    it("should toggle todo item", () => {
        const content = "- [ ] task 1\n- [x] task 2\n";
        const toggled = toggleTodoItem(content, 0);
        expect(toggled).toContain("- [x] task 1");
    });
});
