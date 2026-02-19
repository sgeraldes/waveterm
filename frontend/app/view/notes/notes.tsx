import { globalStore } from "@/app/store/global";
import { CodeEditor } from "@/app/view/codeeditor/codeeditor";
import { makeIconClass } from "@/util/util";
import { useAtomValue } from "jotai";
import type * as MonacoTypes from "monaco-editor";
import * as React from "react";
import { useEffect } from "react";
import type { NotesViewModel } from "./notes-model";
import { isDefaultNotesPath } from "./notes-util";
import "./notes.scss";

type NotesComponentProps = {
    blockId: string;
    blockRef?: React.RefObject<HTMLDivElement>;
    contentRef?: React.RefObject<HTMLDivElement>;
    model: NotesViewModel;
};

export function NotesComponent({ blockId, model }: NotesComponentProps) {
    const fileContent = useAtomValue(model.fileContent);
    const isLoading = useAtomValue(model.isLoading);
    const error = useAtomValue(model.error);
    const saveStatus = useAtomValue(model.saveStatus);
    const notesPath = useAtomValue(model.notesPath);
    const connection = useAtomValue(model.connection);
    const isLocal = !connection || connection === "local";

    useEffect(() => {
        model.loadContent();
    }, [notesPath]);

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

        const focusAtom = model.nodeModel.isFocused;
        const isFocused = globalStore.get(focusAtom);
        if (isFocused) {
            editor.focus();
        }

        return () => {
            pasteDisposer.dispose();
            model.monacoRef.current = null;
        };
    }

    if (isLoading) {
        return (
            <div className="notes-loading">
                <i className={makeIconClass("spinner", false) + " fa-spin"} />
                <span>Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="notes-error">
                <i className={makeIconClass("triangle-exclamation", false)} />
                <span>{error}</span>
                <button onClick={() => model.loadContent()}>Retry</button>
            </div>
        );
    }

    const isDefaultPath = isDefaultNotesPath(notesPath);
    const hasStatusContent = saveStatus != null || !isDefaultPath || !isLocal;

    return (
        <div className="notes-container">
            {hasStatusContent && (
                <div className="notes-status-bar">
                    {!isDefaultPath && (
                        <span className="notes-path" title={notesPath}>
                            {notesPath.split("/").pop() || notesPath}
                        </span>
                    )}
                    {saveStatus === "saving" && <span className="notes-saving">Saving...</span>}
                    {saveStatus === "saved" && <span className="notes-saved">Saved</span>}
                    {!isLocal && (
                        <span className="notes-remote-hint" title="Image paste is only available for local connections">
                            Remote
                        </span>
                    )}
                </div>
            )}
            <div className="notes-editor">
                <CodeEditor
                    blockId={blockId}
                    text={fileContent}
                    fileName={notesPath}
                    language="markdown"
                    readonly={false}
                    onChange={(text) => model.scheduleAutoSave(text)}
                    onMount={onMount}
                />
            </div>
        </div>
    );
}
