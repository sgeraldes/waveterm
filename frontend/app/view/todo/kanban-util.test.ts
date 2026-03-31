// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
    addCard,
    addColumn,
    clearColumnCards,
    DEFAULT_COLUMNS,
    deleteCard,
    deleteColumn,
    kanbanToTodoMarkdown,
    migrateFromTodoItems,
    parseKanbanFile,
    renameColumn,
    reorderCard,
    serializeKanbanFile,
    updateCard,
    type KanbanData,
} from "./kanban-util";

// ---- parseKanbanFile / serializeKanbanFile round-trip ----

describe("parseKanbanFile", () => {
    it("returns empty data + full body when no front-matter", () => {
        const content = "- [ ] Buy milk\n- [x] Walk dog\n";
        const { data, body } = parseKanbanFile(content);
        expect(data.columns).toHaveLength(0);
        expect(data.cards).toHaveLength(0);
        expect(body).toBe(content);
    });

    it("parses a valid front-matter block", () => {
        const content =
            "---\n" +
            "kanban:columns:\n" +
            "  - id: todo\n" +
            "    name: Todo\n" +
            "    order: 0\n" +
            "  - id: done\n" +
            "    name: Done\n" +
            "    order: 1\n" +
            "kanban:cards:\n" +
            "  - id: abc123\n" +
            "    col: todo\n" +
            '    text: "Implement login page"\n' +
            "    order: 1\n" +
            "---\n" +
            "\nNotes here\n";

        const { data, body } = parseKanbanFile(content);
        expect(data.columns).toHaveLength(2);
        expect(data.columns[0]).toEqual({ id: "todo", name: "Todo", order: 0 });
        expect(data.columns[1]).toEqual({ id: "done", name: "Done", order: 1 });
        expect(data.cards).toHaveLength(1);
        expect(data.cards[0]).toMatchObject({ id: "abc123", col: "todo", text: "Implement login page", order: 1 });
        expect(body).toContain("Notes here");
    });

    it("returns empty data when front-matter delimiters are present but no kanban keys", () => {
        const content = "---\ntitle: My doc\n---\nSome body\n";
        const { data, body } = parseKanbanFile(content);
        expect(data.columns).toHaveLength(0);
        expect(data.cards).toHaveLength(0);
        expect(body).toContain("Some body");
    });
});

describe("serializeKanbanFile round-trip", () => {
    it("round-trips columns and cards", () => {
        const data: KanbanData = {
            columns: [
                { id: "todo", name: "Todo", order: 0 },
                { id: "done", name: "Done", order: 1 },
            ],
            cards: [{ id: "abc123", col: "todo", text: "Write tests", order: 1 }],
        };
        const body = "# Notes\n";
        const serialized = serializeKanbanFile(data, body);
        const { data: parsed, body: parsedBody } = parseKanbanFile(serialized);

        expect(parsed.columns).toEqual(data.columns);
        expect(parsed.cards).toEqual(data.cards);
        expect(parsedBody).toContain("# Notes");
    });

    it("escapes special chars in names and text", () => {
        const data: KanbanData = {
            columns: [{ id: "col1", name: "Column: One", order: 0 }],
            cards: [{ id: "c1", col: "col1", text: 'Say "hello"', order: 1 }],
        };
        const serialized = serializeKanbanFile(data, "");
        const { data: parsed } = parseKanbanFile(serialized);
        expect(parsed.columns[0].name).toBe("Column: One");
        expect(parsed.cards[0].text).toBe('Say "hello"');
    });
});

// ---- migrateFromTodoItems ----

