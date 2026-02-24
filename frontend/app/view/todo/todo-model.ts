import type { BlockNodeModel } from "@/app/block/blocktypes";
import { globalStore, pushNotification, WOS } from "@/app/store/global";
import type { TabModel } from "@/app/store/tab-model";
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
    endIconButtons: Atom<IconButtonDecl[]>;

    fileContent: PrimitiveAtom<string>;
    isLoading: PrimitiveAtom<boolean>;
    error: PrimitiveAtom<string | null>;
    mode: PrimitiveAtom<"view" | "edit">;
    saveStatus: PrimitiveAtom<"saved" | "saving" | "unsaved" | null>;
    newTaskText: PrimitiveAtom<string>;

    connection: Atom<string>;
    // TODO file path
    todoPath: Atom<string>;

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

        this.endIconButtons = atom((get) => {
            const currentMode = get(this.mode);
            return [
                {
                    elemtype: "iconbutton" as const,
                    icon: currentMode === "view" ? "pen-to-square" : "list-check",
                    title: currentMode === "view" ? "Edit markdown" : "View checklist",
                    click: () => {
                        globalStore.set(this.mode, currentMode === "view" ? "edit" : "view");
                    },
                },
            ];
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
            const parentDir = todoPath.substring(0, todoPath.lastIndexOf("/"));
            if (parentDir) {
                const parentRemotePath = formatRemoteUri(parentDir, conn || "local");
                try {
                    await RpcApi.FileMkdirCommand(TabRpcClient, { info: { path: parentRemotePath } });
                } catch (_) {
                    void _;
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

    editTask(lineIndex: number, newText: string): void {
        const trimmed = newText.trim();
        const content = globalStore.get(this.fileContent);
        const lines = content.split("\n");
        const line = lines[lineIndex];
        if (line.startsWith("- [ ] ")) {
            lines[lineIndex] = trimmed ? `- [ ] ${trimmed}` : "";
        } else if (line.startsWith("- [x] ")) {
            lines[lineIndex] = trimmed ? `- [x] ${trimmed}` : "";
        }
        const newContent = lines.filter((l, i) => i !== lineIndex || l !== "").join("\n");
        globalStore.set(this.fileContent, newContent);
        this.saveContent(newContent);
    }

    reorderTasks(fromLineIndex: number, toLineIndex: number): void {
        if (fromLineIndex === toLineIndex) return;
        const content = globalStore.get(this.fileContent);
        const lines = content.split("\n");
        const [removed] = lines.splice(fromLineIndex, 1);
        const adjustedTo = toLineIndex > fromLineIndex ? toLineIndex - 1 : toLineIndex;
        lines.splice(adjustedTo, 0, removed);
        const newContent = lines.join("\n");
        globalStore.set(this.fileContent, newContent);
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

    deleteTask(lineIndex: number): void {
        const content = globalStore.get(this.fileContent);
        const lines = content.split("\n");
        lines.splice(lineIndex, 1);
        const newContent = lines.join("\n");
        globalStore.set(this.fileContent, newContent);
        this.saveContent(newContent);
    }

    clearCompleted(): void {
        const content = globalStore.get(this.fileContent);
        const lines = content.split("\n");
        const filtered = lines.filter((line) => !line.startsWith("- [x] "));
        const newContent = filtered.join("\n");
        globalStore.set(this.fileContent, newContent);
        this.saveContent(newContent);
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        const menuItems: ContextMenuItem[] = [];
        const todoPath = globalStore.get(this.todoPath);
        const conn = globalStore.get(this.connection);

        menuItems.push({
            label: "Copy File Path",
            click: () => {
                const fullPath = conn ? formatRemoteUri(todoPath, conn) : todoPath;
                navigator.clipboard.writeText(fullPath);
            },
        });
        menuItems.push({ type: "separator" });
        menuItems.push({
            label: "Clear Completed",
            click: () => {
                this.clearCompleted();
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
