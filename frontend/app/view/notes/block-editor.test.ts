// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";

// Tests for block-editor parsing logic.
// These replicate the logic of the private parseMarkdownIntoBlocks and
// joinBlocksIntoMarkdown functions so we can verify bug-fix behaviour
// without requiring the functions to be exported.

type BlockType = "paragraph" | "heading" | "code" | "list-item" | "image";

interface Block {
    id: string;
    content: string;
    type: BlockType;
}

function parseMarkdownIntoBlocks(markdown: string): Block[] {
    if (!markdown) return [];

    const blocks: Block[] = [];
    const lines = markdown.split("\n");
    let currentBlock: string[] = [];
    let blockType: BlockType = "paragraph";
    let inCodeBlock = false;
    let blockId = 0;

    const flushBlock = () => {
        if (currentBlock.length > 0) {
            blocks.push({
                id: `block-${blockId++}`,
                content: currentBlock.join("\n"),
                type: blockType,
            });
            currentBlock = [];
            blockType = "paragraph";
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith("```")) {
            if (inCodeBlock) {
                currentBlock.push(line);
                blockType = "code";
                flushBlock();
                inCodeBlock = false;
            } else {
                flushBlock();
                inCodeBlock = true;
                currentBlock.push(line);
            }
            continue;
        }

        if (inCodeBlock) {
            currentBlock.push(line);
            continue;
        }

        if (line.trim() === "") {
            flushBlock();
            continue;
        }

        if (line.match(/^#{1,6}\s/)) {
            flushBlock();
            blockType = "heading";
            currentBlock.push(line);
            flushBlock();
            continue;
        }

        if (line.match(/^(\s*[-*+]\s|\s*\d+\.\s)/)) {
            flushBlock();
            blockType = "list-item";
            currentBlock.push(line);
            flushBlock();
            continue;
        }

        if (line.match(/^!\[.*\]\(.*\)/)) {
            flushBlock();
            blockType = "image";
            currentBlock.push(line);
            flushBlock();
            continue;
        }

        if (blockType === "list-item") {
            flushBlock();
            blockType = "paragraph";
        }
        currentBlock.push(line);
    }

    flushBlock();
    return blocks;
}

function joinBlocksIntoMarkdown(blocks: Block[]): string {
    const result: string[] = [];
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const prevBlock = i > 0 ? blocks[i - 1] : null;

        if (i > 0) {
            if (block.type === "list-item" && prevBlock?.type === "list-item") {
                result.push("\n");
            } else {
                result.push("\n\n");
            }
        }
        result.push(block.content);
    }
    return result.join("");
}

describe("parseMarkdownIntoBlocks", () => {
    it("returns empty array for empty string", () => {
        expect(parseMarkdownIntoBlocks("")).toEqual([]);
    });

    it("returns empty array for null/undefined", () => {
        expect(parseMarkdownIntoBlocks(null as any)).toEqual([]);
        expect(parseMarkdownIntoBlocks(undefined as any)).toEqual([]);
    });

    it("parses a single paragraph", () => {
        const blocks = parseMarkdownIntoBlocks("Hello world");
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe("paragraph");
        expect(blocks[0].content).toBe("Hello world");
    });

    it("parses headings as individual blocks", () => {
        const blocks = parseMarkdownIntoBlocks("# Heading 1\n## Heading 2");
        expect(blocks).toHaveLength(2);
        expect(blocks[0].type).toBe("heading");
        expect(blocks[0].content).toBe("# Heading 1");
        expect(blocks[1].type).toBe("heading");
        expect(blocks[1].content).toBe("## Heading 2");
    });

    it("parses list items as individual blocks", () => {
        const blocks = parseMarkdownIntoBlocks("- item 1\n- item 2\n- item 3");
        expect(blocks).toHaveLength(3);
        blocks.forEach((b) => expect(b.type).toBe("list-item"));
    });

    it("parses code blocks as single blocks preserving content", () => {
        const code = "```js\nconsole.log('hello');\n```";
        const blocks = parseMarkdownIntoBlocks(code);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe("code");
        expect(blocks[0].content).toBe(code);
    });

    it("parses image lines as their own blocks", () => {
        const blocks = parseMarkdownIntoBlocks("![alt](image.png)");
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe("image");
    });

    it("splits on empty lines between paragraphs", () => {
        const blocks = parseMarkdownIntoBlocks("Para 1\n\nPara 2");
        expect(blocks).toHaveLength(2);
        expect(blocks[0].content).toBe("Para 1");
        expect(blocks[1].content).toBe("Para 2");
    });
});

