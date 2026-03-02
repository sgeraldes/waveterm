import { ContextMenuModel } from "@/app/store/contextmenu";
import { globalStore } from "@/app/store/global";
import { CodeEditor } from "@/app/view/codeeditor/codeeditor";
import { LoadingSpinner } from "@/element/spinner";
import { makeIconClass } from "@/util/util";
import clsx from "clsx";
import { useAtomValue, useSetAtom } from "jotai";
import type * as MonacoTypes from "monaco-editor";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { renderInlineMarkdown } from "./todo-markdown";
import type { TodoViewModel } from "./todo-model";
import { isDefaultTodoPath, parseTodoItems, type TodoItem } from "./todo-util";
import "./todo.scss";

type TodoComponentProps = {
    blockId: string;
    blockRef?: React.RefObject<HTMLDivElement>;
    contentRef?: React.RefObject<HTMLDivElement>;
    model: TodoViewModel;
};

function TodoViewMode({ model }: { model: TodoViewModel }) {
    const content = useAtomValue(model.fileContent);
    const newTaskText = useAtomValue(model.newTaskText);
    const setNewTaskText = useSetAtom(model.newTaskText);
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
    const [editingText, setEditingText] = useState("");
    const draggingLineIndex = useRef<number | null>(null);
    const [dragOverLineIndex, setDragOverLineIndex] = useState<number | null>(null);

    const items = parseTodoItems(content);

    const startEdit = (item: TodoItem) => {
        setEditingLineIndex(item.lineIndex);
        setEditingText(item.text);
    };

    const commitEdit = () => {
        if (editingLineIndex !== null) {
            model.editTask(editingLineIndex, editingText);
        }
        setEditingLineIndex(null);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") commitEdit();
        if (e.key === "Escape") setEditingLineIndex(null);
    };

    const handleNewTaskKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") model.addTask(newTaskText);
    };

    const handleItemContextMenu = (e: React.MouseEvent, item: TodoItem) => {
        e.preventDefault();
        e.stopPropagation();
        const menuItems: ContextMenuItem[] = [
            {
                label: "Edit",
                click: () => startEdit(item),
            },
            {
                label: item.checked ? "Uncomplete" : "Complete",
                click: () => model.toggleCheckbox(item.lineIndex),
            },
            { type: "separator" },
            {
                label: "Delete",
                click: () => model.deleteTask(item.lineIndex),
            },
        ];
        ContextMenuModel.showContextMenu(menuItems, e);
    };

    const renderItem = (item: TodoItem) => {
        const isEditing = editingLineIndex === item.lineIndex;
        const isDragOver = dragOverLineIndex === item.lineIndex;

        return (
            <div
                key={item.lineIndex}
                className={clsx("todo-item", {
                    "todo-item-unchecked": !item.checked,
                    "todo-item-checked": item.checked,
                    "todo-item-drag-over": isDragOver,
                })}
                draggable
                onDragStart={() => {
                    draggingLineIndex.current = item.lineIndex;
                }}
                onDragEnd={() => {
                    draggingLineIndex.current = null;
                    setDragOverLineIndex(null);
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverLineIndex(item.lineIndex);
                }}
                onDragLeave={() => setDragOverLineIndex(null)}
                onDrop={() => {
                    if (draggingLineIndex.current !== null && draggingLineIndex.current !== item.lineIndex) {
                        model.reorderTasks(draggingLineIndex.current, item.lineIndex);
                    }
                    draggingLineIndex.current = null;
                    setDragOverLineIndex(null);
                }}
                onContextMenu={(e) => handleItemContextMenu(e, item)}
            >
                <span
                    className="todo-checkbox"
                    role="button"
                    tabIndex={0}
                    onClick={() => model.toggleCheckbox(item.lineIndex)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); model.toggleCheckbox(item.lineIndex); } }}
                >
                    <i className={makeIconClass(item.checked ? "square-check" : "square", false)} />
                </span>
                {isEditing ? (
                    <input
                        className="todo-inline-edit"
                        autoFocus
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleEditKeyDown}
                    />
                ) : (
                    <span
                        className="todo-text"
                        role="button"
                        tabIndex={0}
                        onClick={() => startEdit(item)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(item); } }}
                    >
                        {renderInlineMarkdown(item.text)}
                    </span>
                )}
            </div>
        );
    };

    const unchecked = items.filter((i) => !i.checked);
    const checked = items.filter((i) => i.checked);

    return (
        <div className="todo-view">
            <div className="todo-items">
                {unchecked.map(renderItem)}
                {checked.length > 0 && (
                    <>
                        {unchecked.length > 0 && <div className="todo-section-divider" />}
                        {checked.map(renderItem)}
                    </>
                )}
                {items.length === 0 && <div className="todo-empty">No tasks yet. Add one below.</div>}
            </div>
            <div className="todo-add-task">
                <i className={makeIconClass("plus", false)} />
                <input
                    type="text"
                    placeholder="Add a task..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={handleNewTaskKeyDown}
                />
            </div>
        </div>
    );
}

