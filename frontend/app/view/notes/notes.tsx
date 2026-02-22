import { globalStore } from "@/app/store/global";
import { CodeEditor } from "@/app/view/codeeditor/codeeditor";
import { Markdown } from "@/element/markdown";
import { makeIconClass } from "@/util/util";
import { useAtomValue } from "jotai";
import type * as MonacoTypes from "monaco-editor";
import * as React from "react";
import { useEffect, useMemo } from "react";
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
    const hasEverLoaded = useAtomValue(model.hasEverLoaded);
    const previewMode = useAtomValue(model.previewMode);
    const isLocal = !connection || connection === "local";
    const resolveOpts: MarkdownResolveOpts = useMemo(
        () => ({
            connName: connection || "local",
            baseDir: notesPath ? notesPath.substring(0, notesPath.lastIndexOf("/")) : "",
        }),
        [connection, notesPath]
    );

    // Notes-specific Monaco overrides: word wrap on, always-visible scrollbar
    const notesEditorOverrides = useMemo<Partial<MonacoTypes.editor.IEditorOptions>>(
        () => ({
            wordWrap: "on",
            scrollbar: {
                vertical: "visible",
                verticalScrollbarSize: 10,
                useShadows: true,
            },
        }),
        []
    );

    useEffect(() => {
        model.loadContent();
    }, [notesPath]);

    function onMount(editor: MonacoTypes.editor.IStandaloneCodeEditor): () => void {
        model.monacoRef.current = editor;

        editor.updateOptions({
            lineNumbers: "off",
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 4,
            automaticLayout: true,
        });

        const domNode = editor.getDomNode();
        const handleDomPaste = async (e: ClipboardEvent) => {
            if (!e.clipboardData) return;
            const hasImage = Array.from(e.clipboardData.items).some((item) => item.type.startsWith("image/"));
            if (!hasImage) return;
            e.preventDefault();
            const markdownRef = await model.handlePasteImage(e.clipboardData);
            if (markdownRef) {
                model.insertTextAtCursor(markdownRef);
            }
        };
        if (domNode) {
            domNode.addEventListener("paste", handleDomPaste as EventListener);
        }

        const focusAtom = model.nodeModel.isFocused;
        const isFocused = globalStore.get(focusAtom);
        if (isFocused) {
            editor.focus();
        }

        return () => {
            if (domNode) {
                domNode.removeEventListener("paste", handleDomPaste as EventListener);
            }
            model.monacoRef.current = null;
        };
    }

    if (error && !hasEverLoaded) {
        return (
            <div className="notes-error">
                <i className={makeIconClass("triangle-exclamation", false)} />
                <span>{error}</span>
                <button onClick={() => model.loadContent()}>Retry</button>
            </div>
        );
    }

    const isDefaultPath = isDefaultNotesPath(notesPath);
    const hasStatusContent = isLoading || (error && hasEverLoaded) || saveStatus != null || !isDefaultPath || !isLocal;

    const editorPane = (
        <div className="notes-editor">
            <CodeEditor
                blockId={blockId}
                text={fileContent}
                fileName={notesPath}
                language="markdown"
                readonly={false}
                onChange={(text) => model.scheduleAutoSave(text)}
                onMount={onMount}
                optionOverrides={notesEditorOverrides}
            />
        </div>
    );

    const previewPane = (
        <div className="notes-preview-panel">
            <Markdown
                textAtom={model.liveContent}
                resolveOpts={resolveOpts}
                contentClassName="pt-[5px] pr-[15px] pb-[10px] pl-[15px]"
            />
        </div>
    );

    return (
        <div className={`notes-container notes-mode-${previewMode}`}>
            {hasStatusContent && (
                <div className="notes-status-bar">
                    {!isDefaultPath && (
                        <span className="notes-path" title={notesPath}>
                            {notesPath.split("/").pop() || notesPath}
                        </span>
                    )}
                    {isLoading && <span className="notes-status-loading">Loading...</span>}
                    {error && hasEverLoaded && !isLoading && (
                        <span className="notes-status-error" title={error}>
                            <i className={makeIconClass("triangle-exclamation", false)} /> Error
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
            <div className="notes-content-area">
                {previewMode !== "preview" && editorPane}
                {previewMode !== "editor" && previewPane}
            </div>
        </div>
    );
}
