// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export interface KanbanColumn {
    id: string;
    name: string;
    order: number;
}

export interface KanbanCard {
    id: string;
    col: string;
    text: string;
    order: number;
}

export interface KanbanData {
    columns: KanbanColumn[];
    cards: KanbanCard[];
}

export const DEFAULT_COLUMNS: KanbanColumn[] = [
    { id: "todo", name: "Todo", order: 0 },
    { id: "inprogress", name: "In Progress", order: 1 },
    { id: "done", name: "Done", order: 2 },
];

function generateId(): string {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

/**
 * Parse a simple YAML front-matter block from file content.
 * Supports only the exact subset used by Kanban: flat key-value pairs and
 * arrays of objects with string/number values.
 * Returns null on parse failure (caller should treat file as legacy).
 */
function parseFrontMatter(content: string): { data: KanbanData; body: string } | null {
    if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
        return null;
    }

    const rest = content.slice(4);
    const endIdx = rest.search(/^---\s*$/m);
    if (endIdx === -1) {
        return null;
    }

    const yamlText = rest.slice(0, endIdx);
    const body = rest.slice(endIdx).replace(/^---\s*\n?/, "");

    try {
        const data = parseKanbanYaml(yamlText);
        return { data, body };
    } catch {
        return null;
    }
}

/**
 * Parse the Kanban-specific YAML structure.
 * Throws on unexpected format.
 */
function parseKanbanYaml(yaml: string): KanbanData {
    const lines = yaml.split("\n");
    let i = 0;

    const columns: KanbanColumn[] = [];
    const cards: KanbanCard[] = [];

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === "" || trimmed.startsWith("#")) {
            i++;
            continue;
        }

        if (trimmed === "kanban:columns:") {
            i++;
            while (i < lines.length) {
                const itemLine = lines[i];
                if (itemLine.trim() === "") {
                    i++;
                    continue;
                }
                // start of a new top-level key
                if (itemLine.match(/^[a-zA-Z]/)) break;
                // start of list item
                const itemMatch = itemLine.match(/^  - (.+)$/);
                if (!itemMatch) {
                    i++;
                    continue;
                }
                const col: Partial<KanbanColumn> = {};
                // parse first field on same line (if any)
                const firstField = itemMatch[1].trim();
                if (firstField !== "") {
                    const kv = parseKVPair(firstField);
                    if (kv) setColField(col, kv[0], kv[1]);
                }
                i++;
                // parse subsequent indented fields
                while (i < lines.length) {
                    const fieldLine = lines[i];
                    if (fieldLine.trim() === "") {
                        i++;
                        continue;
                    }
                    if (fieldLine.match(/^    - /) || fieldLine.match(/^  - /) || fieldLine.match(/^[a-zA-Z]/)) {
                        break;
                    }
                    const fieldMatch = fieldLine.match(/^    (.+)$/);
                    if (fieldMatch) {
                        const kv = parseKVPair(fieldMatch[1].trim());
                        if (kv) setColField(col, kv[0], kv[1]);
                    }
                    i++;
                }
                if (col.id != null && col.name != null && col.order != null) {
                    columns.push(col as KanbanColumn);
                }
            }
            continue;
        }

        if (trimmed === "kanban:cards:") {
            i++;
            while (i < lines.length) {
                const itemLine = lines[i];
                if (itemLine.trim() === "") {
                    i++;
                    continue;
                }
                // start of a new top-level key
                if (itemLine.match(/^[a-zA-Z]/)) break;
                const itemMatch = itemLine.match(/^  - (.+)$/);
                if (!itemMatch) {
                    i++;
                    continue;
                }
                const card: Partial<KanbanCard> = {};
                const firstField = itemMatch[1].trim();
                if (firstField !== "") {
                    const kv = parseKVPair(firstField);
                    if (kv) setCardField(card, kv[0], kv[1]);
                }
                i++;
                while (i < lines.length) {
                    const fieldLine = lines[i];
                    if (fieldLine.trim() === "") {
                        i++;
                        continue;
                    }
                    if (fieldLine.match(/^    - /) || fieldLine.match(/^  - /) || fieldLine.match(/^[a-zA-Z]/)) {
                        break;
                    }
                    const fieldMatch = fieldLine.match(/^    (.+)$/);
                    if (fieldMatch) {
                        const kv = parseKVPair(fieldMatch[1].trim());
                        if (kv) setCardField(card, kv[0], kv[1]);
                    }
                    i++;
                }
                if (card.id != null && card.col != null && card.text != null && card.order != null) {
                    cards.push(card as KanbanCard);
                }
            }
            continue;
        }

        // unknown key — skip
        i++;
    }

    return { columns, cards };
}