function TodoEditMode({ blockId, model }: { blockId: string; model: TodoViewModel }) {
    const fileContent = useAtomValue(model.fileContent);
    const connection = useAtomValue(model.connection);
    const isLocal = !connection || connection === "local";

    function onMount(editor: MonacoTypes.editor.IStandaloneCodeEditor): () => void {
        model.monacoRef.current = editor;

        const pasteDisposer = editor.onDidPaste(async () => {
            setTimeout(async () => {
                try {
                    const clipboardItems = await navigator.clipboard.read();
                    for (const item of clipboardItems) {
                        const imageType = item.types.find((t) => t.startsWith("image/"));
                        if (imageType && isLocal) {
                            const blob = await item.getType(imageType);
                            const dataTransfer = new DataTransfer();
                            const file = new File([blob], "pasted.png", { type: imageType });
                            dataTransfer.items.add(file);
                            const markdownRef = await model.handlePasteImage(dataTransfer);
                            if (markdownRef) {
                                model.insertTextAtCursor(markdownRef);
                            }
                            break;
                        }
                    }
                } catch {
                    /* clipboard access may be denied */
                }
            }, 50);
        });

        const isFocused = globalStore.get(model.nodeModel.isFocused);
        if (isFocused) {
            editor.focus();
        }

        return () => {
            pasteDisposer.dispose();
            model.monacoRef.current = null;
        };
    }

    return (
        <CodeEditor
            blockId={blockId}
            text={fileContent}
            language="markdown"
            readonly={false}
            onChange={(text) => model.scheduleAutoSave(text)}
            onMount={onMount}
        />
    );
}

export function TodoComponent({ blockId, model }: TodoComponentProps) {
    const isLoading = useAtomValue(model.isLoading);
    const error = useAtomValue(model.error);
    const mode = useAtomValue(model.mode);
    const saveStatus = useAtomValue(model.saveStatus);
    const todoPath = useAtomValue(model.todoPath);

    useEffect(() => {
        model.loadContent();
    }, [todoPath]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest(".todo-item") || target.closest(".todo-add-task")) return;
        if (mode === "view") {
            globalStore.set(model.mode, "edit");
        }
    };

    if (isLoading) {
        return (
            <div className="todo-loading">
                <LoadingSpinner size="normal" message="Loading..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="todo-error">
                <i className={makeIconClass("triangle-exclamation", false)} />
                <span>{error}</span>
                <button onClick={() => model.loadContent()}>Retry</button>
            </div>
        );
    }

    const isDefaultPath = isDefaultTodoPath(todoPath);
    const hasStatusContent = saveStatus != null || !isDefaultPath;

    return (
        <div className="todo-container" onDoubleClick={handleDoubleClick}>
            {hasStatusContent && (
                <div className="todo-status-bar">
                    {!isDefaultPath && (
                        <span className="todo-path" title={todoPath}>
                            {todoPath.split("/").pop() || todoPath}
                        </span>
                    )}
                    {saveStatus === "saving" && <span className="todo-saving">Saving...</span>}
                    {saveStatus === "saved" && <span className="todo-saved">Saved</span>}
                </div>
            )}
            <div className="todo-content">
                {mode === "view" ? <TodoViewMode model={model} /> : <TodoEditMode blockId={blockId} model={model} />}
            </div>
        </div>
    );
}
