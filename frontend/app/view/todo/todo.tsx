import { globalStore } from "@/app/store/global";
import { CodeEditor } from "@/app/view/codeeditor/codeeditor";
import { makeIconClass } from "@/util/util";
import { useAtomValue, useSetAtom } from "jotai";
import type * as MonacoTypes from "monaco-editor";
import * as React from "react";
import { useEffect } from "react";
import type { TodoViewModel } from "./todo-model";
import { isDefaultTodoPath, parseTodoItems } from "./todo-util";
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

    const items = parseTodoItems(content);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            model.addTask(newTaskText);
        }
    };

    const unchecked = items.filter((i) => !i.checked);
    const checked = items.filter((i) => i.checked);

    return (
        <div className="todo-view">
            <div className="todo-items">
                {unchecked.map((item) => (
                    <div
                        key={item.lineIndex}
                        className="todo-item todo-item-unchecked"
                        onClick={() => model.toggleCheckbox(item.lineIndex)}
                    >
                        <span className="todo-checkbox">
                            <i className={makeIconClass("square", false)} />
                        </span>
                        <span className="todo-text">{item.text}</span>
                    </div>
                ))}
                {checked.length > 0 && (
                    <>
                        {unchecked.length > 0 && <div className="todo-section-divider" />}
                        {checked.map((item) => (
                            <div
                                key={item.lineIndex}
                                className="todo-item todo-item-checked"
                                onClick={() => model.toggleCheckbox(item.lineIndex)}
                            >
                                <span className="todo-checkbox">
                                    <i className={makeIconClass("square-check", false)} />
                                </span>
                                <span className="todo-text">{item.text}</span>
                            </div>
                        ))}
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
                    onKeyDown={handleKeyDown}
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
                <i className={makeIconClass("spinner", false) + " fa-spin"} />
                <span>Loading...</span>
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
