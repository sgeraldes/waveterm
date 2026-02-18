// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { globalStore, WOS } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { isBlank } from "@/util/util";
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
    // Track visited paths for symlink cycle detection
    visitedAncestors: Set<string>;
};

export const MAX_TREE_DEPTH = 20;

export class TreeViewModel implements ViewModel {
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    viewType = "treeview";
    viewIcon = atom("sitemap");
    viewName = atom("Tree View");
    viewComponent = TreeViewComponent;

    // Root path for the tree (derived from tab:basedir or home dir)
    rootPath: Atom<string>;
    // Tree nodes state
    rootNodes: PrimitiveAtom<TreeNode[]>;
    // Loading state for initial load
    isLoading: PrimitiveAtom<boolean>;
    // Error state
    error: PrimitiveAtom<string | null>;
    // Connection from block meta
    connection: Atom<string>;
    // Selected node path
    selectedPath: PrimitiveAtom<string | null>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;

        this.rootNodes = atom([]) as PrimitiveAtom<TreeNode[]>;
        this.isLoading = atom(false);
        this.error = atom(null) as PrimitiveAtom<string | null>;
        this.selectedPath = atom(null) as PrimitiveAtom<string | null>;

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

        // Sort: directories first, then files, both alphabetically
        files.sort((a, b) => {
            if (a.isdir !== b.isdir) return a.isdir ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        return files
            .filter((f) => f.name && !f.name.startsWith(".")) // hide dotfiles by default
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
            // Collapse: remove children
            const updated = this.updateNodeInTree(nodes, node.path, (n) => ({
                ...n,
                isExpanded: false,
                children: undefined,
            }));
            globalStore.set(this.rootNodes, updated);
        } else {
            // Expand: load children
            // Mark as loading
            const loading = this.updateNodeInTree(nodes, node.path, (n) => ({
                ...n,
                isLoading: true,
            }));
            globalStore.set(this.rootNodes, loading);

            try {
                // Check for symlink cycles
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

    openInPreview(node: TreeNode) {
        // Open the file/directory in a new preview block
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

    giveFocus(): boolean {
        return false;
    }
}
