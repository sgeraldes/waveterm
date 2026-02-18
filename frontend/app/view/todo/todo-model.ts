// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { globalStore, WOS } from "@/app/store/global";
import { pushNotification } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { handleImagePaste } from "@/app/util/image-paste";
import { formatRemoteUri } from "@/util/waveutil";
import { atom, Atom, PrimitiveAtom } from "jotai";
import type * as MonacoTypes from "monaco-editor";
import { TodoComponent } from "./todo";
import { getTodoFilePath, toggleTodoItem } from "./todo-util";

export { getTodoFilePath };

export class TodoViewModel implements ViewModel {
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    viewType = "todo";
    viewIcon = atom("check-square");
    viewName = atom("TODO");
    viewComponent = TodoComponent;

    // File content (raw markdown)
    fileContent: PrimitiveAtom<string>;
    // Loading state
    isLoading: PrimitiveAtom<boolean>;
    // Error state
    error: PrimitiveAtom<string | null>;
    // View mode: "view" = interactive checklist, "edit" = raw markdown
    mode: PrimitiveAtom<"view" | "edit">;
    // Save status
    saveStatus: PrimitiveAtom<"saved" | "saving" | "unsaved" | null>;
    // New task input value
    newTaskText: PrimitiveAtom<string>;

    // Connection from block meta
    connection: Atom<string>;
    // TODO file path
    todoPath: Atom<string>;

    // Monaco editor ref
    monacoRef: React.MutableRefObject<MonacoTypes.editor.IStandaloneCodeEditor | null>;

    private saveTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.monacoRef = { current: null };

        this.fileContent = atom("") as PrimitiveAtom<string>;
        this.isLoading = atom(false) as PrimitiveAtom<boolean>;
        this.error = atom(null) as PrimitiveAtom<string | null>;
        this.mode = atom("view") as PrimitiveAtom<"view" | "edit">;
        this.saveStatus = atom(null) as PrimitiveAtom<"saved" | "saving" | "unsaved" | null>;
        this.newTaskText = atom("") as PrimitiveAtom<string>;

        this.connection = atom((get) => {
            const blockData = get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", this.blockId)));
            return blockData?.meta?.connection ?? "";
        });

        this.todoPath = atom((get) => {
            const tabBasedir = get(tabModel.getTabMetaAtom("tab:basedir")) as string | undefined;
            const blockData = get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", this.blockId)));
            const metaFile = blockData?.meta?.file ?? null;
            return getTodoFilePath(tabBasedir ?? "", metaFile);
        });
    }

    async loadContent(): Promise<void> {
        const todoPath = globalStore.get(this.todoPath);
        const conn = globalStore.get(this.connection);
        const remotePath = formatRemoteUri(todoPath, conn || "local");

        globalStore.set(this.isLoading, true);
        globalStore.set(this.error, null);

        try {
            const fileData = await RpcApi.FileReadCommand(TabRpcClient, { info: { path: remotePath } }, null);
            const content = fileData?.data64 ? atob(fileData.data64) : "";
            globalStore.set(this.fileContent, content);
        } catch (e) {
            const errStr = String(e);
            if (errStr.includes("not found") || errStr.includes("ENOENT") || errStr.includes("no such file")) {
                // File doesn't exist yet - start with empty content
                globalStore.set(this.fileContent, "");
            } else {
                globalStore.set(this.error, errStr);
            }
        } finally {
            globalStore.set(this.isLoading, false);
        }
    }

    async saveContent(content: string): Promise<void> {
        const todoPath = globalStore.get(this.todoPath);
        const conn = globalStore.get(this.connection);

        globalStore.set(this.saveStatus, "saving");

        try {
            // Ensure parent directory exists
            const parentDir = todoPath.substring(0, todoPath.lastIndexOf("/"));
            if (parentDir) {
                const parentRemotePath = formatRemoteUri(parentDir, conn || "local");
                try {
                    await RpcApi.FileMkdirCommand(TabRpcClient, { info: { path: parentRemotePath } });
                } catch {
                    // Directory may already exist
                }
            }

            const remotePath = formatRemoteUri(todoPath, conn || "local");
            await RpcApi.FileWriteCommand(TabRpcClient, {
                info: { path: remotePath },
                data64: btoa(unescape(encodeURIComponent(content))),
            });

            globalStore.set(this.fileContent, content);
            globalStore.set(this.saveStatus, "saved");

            setTimeout(() => {
                const currentStatus = globalStore.get(this.saveStatus);
                if (currentStatus === "saved") {
                    globalStore.set(this.saveStatus, null);
                }
            }, 2000);
        } catch (e) {
            console.error("[TODO] Failed to save:", e);
            globalStore.set(this.saveStatus, "unsaved");
            pushNotification({
                id: "todo-save-error",
                icon: "triangle-exclamation",
                type: "error",
                title: "TODO Save Failed",
                message: String(e),
                timestamp: new Date().toISOString(),
                expiration: Date.now() + 8000,
                persistent: false,
            });
        }
    }

    scheduleAutoSave(content: string): void {
        globalStore.set(this.saveStatus, "unsaved");
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveContent(content);
        }, 1500);
    }

    toggleCheckbox(lineIndex: number): void {
        const content = globalStore.get(this.fileContent);
        const newContent = toggleTodoItem(content, lineIndex);
        globalStore.set(this.fileContent, newContent);
        this.saveContent(newContent);
    }

    addTask(text: string): void {
        if (!text.trim()) return;
        const content = globalStore.get(this.fileContent);
        const newLine = `- [ ] ${text.trim()}`;
        const newContent = content ? content + newLine + "\n" : newLine + "\n";
        globalStore.set(this.fileContent, newContent);
        globalStore.set(this.newTaskText, "");
        this.saveContent(newContent);
    }

    async handlePasteImage(clipboardData: DataTransfer): Promise<string | null> {
        const conn = globalStore.get(this.connection);
        const tabBasedir = globalStore.get(this.tabModel.getTabMetaAtom("tab:basedir")) as string | undefined;
        return handleImagePaste(clipboardData, tabBasedir ?? "", conn);
    }

    insertTextAtCursor(text: string): void {
        const editor = this.monacoRef.current;
        if (!editor) return;
        const selection = editor.getSelection();
        if (!selection) return;
        editor.executeEdits("image-paste", [
            {
                range: selection,
                text,
                forceMoveMarkers: true,
            },
        ]);
    }

    giveFocus(): boolean {
        if (this.monacoRef.current) {
            this.monacoRef.current.focus();
            return true;
        }
        return false;
    }
}
