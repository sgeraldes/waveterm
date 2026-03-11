import type { BlockNodeModel } from "@/app/block/blocktypes";
import { globalStore, WOS } from "@/app/store/global";
import type { TabModel } from "@/app/store/tab-model";
import { waveEventSubscribe } from "@/app/store/wps";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { fireAndForget, isBlank } from "@/util/util";
import { formatRemoteUri } from "@/util/waveutil";
import { atom, Atom, PrimitiveAtom } from "jotai";
import { TreeViewComponent } from "./treeview";

export type TreeNode = {
    name: string;
    path: string;
    isDir: boolean;
    isSymlink: boolean;
    isExpanded: boolean;
    isLoading: boolean;
    error?: string;
    children?: TreeNode[];
    depth: number;
    visitedAncestors: Set<string>;
};

export const MAX_TREE_DEPTH = 20;

const REFRESH_DEBOUNCE_MS = 500;

export class TreeViewModel implements ViewModel {
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    viewType = "treeview";
    viewIcon = atom("sitemap");
    viewName = atom("Tree View");
    viewComponent = TreeViewComponent;

    rootPath: Atom<string>;
    rootNodes: PrimitiveAtom<TreeNode[]>;
    isLoading: PrimitiveAtom<boolean>;
    error: PrimitiveAtom<string | null>;
    connection: Atom<string>;
    selectedPath: PrimitiveAtom<string | null>;
    showHiddenFiles: PrimitiveAtom<boolean>;

    private watchedPaths: Set<string> = new Set();
    private eventUnsubFn: (() => void) | null = null;
    private refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;

        this.rootNodes = atom([]) as PrimitiveAtom<TreeNode[]>;
        this.isLoading = atom(false);
        this.error = atom(null) as PrimitiveAtom<string | null>;
        this.selectedPath = atom(null) as PrimitiveAtom<string | null>;
        this.showHiddenFiles = atom(false) as PrimitiveAtom<boolean>;

        this.connection = atom((get) => {
            const blockData = get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", this.blockId)));
            return blockData?.meta?.connection ?? "";
        });

