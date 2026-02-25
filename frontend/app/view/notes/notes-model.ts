import type { BlockNodeModel } from "@/app/block/blocktypes";
import { createBlock, globalStore, pushNotification, WOS } from "@/app/store/global";
import type { TabModel } from "@/app/store/tab-model";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { handleImagePaste } from "@/app/util/image-paste";
import { formatRemoteUri } from "@/util/waveutil";
import { atom, Atom, PrimitiveAtom } from "jotai";
import type * as MonacoTypes from "monaco-editor";
import { NotesComponent } from "./notes";
import { getNotesFilePath } from "./notes-util";

export type NotesPreviewMode = "editor" | "split" | "preview";

export { getNotesFilePath };

export class NotesViewModel implements ViewModel {
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    viewType = "notes";
    viewIcon = atom("note-sticky");
    viewName = atom("Notes");
    viewComponent = NotesComponent;

    fileContent: PrimitiveAtom<string>;
    pendingContent: PrimitiveAtom<string | null>;
    isLoading: PrimitiveAtom<boolean>;
    error: PrimitiveAtom<string | null>;
    saveStatus: PrimitiveAtom<"saved" | "saving" | "unsaved" | null>;
    hasEverLoaded: PrimitiveAtom<boolean>;
    previewMode: PrimitiveAtom<NotesPreviewMode>;
    liveContent: Atom<string>;
    endIconButtons: Atom<IconButtonDecl[]>;

    connection: Atom<string>;
    // Notes file path (derived)
    notesPath: Atom<string>;

    monacoRef: React.MutableRefObject<MonacoTypes.editor.IStandaloneCodeEditor | null>;

    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private disposed: boolean = false;

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
        this.hasEverLoaded = atom(false) as PrimitiveAtom<boolean>;
        this.previewMode = atom("editor") as PrimitiveAtom<NotesPreviewMode>;
        this.liveContent = atom((get) => get(this.pendingContent) ?? get(this.fileContent));
        this.endIconButtons = atom((get): IconButtonDecl[] => {
            const mode = get(this.previewMode);
            const nextMode: NotesPreviewMode = mode === "editor" ? "split" : mode === "split" ? "preview" : "editor";
            const iconMap = { editor: "eye", split: "columns-3", preview: "pencil" };
            const titleMap = {
                editor: "Show Preview (split)",
                split: "Preview only",
                preview: "Back to editor",
            };
            return [
                {
                    elemtype: "iconbutton",
                    icon: iconMap[mode],
                    title: titleMap[mode],
                    click: () => globalStore.set(this.previewMode, nextMode),
                },
            ];
        });

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

        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        globalStore.set(this.pendingContent, null);
        globalStore.set(this.saveStatus, null);

        globalStore.set(this.isLoading, true);
        globalStore.set(this.error, null);

        try {
            const fileData = await RpcApi.FileReadCommand(TabRpcClient, { info: { path: remotePath } }, null);
            const content = fileData?.data64 ? decodeURIComponent(escape(atob(fileData.data64))) : "";

            const currentPath = globalStore.get(this.notesPath);
            if (currentPath === notesPath) {
                globalStore.set(this.fileContent, content);
                globalStore.set(this.pendingContent, null);
                globalStore.set(this.hasEverLoaded, true);
            }
        } catch (e) {
            const errStr = String(e);
            if (errStr.includes("not found") || errStr.includes("ENOENT") || errStr.includes("no such file")) {
                const currentPath = globalStore.get(this.notesPath);
                if (currentPath === notesPath) {
                    globalStore.set(this.fileContent, "");
                    globalStore.set(this.pendingContent, null);
                    globalStore.set(this.hasEverLoaded, true);
                }
            } else {
                globalStore.set(this.error, errStr);
            }
        } finally {
            globalStore.set(this.isLoading, false);
        }
    }

    dispose(): void {
        this.disposed = true;
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
    }

    scheduleAutoSave(content: string): void {
        if (this.disposed) return;
        globalStore.set(this.pendingContent, content);
        globalStore.set(this.saveStatus, "unsaved");

        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            if (this.disposed) return;
            this.saveContent(content);
        }, 1500);
    }

    async saveContent(content: string): Promise<void> {
        const notesPath = globalStore.get(this.notesPath);
        const conn = globalStore.get(this.connection);

        globalStore.set(this.saveStatus, "saving");

        try {
            const parentDir = notesPath.substring(0, notesPath.lastIndexOf("/"));
            if (parentDir) {
                const parentRemotePath = formatRemoteUri(parentDir, conn || "local");
                await RpcApi.FileMkdirCommand(TabRpcClient, { info: { path: parentRemotePath } }).catch(
                    () => undefined
                );
            }

            const remotePath = formatRemoteUri(notesPath, conn || "local");
            await RpcApi.FileWriteCommand(TabRpcClient, {
                info: { path: remotePath },
                data64: btoa(unescape(encodeURIComponent(content))),
            });

            globalStore.set(this.fileContent, content);
            globalStore.set(this.pendingContent, null);
            globalStore.set(this.saveStatus, "saved");

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

    getSettingsMenuItems(): ContextMenuItem[] {
        const menuItems: ContextMenuItem[] = [];
        const notesPath = globalStore.get(this.notesPath);
        const conn = globalStore.get(this.connection);

        menuItems.push({
            label: "Copy File Path",
            click: () => {
                const fullPath = conn ? formatRemoteUri(notesPath, conn) : notesPath;
                navigator.clipboard.writeText(fullPath);
            },
        });
        menuItems.push({
            label: "Open in Preview",
            click: () => {
                const blockDef: BlockDef = {
                    meta: {
                        view: "preview",
                        file: notesPath,
                        connection: conn || undefined,
                    },
                };
                createBlock(blockDef);
            },
        });
        menuItems.push({ type: "separator" });

        const magnified = globalStore.get(this.nodeModel.isMagnified);
        menuItems.push({
            label: magnified ? "Un-Magnify Block" : "Magnify Block",
            click: () => {
                this.nodeModel.toggleMagnify();
            },
        });

        return menuItems;
    }

    giveFocus(): boolean {
        if (this.monacoRef.current) {
            this.monacoRef.current.focus();
            return true;
        }
        return false;
    }
}
