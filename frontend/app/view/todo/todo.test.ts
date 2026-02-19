import { describe, expect, it } from "vitest";
import { isDefaultTodoPath, parseTodoItems, toggleTodoItem, TODO_FILENAME } from "./todo-util";

describe("todo component dependencies", () => {
    it("should detect default todo path", () => {
        expect(isDefaultTodoPath(`~/${TODO_FILENAME}`)).toBe(true);
    });

    it("should parse and toggle items", () => {
        const content = "- [ ] task 1\n- [x] task 2\n";
        const items = parseTodoItems(content);
        expect(items).toHaveLength(2);
        const toggled = toggleTodoItem(content, 0);
        expect(toggled).toContain("- [x] task 1");
    });
});