        this.rootPath = atom((get) => {
            const tabBasedir = tabModel.getTabMetaAtom("tab:basedir");
            const basedir = get(tabBasedir);
            if (isBlank(basedir) || basedir === "~") {
                return "~";
            }
            return basedir;
        });
    }

    async loadDirectory(dirPath: string, depth: number, visitedAncestors: Set<string>): Promise<TreeNode[]> {
        if (depth >= MAX_TREE_DEPTH) {
            return [];
        }

        const conn = globalStore.get(this.connection);
        const remotePath = formatRemoteUri(dirPath, conn);

        const fileData = await RpcApi.FileReadCommand(TabRpcClient, { info: { path: remotePath } }, null);
        const files = fileData?.entries ?? [];

        if (files.length === 0) return [];

        files.sort((a, b) => {
            if (a.isdir !== b.isdir) return a.isdir ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        const showHidden = globalStore.get(this.showHiddenFiles);
        return files
            .filter((f) => f.name && (showHidden || !f.name.startsWith(".")))
            .map((f) => ({
                name: f.name,
                path: f.path,
                isDir: f.isdir ?? false,
                isSymlink: f.modestr?.startsWith("l") ?? false,
                isExpanded: false,
                isLoading: false,
                children: f.isdir ? undefined : null,
                depth,
                visitedAncestors: new Set(visitedAncestors),
            }));
    }

    async loadRoot() {
        const rootPath = globalStore.get(this.rootPath);
        globalStore.set(this.isLoading, true);
        globalStore.set(this.error, null);
        globalStore.set(this.rootNodes, []);

        try {
            const nodes = await this.loadDirectory(rootPath, 0, new Set([rootPath]));
            globalStore.set(this.rootNodes, nodes);
        } catch (e) {
            globalStore.set(this.error, String(e));
        } finally {
            globalStore.set(this.isLoading, false);
        }
    }

    async toggleExpand(node: TreeNode) {
        if (!node.isDir) return;

        const nodes = globalStore.get(this.rootNodes);

        if (node.isExpanded) {
            this.unwatchDirectory(node.path);
            const updated = this.updateNodeInTree(nodes, node.path, (n) => ({
                ...n,
                isExpanded: false,
                children: undefined,
            }));
            globalStore.set(this.rootNodes, updated);
        } else {
            const loading = this.updateNodeInTree(nodes, node.path, (n) => ({
                ...n,
                isLoading: true,
            }));
            globalStore.set(this.rootNodes, loading);

            try {
                if (node.visitedAncestors.has(node.path)) {
                    const cycleUpdated = this.updateNodeInTree(globalStore.get(this.rootNodes), node.path, (n) => ({
                        ...n,
                        isLoading: false,
                        isExpanded: true,
                        children: [],
                        error: "Circular symlink reference detected",
                    }));
                    globalStore.set(this.rootNodes, cycleUpdated);
                    return;
                }

                const newVisited = new Set(node.visitedAncestors);
                newVisited.add(node.path);
                const children = await this.loadDirectory(node.path, node.depth + 1, newVisited);
                this.watchDirectory(node.path);
                const expanded = this.updateNodeInTree(globalStore.get(this.rootNodes), node.path, (n) => ({
                    ...n,
                    isLoading: false,
                    isExpanded: true,
                    children,
                }));
                globalStore.set(this.rootNodes, expanded);
            } catch (e) {
                const errUpdated = this.updateNodeInTree(globalStore.get(this.rootNodes), node.path, (n) => ({
                    ...n,
                    isLoading: false,
                    isExpanded: true,
                    children: [],
                    error: String(e),
                }));
                globalStore.set(this.rootNodes, errUpdated);
            }
        }
    }

    private updateNodeInTree(nodes: TreeNode[], targetPath: string, updater: (n: TreeNode) => TreeNode): TreeNode[] {
        return nodes.map((n) => {
            if (n.path === targetPath) {
                return updater(n);
            }
            if (n.children && n.isExpanded) {
                return { ...n, children: this.updateNodeInTree(n.children, targetPath, updater) };
            }
            return n;
        });
    }

    private isLocalConnection(): boolean {
        const conn = globalStore.get(this.connection);
        return isBlank(conn);
    }

    private watchDirectory(dirPath: string) {
        if (!this.isLocalConnection() || this.watchedPaths.has(dirPath)) {
            return;
        }
        this.watchedPaths.add(dirPath);
        RpcApi.FileWatchCommand(TabRpcClient, {
            path: dirPath,
            watch: true,
            blockid: this.blockId,
        }).catch((e) => console.error("[TreeView] Failed to watch directory:", dirPath, e));
    }

    private unwatchDirectory(dirPath: string) {
        if (!this.watchedPaths.has(dirPath)) {
            return;
        }
        this.watchedPaths.delete(dirPath);
        RpcApi.FileWatchCommand(TabRpcClient, {
            path: dirPath,
            watch: false,
            blockid: this.blockId,
        }).catch((e) => console.error("[TreeView] Failed to unwatch directory:", dirPath, e));
    }

    startWatching() {
        if (!this.isLocalConnection()) {
            return;
        }

        const rootPath = globalStore.get(this.rootPath);
        if (rootPath && rootPath !== "~") {
            this.watchDirectory(rootPath);
        }

        this.eventUnsubFn = waveEventSubscribe({
            eventType: "file:change",
            scope: this.blockId,
            handler: () => this.debouncedRefresh(),
        });

        RpcApi.EventSubCommand(TabRpcClient, {
            event: "file:change",
            scopes: [this.blockId],
        }).catch((e) => console.error("[TreeView] Failed to subscribe to file events:", e));
    }

    stopWatching() {
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = null;
        }

        if (this.eventUnsubFn) {
            this.eventUnsubFn();
            this.eventUnsubFn = null;
        }

        for (const dirPath of this.watchedPaths) {
            RpcApi.FileWatchCommand(TabRpcClient, {
                path: dirPath,
                watch: false,
                blockid: this.blockId,
            }).catch(() => {});
        }
        this.watchedPaths.clear();

        RpcApi.EventUnsubCommand(TabRpcClient, "file:change").catch(() => {});
    }

    private debouncedRefresh() {
        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }
        this.refreshDebounceTimer = setTimeout(() => {
            this.refreshDebounceTimer = null;
            fireAndForget(() => this.loadRoot());
        }, REFRESH_DEBOUNCE_MS);
    }

    getNodeContextMenu(node: TreeNode): ContextMenuItem[] {
        const menu: ContextMenuItem[] = [];

        if (node.isDir) {
            menu.push({
                label: node.isExpanded ? "Collapse" : "Expand",
                click: () => fireAndForget(() => this.toggleExpand(node)),
            });
        } else {
            menu.push({
                label: "Open",
                click: () => this.openInPreview(node),
            });
        }

        menu.push({ type: "separator" });
        menu.push({
            label: "Copy Path",
            click: () => void navigator.clipboard.writeText(node.path),
        });
        menu.push({
            label: "Copy Filename",
            click: () => void navigator.clipboard.writeText(node.name),
        });
        menu.push({ type: "separator" });
        menu.push({
            label: "Reveal in File Browser",
            click: () => {
                const revealPath = node.isDir ? node.path : node.path.substring(0, node.path.lastIndexOf("/")) || "/";
                const blockDef: BlockDef = {
                    meta: {
                        view: "preview",
                        file: revealPath,
                        connection: globalStore.get(this.connection) || undefined,
                    },
                };
                import("@/app/store/global").then(({ createBlock }) => {
                    createBlock(blockDef);
                });
            },
        });

        if (node.isDir) {
            menu.push({ type: "separator" });
            menu.push({
                label: "Set as Tab Base Directory",
                click: () => {
                    RpcApi.SetMetaCommand(TabRpcClient, {
                        oref: WOS.makeORef("tab", this.tabModel.tabId),
                        meta: { "tab:basedir": node.path, "tab:basedirlock": true },
                    }).catch((e) => console.error("[TreeView] Failed to set tab basedir:", e));
                },
            });
        }

        return menu;
    }

    openInPreview(node: TreeNode) {
        const blockDef: BlockDef = {
            meta: {
                view: "preview",
                file: node.path,
                connection: globalStore.get(this.connection) || undefined,
            },
        };
        import("@/app/store/global").then(({ createBlock }) => {
            createBlock(blockDef);
        });
    }

    collapseAll(): void {
        for (const dirPath of this.watchedPaths) {
            const rootPath = globalStore.get(this.rootPath);
            if (dirPath !== rootPath) {
                this.unwatchDirectory(dirPath);
            }
        }
        const nodes = globalStore.get(this.rootNodes);
        const collapsed = this.collapseNodes(nodes);
        globalStore.set(this.rootNodes, collapsed);
    }

    private collapseNodes(nodes: TreeNode[]): TreeNode[] {
        return nodes.map((n) => ({
            ...n,
            isExpanded: false,
            children: undefined,
        }));
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        const menuItems: ContextMenuItem[] = [];
        const showHidden = globalStore.get(this.showHiddenFiles);

        menuItems.push({
            label: "Refresh",
            click: () => {
                this.loadRoot();
            },
        });
        menuItems.push({
            label: showHidden ? "Hide Hidden Files" : "Show Hidden Files",
            click: () => {
                globalStore.set(this.showHiddenFiles, !showHidden);
                this.loadRoot();
            },
        });
        menuItems.push({
            label: "Collapse All",
            click: () => {
                this.collapseAll();
            },
        });

        return menuItems;
    }

    giveFocus(): boolean {
        return false;
    }
}
