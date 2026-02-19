export const TODO_FILENAME = ".wave/TODO.md";

export interface TodoItem {
    text: string;
    checked: boolean;
    lineIndex: number;
    raw: string;
}

/**
 * Returns the TODO file path given a tab base directory and optional override file.
 */
export function getTodoFilePath(tabBasedir: string, metaFile: string | null): string {
    if (metaFile) {
        return metaFile;
    }
    if (!tabBasedir || tabBasedir === "~") {
        return `~/${TODO_FILENAME}`;
    }
    return `${tabBasedir}/${TODO_FILENAME}`;
}

/**
 * Parses markdown content and returns all checkbox todo items.
 * Only lines matching `- [ ] text` or `- [x] text` are returned.
 */
export function parseTodoItems(content: string): TodoItem[] {
    const lines = content.split("\n");
    const items: TodoItem[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const uncheckedMatch = line.match(/^- \[ \] (.+)$/);
        if (uncheckedMatch) {
            items.push({ text: uncheckedMatch[1], checked: false, lineIndex: i, raw: line });
            continue;
        }
        const checkedMatch = line.match(/^- \[x\] (.+)$/);
        if (checkedMatch) {
            items.push({ text: checkedMatch[1], checked: true, lineIndex: i, raw: line });
        }
    }
    return items;
}

/**
 * Toggles the checkbox at the given line index in the content.
 * Returns the new content with the toggle applied.
 */
export function toggleTodoItem(content: string, lineIndex: number): string {
    const lines = content.split("\n");
    const line = lines[lineIndex];
    if (line.startsWith("- [ ] ")) {
        lines[lineIndex] = line.replace("- [ ] ", "- [x] ");
    } else if (line.startsWith("- [x] ")) {
        lines[lineIndex] = line.replace("- [x] ", "- [ ] ");
    }
    return lines.join("\n");
}

/**
 * Serializes an array of TodoItems back into markdown.
 */
export function serializeTodoItems(items: TodoItem[]): string {
    return items.map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`).join("\n") + "\n";
}

/**
 * Returns true if the todo path is the default (.wave/TODO.md).
 */
export function isDefaultTodoPath(todoPath: string): boolean {
    return todoPath.endsWith(TODO_FILENAME);
}