describe("migrateFromTodoItems", () => {
    it("migrates unchecked items to todo column", () => {
        const content = "- [ ] Buy milk\n- [ ] Walk dog\n";
        const data = migrateFromTodoItems(content);
        const todoCards = data.cards.filter((c) => c.col === "todo");
        expect(todoCards).toHaveLength(2);
        expect(todoCards[0].text).toBe("Buy milk");
        expect(todoCards[1].text).toBe("Walk dog");
    });

    it("migrates checked items to done column", () => {
        const content = "- [x] Done task\n- [x] Another done\n";
        const data = migrateFromTodoItems(content);
        const doneCards = data.cards.filter((c) => c.col === "done");
        expect(doneCards).toHaveLength(2);
        expect(doneCards[0].text).toBe("Done task");
    });

    it("includes all three default columns", () => {
        const data = migrateFromTodoItems("");
        expect(data.columns).toHaveLength(3);
        expect(data.columns.map((c) => c.id)).toEqual(["todo", "inprogress", "done"]);
    });

    it("ignores non-todo lines", () => {
        const content = "# Heading\n- [ ] Task 1\nSome paragraph\n- [x] Done\n";
        const data = migrateFromTodoItems(content);
        expect(data.cards).toHaveLength(2);
    });

    it("assigns sequential order values", () => {
        const content = "- [ ] First\n- [ ] Second\n- [ ] Third\n";
        const data = migrateFromTodoItems(content);
        const todoCards = data.cards.filter((c) => c.col === "todo").sort((a, b) => a.order - b.order);
        expect(todoCards[0].order).toBe(1);
        expect(todoCards[1].order).toBe(2);
        expect(todoCards[2].order).toBe(3);
    });
});

// ---- kanbanToTodoMarkdown ----

describe("kanbanToTodoMarkdown", () => {
    it("converts done column cards to checked", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [
                { id: "a", col: "done", text: "Finished task", order: 1 },
                { id: "b", col: "todo", text: "Pending task", order: 1 },
            ],
        };
        const md = kanbanToTodoMarkdown(data);
        expect(md).toContain("- [ ] Pending task");
        expect(md).toContain("- [x] Finished task");
    });

    it("produces empty string for no cards", () => {
        const data: KanbanData = { columns: DEFAULT_COLUMNS, cards: [] };
        expect(kanbanToTodoMarkdown(data)).toBe("");
    });
});

// ---- CRUD: addCard ----

describe("addCard", () => {
    it("adds a card to the specified column", () => {
        const data: KanbanData = { columns: DEFAULT_COLUMNS, cards: [] };
        const updated = addCard(data, "todo", "New task");
        expect(updated.cards).toHaveLength(1);
        expect(updated.cards[0]).toMatchObject({ col: "todo", text: "New task", order: 1 });
    });

    it("assigns order after existing cards", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [{ id: "x", col: "todo", text: "Existing", order: 5 }],
        };
        const updated = addCard(data, "todo", "Second");
        const newCard = updated.cards.find((c) => c.text === "Second")!;
        expect(newCard.order).toBe(6);
    });

    it("trims whitespace from text", () => {
        const data: KanbanData = { columns: DEFAULT_COLUMNS, cards: [] };
        const updated = addCard(data, "todo", "  Trimmed  ");
        expect(updated.cards[0].text).toBe("Trimmed");
    });
});

// ---- CRUD: updateCard ----

describe("updateCard", () => {
    it("updates card text", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [{ id: "c1", col: "todo", text: "Old text", order: 1 }],
        };
        const updated = updateCard(data, "c1", "New text");
        expect(updated.cards[0].text).toBe("New text");
    });

    it("does not modify other cards", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [
                { id: "c1", col: "todo", text: "Card 1", order: 1 },
                { id: "c2", col: "todo", text: "Card 2", order: 2 },
            ],
        };
        const updated = updateCard(data, "c1", "Updated");
        expect(updated.cards.find((c) => c.id === "c2")!.text).toBe("Card 2");
    });
});

// ---- CRUD: deleteCard ----

describe("deleteCard", () => {
    it("removes the specified card", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [
                { id: "c1", col: "todo", text: "Card 1", order: 1 },
                { id: "c2", col: "todo", text: "Card 2", order: 2 },
            ],
        };
        const updated = deleteCard(data, "c1");
        expect(updated.cards).toHaveLength(1);
        expect(updated.cards[0].id).toBe("c2");
    });

    it("is a no-op for unknown card id", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [{ id: "c1", col: "todo", text: "Card", order: 1 }],
        };
        const updated = deleteCard(data, "nonexistent");
        expect(updated.cards).toHaveLength(1);
    });
});

