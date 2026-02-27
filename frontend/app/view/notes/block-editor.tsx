// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Markdown } from "@/element/markdown";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./block-editor.scss";

interface Block {
    id: string;
    content: string;
    type: "paragraph" | "heading" | "code" | "list-item" | "image";
}

interface BlockEditorProps {
    content: string;
    onChange: (content: string) => void;
    resolveOpts?: MarkdownResolveOpts;
    onImagePaste?: (clipboardData: DataTransfer) => Promise<string | null>;
}

function parseMarkdownIntoBlocks(markdown: string): Block[] {
    if (!markdown) return [];

    const blocks: Block[] = [];
    const lines = markdown.split("\n");
    let currentBlock: string[] = [];
    let blockType: Block["type"] = "paragraph";
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

        // Code block detection
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

        // Empty line = block boundary
        if (line.trim() === "") {
            flushBlock();
            continue;
        }

        // Heading - each heading is its own block
        if (line.match(/^#{1,6}\s/)) {
            flushBlock();
            blockType = "heading";
            currentBlock.push(line);
            flushBlock();
            continue;
        }

        // List item - EACH LIST ITEM IS ITS OWN BLOCK
        if (line.match(/^(\s*[-*+]\s|\s*\d+\.\s)/)) {
            flushBlock();
            blockType = "list-item";
            currentBlock.push(line);
            flushBlock();
            continue;
        }

        // Image - each image is its own block
        if (line.match(/^!\[.*\]\(.*\)/)) {
            flushBlock();
            blockType = "image";
            currentBlock.push(line);
            flushBlock();
            continue;
        }

        // Regular paragraph - accumulate lines until we hit a different block type
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
    return blocks.map((block) => block.content).join("\n\n");
}

const EditableBlock = React.memo(
    ({
        block,
        isEditing,
        onStartEdit,
        onFinishEdit,
        onNavigateUp,
        onNavigateDown,
        onImagePaste,
        resolveOpts,
    }: {
        block: Block;
        isEditing: boolean;
        onStartEdit: () => void;
        onFinishEdit: (newContent: string) => void;
        onNavigateUp: () => void;
        onNavigateDown: () => void;
        onImagePaste?: (clipboardData: DataTransfer) => Promise<string | null>;
        resolveOpts?: MarkdownResolveOpts;
    }) => {
        const [editValue, setEditValue] = useState(block.content);
        const editableRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (isEditing && editableRef.current) {
                editableRef.current.focus();
                // Place cursor at end
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(editableRef.current);
                range.collapse(false);
                sel?.removeAllRanges();
                sel?.addRange(range);
            }
        }, [isEditing]);

        useEffect(() => {
            if (isEditing) {
                setEditValue(block.content);
            }
        }, [isEditing, block.content]);

        const handleBlur = useCallback(() => {
            if (editableRef.current) {
                const newContent = editableRef.current.textContent || "";
                onFinishEdit(newContent);
            }
        }, [onFinishEdit]);

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    const newContent = editableRef.current?.textContent || "";
                    onFinishEdit(newContent);
                    return;
                }

                // Arrow key navigation between blocks
                if (e.key === "ArrowUp") {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        // If cursor is at the beginning of the block, navigate up
                        if (range.startOffset === 0 && range.startContainer === editableRef.current?.firstChild) {
                            e.preventDefault();
                            const newContent = editableRef.current?.textContent || "";
                            onFinishEdit(newContent);
                            onNavigateUp();
                        }
                    }
                } else if (e.key === "ArrowDown") {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        const lastNode = editableRef.current?.lastChild || editableRef.current;
                        const textLength = lastNode?.textContent?.length || 0;
                        // If cursor is at the end of the block, navigate down
                        if (
                            range.endOffset === textLength &&
                            (range.endContainer === lastNode || range.endContainer === editableRef.current)
                        ) {
                            e.preventDefault();
                            const newContent = editableRef.current?.textContent || "";
                            onFinishEdit(newContent);
                            onNavigateDown();
                        }
                    }
                }
            },
            [onFinishEdit, onNavigateUp, onNavigateDown]
        );

        const handlePaste = useCallback(
            async (e: React.ClipboardEvent<HTMLDivElement>) => {
                if (!onImagePaste || !e.clipboardData) return;

                const hasImage = Array.from(e.clipboardData.items).some((item) => item.type.startsWith("image/"));
                if (!hasImage) return;

                e.preventDefault();
                const markdownRef = await onImagePaste(e.clipboardData);
                if (markdownRef && editableRef.current) {
                    // Insert the markdown image reference at cursor position
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        const textNode = document.createTextNode(markdownRef);
                        range.insertNode(textNode);
                        range.setStartAfter(textNode);
                        range.setEndAfter(textNode);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            },
            [onImagePaste]
        );

        if (isEditing) {
            return (
                <div className="block-editor-editing">
                    <div
                        ref={editableRef}
                        className="block-editor-editable"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                    >
                        {block.content}
                    </div>
                </div>
            );
        }

        return (
            <div className="block-editor-rendered" onClick={onStartEdit}>
                <Markdown text={block.content} resolveOpts={resolveOpts} />
            </div>
        );
    }
);

export const BlockEditor: React.FC<BlockEditorProps> = ({ content, onChange, resolveOpts, onImagePaste }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
    const [localBlocks, setLocalBlocks] = useState<Block[]>(blocks);

    useEffect(() => {
        setLocalBlocks(blocks);
    }, [blocks]);

    const handleStartEdit = useCallback((blockId: string) => {
        setEditingBlockId(blockId);
    }, []);

    const handleFinishEdit = useCallback(
        (blockId: string, newContent: string) => {
            setEditingBlockId(null);
            const updatedBlocks = localBlocks.map((b) => (b.id === blockId ? { ...b, content: newContent } : b));
            setLocalBlocks(updatedBlocks);
            const newMarkdown = joinBlocksIntoMarkdown(updatedBlocks);
            onChange(newMarkdown);
        },
        [localBlocks, onChange]
    );

    const handleNavigateUp = useCallback(
        (currentBlockId: string) => {
            const currentIndex = localBlocks.findIndex((b) => b.id === currentBlockId);
            if (currentIndex > 0) {
                const prevBlockId = localBlocks[currentIndex - 1].id;
                setEditingBlockId(prevBlockId);
            }
        },
        [localBlocks]
    );

    const handleNavigateDown = useCallback(
        (currentBlockId: string) => {
            const currentIndex = localBlocks.findIndex((b) => b.id === currentBlockId);
            if (currentIndex < localBlocks.length - 1) {
                const nextBlockId = localBlocks[currentIndex + 1].id;
                setEditingBlockId(nextBlockId);
            }
        },
        [localBlocks]
    );

    if (localBlocks.length === 0) {
        return (
            <div className="block-editor-empty" onClick={() => onChange("Start writing...")}>
                Click to start writing...
            </div>
        );
    }

    return (
        <div className="block-editor-container">
            {localBlocks.map((block) => (
                <EditableBlock
                    key={block.id}
                    block={block}
                    isEditing={editingBlockId === block.id}
                    onStartEdit={() => handleStartEdit(block.id)}
                    onFinishEdit={(newContent) => handleFinishEdit(block.id, newContent)}
                    onNavigateUp={() => handleNavigateUp(block.id)}
                    onNavigateDown={() => handleNavigateDown(block.id)}
                    onImagePaste={onImagePaste}
                    resolveOpts={resolveOpts}
                />
            ))}
        </div>
    );
};
