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
import { NotesComponent } from "./notes";
import { getNotesFilePath } from "./notes-util";

export { getNotesFilePath };

export class NotesViewModel implements ViewModel {
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    viewType = "notes";
    viewIcon = atom("note-sticky");
    viewName = atom("Notes");
    viewComponent = NotesComponent;

    // File content (loaded from disk)
    fileContent: PrimitiveAtom<string>;
    // Pending unsaved content
    pendingContent: PrimitiveAtom<string | null>;
    // Loading state
    isLoading: PrimitiveAtom<boolean>;
    // Error state
    error: PrimitiveAtom<string | null>;
    // Save status: "saved" | "saving" | "unsaved" | null
    saveStatus: PrimitiveAtom<"saved" | "saving" | "unsaved" | null>;

    // Connection from block meta
    connection: Atom<string>;
    // Notes file path (derived)
    notesPath: Atom<string>;

    // Monaco editor ref for programmatic access
    monacoRef: React.MutableRefObject<MonacoTypes.editor.IStandaloneCodeEditor | null>;

    private saveTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.monacoRef = { current: null };

        this.fileContent = atom("") as PrimitiveAtom<string>;
        this.pendingContent = atom(null) as PrimitiveAtom<string | null>;
        this.isLoading = atom(false) as PrimitiveAtom<boolean>;
        this.error = atom(null) as PrimitiveAtom<string | null>;
        this.saveStatus = atom(null) as PrimitiveAtom<"saved" | "saving" | "unsaved" | null>;

        this.connection = atom((get) => {
            const blockData = get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", this.blockId)));
            return blockData?.meta?.connection ?? "";
        });

        this.notesPath = atom((get) => {
            const tabBasedir = get(tabModel.getTabMetaAtom("tab:basedir")) as string | undefined;
            const blockData = get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", this.blockId)));
            const metaFile = blockData?.meta?.file ?? null;
            return getNotesFilePath(tabBasedir ?? "", metaFile);
        });
    }

    async loadContent(): Promise<void> {
        const notesPath = globalStore.get(this.notesPath);
        const conn = globalStore.get(this.connection);
        const remotePath = formatRemoteUri(notesPath, conn || "local");

        globalStore.set(this.isLoading, true);
        globalStore.set(this.error, null);

        try {
            const fileData = await RpcApi.FileReadCommand(TabRpcClient, { info: { path: remotePath } }, null);
            const content = fileData?.data64 ? atob(fileData.data64) : "";
            globalStore.set(this.fileContent, content);
            globalStore.set(this.pendingContent, null);
        } catch (e) {
            const errStr = String(e);
            if (errStr.includes("not found") || errStr.includes("ENOENT") || errStr.includes("no such file")) {
                // File doesn't exist yet - start with empty content
                globalStore.set(this.fileContent, "");
                globalStore.set(this.pendingContent, null);
            } else {
                globalStore.set(this.error, errStr);
            }
        } finally {
            globalStore.set(this.isLoading, false);
        }
    }

    scheduleAutoSave(content: string): void {
        globalStore.set(this.pendingContent, content);
        globalStore.set(this.saveStatus, "unsaved");

        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveContent(content);
        }, 1500);
    }

    async saveContent(content: string): Promise<void> {
        const notesPath = globalStore.get(this.notesPath);
        const conn = globalStore.get(this.connection);

        globalStore.set(this.saveStatus, "saving");

        try {
            // Ensure parent directory exists
            const parentDir = notesPath.substring(0, notesPath.lastIndexOf("/"));
            if (parentDir) {
                const parentRemotePath = formatRemoteUri(parentDir, conn || "local");
                try {
                    await RpcApi.FileMkdirCommand(TabRpcClient, { info: { path: parentRemotePath } });
                } catch {
                    // Directory may already exist
                }
            }

            const remotePath = formatRemoteUri(notesPath, conn || "local");
            await RpcApi.FileWriteCommand(TabRpcClient, {
                info: { path: remotePath },
                data64: btoa(unescape(encodeURIComponent(content))),
            });

            globalStore.set(this.fileContent, content);
            globalStore.set(this.pendingContent, null);
            globalStore.set(this.saveStatus, "saved");

            // Clear "saved" indicator after 2 seconds
            setTimeout(() => {
                const currentStatus = globalStore.get(this.saveStatus);
                if (currentStatus === "saved") {
                    globalStore.set(this.saveStatus, null);
                }
            }, 2000);
        } catch (e) {
            console.error("[Notes] Failed to save:", e);
            globalStore.set(this.saveStatus, "unsaved");
            pushNotification({
                id: "notes-save-error",
                icon: "triangle-exclamation",
                type: "error",
                title: "Notes Save Failed",
                message: String(e),
                timestamp: new Date().toISOString(),
                expiration: Date.now() + 8000,
                persistent: false,
            });
        }
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