// ---- CRUD: reorderCard ----

describe("reorderCard", () => {
    it("moves card to a different column", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [
                { id: "c1", col: "todo", text: "Card 1", order: 1 },
                { id: "c2", col: "inprogress", text: "Card 2", order: 1 },
            ],
        };
        const updated = reorderCard(data, "c1", "inprogress", null);
        const c1 = updated.cards.find((c) => c.id === "c1")!;
        expect(c1.col).toBe("inprogress");
    });

    it("inserts card before specified card", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [
                { id: "c1", col: "todo", text: "First", order: 1 },
                { id: "c2", col: "todo", text: "Second", order: 2 },
                { id: "c3", col: "todo", text: "Third", order: 3 },
            ],
        };
        // Move c3 before c2
        const updated = reorderCard(data, "c3", "todo", "c2");
        const todoCards = updated.cards.filter((c) => c.col === "todo").sort((a, b) => a.order - b.order);
        expect(todoCards[0].id).toBe("c1");
        expect(todoCards[1].id).toBe("c3");
        expect(todoCards[2].id).toBe("c2");
    });

    it("is a no-op for unknown card", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [{ id: "c1", col: "todo", text: "Card", order: 1 }],
        };
        const updated = reorderCard(data, "nonexistent", "done", null);
        expect(updated).toBe(data);
    });
});

// ---- CRUD: addColumn ----

describe("addColumn", () => {
    it("adds a new column with order after existing", () => {
        const data: KanbanData = { columns: DEFAULT_COLUMNS, cards: [] };
        const updated = addColumn(data, "Blocked");
        expect(updated.columns).toHaveLength(4);
        const newCol = updated.columns.find((c) => c.name === "Blocked")!;
        expect(newCol).toBeDefined();
        expect(newCol.order).toBe(3);
    });

    it("generates a unique id", () => {
        const data: KanbanData = { columns: DEFAULT_COLUMNS, cards: [] };
        const u1 = addColumn(data, "New");
        const u2 = addColumn(data, "New");
        const id1 = u1.columns.find((c) => c.name === "New")!.id;
        const id2 = u2.columns.find((c) => c.name === "New")!.id;
        expect(id1).not.toBe(id2);
    });
});

// ---- CRUD: renameColumn ----

describe("renameColumn", () => {
    it("renames the specified column", () => {
        const data: KanbanData = { columns: DEFAULT_COLUMNS, cards: [] };
        const updated = renameColumn(data, "todo", "Backlog");
        expect(updated.columns.find((c) => c.id === "todo")!.name).toBe("Backlog");
    });
});

// ---- CRUD: deleteColumn ----

describe("deleteColumn", () => {
    it("removes the column and its cards", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [
                { id: "c1", col: "todo", text: "Card 1", order: 1 },
                { id: "c2", col: "done", text: "Card 2", order: 1 },
            ],
        };
        const updated = deleteColumn(data, "todo");
        expect(updated.columns.find((c) => c.id === "todo")).toBeUndefined();
        expect(updated.cards.find((c) => c.col === "todo")).toBeUndefined();
        expect(updated.cards).toHaveLength(1);
    });
});

// ---- CRUD: clearColumnCards ----

describe("clearColumnCards", () => {
    it("removes all cards from a column", () => {
        const data: KanbanData = {
            columns: DEFAULT_COLUMNS,
            cards: [
                { id: "c1", col: "todo", text: "Card 1", order: 1 },
                { id: "c2", col: "todo", text: "Card 2", order: 2 },
                { id: "c3", col: "done", text: "Card 3", order: 1 },
            ],
        };
        const updated = clearColumnCards(data, "todo");
        expect(updated.cards.filter((c) => c.col === "todo")).toHaveLength(0);
        expect(updated.cards.filter((c) => c.col === "done")).toHaveLength(1);
    });
});