function parseKVPair(s: string): [string, string] | null {
    const colonIdx = s.indexOf(":");
    if (colonIdx === -1) return null;
    const key = s.slice(0, colonIdx).trim();
    let value = s.slice(colonIdx + 1).trim();
    // strip surrounding quotes and unescape escape sequences
    if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1).replace(/''/g, "'");
    }
    return [key, value];
}

function setColField(col: Partial<KanbanColumn>, key: string, value: string): void {
    if (key === "id") col.id = value;
    else if (key === "name") col.name = value;
    else if (key === "order") col.order = parseFloat(value);
}

function setCardField(card: Partial<KanbanCard>, key: string, value: string): void {
    if (key === "id") card.id = value;
    else if (key === "col") card.col = value;
    else if (key === "text") card.text = value;
    else if (key === "order") card.order = parseFloat(value);
}

/**
 * Serialize KanbanData to the YAML front-matter format.
 */
function serializeFrontMatter(data: KanbanData): string {
    const lines: string[] = ["---"];

    lines.push("kanban:columns:");
    for (const col of data.columns) {
        lines.push(`  - id: ${col.id}`);
        lines.push(`    name: ${escapeYamlString(col.name)}`);
        lines.push(`    order: ${col.order}`);
    }

    lines.push("kanban:cards:");
    for (const card of data.cards) {
        lines.push(`  - id: ${card.id}`);
        lines.push(`    col: ${card.col}`);
        lines.push(`    text: ${escapeYamlString(card.text)}`);
        lines.push(`    order: ${card.order}`);
    }

    lines.push("---");
    return lines.join("\n") + "\n";
}