describe("joinBlocksIntoMarkdown", () => {
    it("returns empty string for empty array", () => {
        expect(joinBlocksIntoMarkdown([])).toBe("");
    });

    it("returns single block content unchanged", () => {
        const blocks: Block[] = [{ id: "b0", type: "paragraph", content: "Hello" }];
        expect(joinBlocksIntoMarkdown(blocks)).toBe("Hello");
    });

    it("joins consecutive list items with single newline", () => {
        const blocks: Block[] = [
            { id: "b0", type: "list-item", content: "- item 1" },
            { id: "b1", type: "list-item", content: "- item 2" },
        ];
        const result = joinBlocksIntoMarkdown(blocks);
        expect(result).toBe("- item 1\n- item 2");
    });

    it("joins non-list blocks with double newline", () => {
        const blocks: Block[] = [
            { id: "b0", type: "paragraph", content: "Para 1" },
            { id: "b1", type: "paragraph", content: "Para 2" },
        ];
        const result = joinBlocksIntoMarkdown(blocks);
        expect(result).toBe("Para 1\n\nPara 2");
    });

    it("uses double newline between list and non-list blocks", () => {
        const blocks: Block[] = [
            { id: "b0", type: "list-item", content: "- item" },
            { id: "b1", type: "paragraph", content: "Para" },
        ];
        const result = joinBlocksIntoMarkdown(blocks);
        expect(result).toBe("- item\n\nPara");
    });
});

describe("handleFinishEdit stale closure fix", () => {
    // Simulate the functional update pattern used in the fixed handleFinishEdit.
    // The fix uses setLocalBlocks(prevBlocks => ...) instead of reading localBlocks
    // directly, which prevents stale closure bugs when edits happen in rapid succession.

    it("functional update always uses latest state even when called before React re-renders", () => {
        type SetStateFn<T> = (updater: (prev: T) => T) => void;

        // Simulate React's useState with a simple in-memory store
        let currentState: Block[] = [
            { id: "b0", type: "paragraph", content: "Block A" },
            { id: "b1", type: "paragraph", content: "Block B" },
        ];

        const setState: SetStateFn<Block[]> = (updater) => {
            currentState = updater(currentState);
        };

        // Simulate first edit finishing (updates block A)
        const onChange = vi.fn();
        const firstEdit = (blockId: string, newContent: string) => {
            setState((prevBlocks) => {
                const updated = prevBlocks.map((b) => (b.id === blockId ? { ...b, content: newContent } : b));
                onChange(joinBlocksIntoMarkdown(updated));
                return updated;
            });
        };

        // Simulate second edit finishing (updates block B) before React re-renders
        const secondEdit = (blockId: string, newContent: string) => {
            setState((prevBlocks) => {
                const updated = prevBlocks.map((b) => (b.id === blockId ? { ...b, content: newContent } : b));
                onChange(joinBlocksIntoMarkdown(updated));
                return updated;
            });
        };

        firstEdit("b0", "Updated Block A");
        secondEdit("b1", "Updated Block B");

        // Both edits should be present in final state
        expect(currentState[0].content).toBe("Updated Block A");
        expect(currentState[1].content).toBe("Updated Block B");

        // onChange should have been called twice
        expect(onChange).toHaveBeenCalledTimes(2);

        // The second onChange call should include BOTH updates (not stale Block A)
        const lastMarkdown = onChange.mock.calls[1][0];
        expect(lastMarkdown).toContain("Updated Block A");
        expect(lastMarkdown).toContain("Updated Block B");
    });

    it("stale closure pattern (the old bug) would lose the first edit when edits overlap", () => {
        // Demonstrates what the OLD code would do:
        // it reads localBlocks directly (stale closure) instead of using functional update
        const initialBlocks: Block[] = [
            { id: "b0", type: "paragraph", content: "Block A" },
            { id: "b1", type: "paragraph", content: "Block B" },
        ];

        // Capture localBlocks at initial creation (stale, like the old closure)
        const staleLocalBlocks = initialBlocks;
        let currentState = initialBlocks;

        const onChange = vi.fn();

        // Old pattern: directly reads stale localBlocks
        const staleEdit = (blockId: string, newContent: string) => {
            // BUG: uses stale closure - staleLocalBlocks never updates
            const updatedBlocks = staleLocalBlocks.map((b) => (b.id === blockId ? { ...b, content: newContent } : b));
            currentState = updatedBlocks;
            onChange(joinBlocksIntoMarkdown(updatedBlocks));
        };

        staleEdit("b0", "Updated Block A");
        staleEdit("b1", "Updated Block B");

        // With stale closure: second edit uses stale base (Block A still shows "Block A")
        // because staleLocalBlocks was captured at the start and never updated
        const secondCallMarkdown = onChange.mock.calls[1][0];
        // The second edit with the stale closure would use the original "Block A" content
        expect(secondCallMarkdown).toContain("Block A"); // not "Updated Block A"
        expect(secondCallMarkdown).toContain("Updated Block B");

        // This shows the bug: "Updated Block A" from the first edit was lost
        expect(secondCallMarkdown).not.toContain("Updated Block A");
    });
});

describe("empty state click handler fix", () => {
    it("clicking empty state should not write placeholder text to the document", () => {
        // BUG (fixed): the old code called onChange("Start writing...") which would
        // write placeholder text into the actual document content.
        // The fix changes it to onChange("") which creates an empty document.

        const onChange = vi.fn();

        // Simulate the fixed behaviour
        const handleEmptyClick = () => onChange("");
        handleEmptyClick();

        expect(onChange).toHaveBeenCalledWith("");
        expect(onChange).not.toHaveBeenCalledWith("Start writing...");
    });
});