function escapeYamlString(s: string): string {
    // Wrap in double quotes if value contains special chars
    if (s === "" || /[:#\[\]{},\|>&*!'"@%`]/.test(s) || s.startsWith(" ") || s.endsWith(" ")) {
        return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    return s;
}

/**
 * Parse a file's content into KanbanData + body.
 * Falls back to empty data if front-matter is absent or invalid.
 */
export function parseKanbanFile(content: string): { data: KanbanData; body: string } {
    const result = parseFrontMatter(content);
    if (result != null) {
        return result;
    }
    // No valid front-matter — treat entire content as body
    return { data: { columns: [], cards: [] }, body: content };
}

/**
 * Reconstruct file content from KanbanData and markdown body.
 */
export function serializeKanbanFile(data: KanbanData, body: string): string {
    const fm = serializeFrontMatter(data);
    if (body && !body.startsWith("\n")) {
        return fm + "\n" + body;
    }
    return fm + body;
}

/**
 * Migrate a flat TODO list into Kanban format.
 * Unchecked items -> "todo" column; checked items -> "done" column.
 */
export function migrateFromTodoItems(content: string): KanbanData {
    const columns: KanbanColumn[] = [...DEFAULT_COLUMNS];
    const cards: KanbanCard[] = [];

    const lines = content.split("\n");
    let todoOrder = 1;
    let doneOrder = 1;

    for (const line of lines) {
        const unchecked = line.match(/^- \[ \] (.+)$/);
        if (unchecked) {
            cards.push({ id: generateId(), col: "todo", text: unchecked[1], order: todoOrder++ });
            continue;
        }
        const checked = line.match(/^- \[x\] (.+)$/);
        if (checked) {
            cards.push({ id: generateId(), col: "done", text: checked[1], order: doneOrder++ });
        }
    }

    return { columns, cards };
}

/**
 * Convert Kanban data back to flat GFM checkbox markdown.
 * Cards in "done" columns become checked, all others become unchecked.
 */
export function kanbanToTodoMarkdown(data: KanbanData): string {
    const doneColIds = new Set(data.columns.filter((c) => c.id === "done").map((c) => c.id));
    const sorted = [...data.cards].sort((a, b) => {
        // Group by column order, then card order within column
        const aCol = data.columns.find((c) => c.id === a.col);
        const bCol = data.columns.find((c) => c.id === b.col);
        const aColOrder = aCol?.order ?? 999;
        const bColOrder = bCol?.order ?? 999;
        if (aColOrder !== bColOrder) return aColOrder - bColOrder;
        return a.order - b.order;
    });

    const lines = sorted.map((card) => {
        const checked = doneColIds.has(card.col);
        return `- [${checked ? "x" : " "}] ${card.text}`;
    });

    return lines.join("\n") + (lines.length > 0 ? "\n" : "");
}

// ---- CRUD operations ----

export function addCard(data: KanbanData, colId: string, text: string): KanbanData {
    const colCards = data.cards.filter((c) => c.col === colId);
    const maxOrder = colCards.reduce((max, c) => Math.max(max, c.order), 0);
    const newCard: KanbanCard = { id: generateId(), col: colId, text: text.trim(), order: maxOrder + 1 };
    return { ...data, cards: [...data.cards, newCard] };
}

export function updateCard(data: KanbanData, cardId: string, text: string): KanbanData {
    return {
        ...data,
        cards: data.cards.map((c) => (c.id === cardId ? { ...c, text: text.trim() } : c)),
    };
}

export function deleteCard(data: KanbanData, cardId: string): KanbanData {
    return { ...data, cards: data.cards.filter((c) => c.id !== cardId) };
}

/**
 * Move card to a new column and position.
 * @param targetColId   destination column
 * @param beforeCardId  insert before this card (null = append at end)
 */
export function reorderCard(data: KanbanData, cardId: string, targetColId: string, beforeCardId: string | null): KanbanData {
    const card = data.cards.find((c) => c.id === cardId);
    if (!card) return data;

    // Remove from current position
    let cards = data.cards.filter((c) => c.id !== cardId);

    // Get cards in the target column after removal (re-order them sequentially)
    const colCards = cards.filter((c) => c.col === targetColId).sort((a, b) => a.order - b.order);

    // Find insertion index
    let insertIdx = colCards.length; // default: append
    if (beforeCardId != null) {
        const idx = colCards.findIndex((c) => c.id === beforeCardId);
        if (idx !== -1) insertIdx = idx;
    }

    // Build new order array for target col
    colCards.splice(insertIdx, 0, { ...card, col: targetColId });
    const reorderedColCards = colCards.map((c, i) => ({ ...c, order: i + 1 }));

    // Replace target column cards in full list
    const otherCards = cards.filter((c) => c.col !== targetColId);
    return { ...data, cards: [...otherCards, ...reorderedColCards] };
}

export function addColumn(data: KanbanData, name: string): KanbanData {
    const maxOrder = data.columns.reduce((max, c) => Math.max(max, c.order), -1);
    const id = name
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/g, "") + generateId().slice(0, 4);
    const newCol: KanbanColumn = { id, name: name.trim(), order: maxOrder + 1 };
    return { ...data, columns: [...data.columns, newCol] };
}

export function renameColumn(data: KanbanData, colId: string, newName: string): KanbanData {
    return {
        ...data,
        columns: data.columns.map((c) => (c.id === colId ? { ...c, name: newName.trim() } : c)),
    };
}

export function deleteColumn(data: KanbanData, colId: string): KanbanData {
    return {
        columns: data.columns.filter((c) => c.id !== colId),
        cards: data.cards.filter((c) => c.col !== colId),
    };
}

export function clearColumnCards(data: KanbanData, colId: string): KanbanData {
    return { ...data, cards: data.cards.filter((c) => c.col !== colId) };
}
