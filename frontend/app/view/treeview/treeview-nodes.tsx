import { ContextMenuModel } from "@/app/store/contextmenu";
import { makeIconClass } from "@/util/util";
import clsx from "clsx";
import * as React from "react";
import type { TreeNode, TreeViewModel } from "./treeview-model";

export function getFileIcon(node: TreeNode): string {
    if (node.isDir) {
        return node.isExpanded ? "folder-open" : "folder";
    }
    const ext = node.name.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "ts":
        case "tsx":
        case "js":
        case "jsx":
        case "json":
            return "file-code";
        case "md":
            return "file-lines";
        case "png":
        case "jpg":
        case "jpeg":
        case "gif":
        case "svg":
            return "file-image";
        case "pdf":
            return "file-pdf";
        default:
            return "file";
    }
}

export function flattenNodes(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];
    for (const node of nodes) {
        result.push(node);
        if (node.isExpanded && node.children && node.children.length > 0) {
            result.push(...flattenNodes(node.children));
        }
    }
    return result;
}

export function searchNodes(nodes: TreeNode[], query: string): TreeNode[] {
    const lq = query.toLowerCase();
    return flattenNodes(nodes).filter((n) => n.name.toLowerCase().includes(lq));
}

type TreeNodeProps = {
    node: TreeNode;
    model: TreeViewModel;
    onToggle: (node: TreeNode) => void;
    onOpen: (node: TreeNode) => void;
    selectedPath: string | null;
    onSelect: (path: string) => void;
};

export function TreeNodeRow({ node, model, onToggle, onOpen, selectedPath, onSelect }: TreeNodeProps) {
    const isSelected = selectedPath === node.path;
    const indentPx = node.depth * 16;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(node.path);
        if (node.isDir) onToggle(node);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!node.isDir) onOpen(node);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (node.isDir) onToggle(node);
            else onOpen(node);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        ContextMenuModel.showContextMenu(model.getNodeContextMenu(node), e);
    };

    return (
        <div
            className={clsx("treeview-node", {
                "treeview-node-selected": isSelected,
                "treeview-node-dir": node.isDir,
                "treeview-node-file": !node.isDir,
            })}
            style={{ paddingLeft: `${indentPx + 4}px` }}
            title={node.path}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
            onContextMenu={handleContextMenu}
            tabIndex={0}
            role="treeitem"
            aria-expanded={node.isDir ? node.isExpanded : undefined}
        >
            {node.isDir && (
                <span
                    className={clsx("treeview-expand-icon", makeIconClass("chevron-right", false), {
                        "treeview-expanded": node.isExpanded,
                    })}
                />
            )}
            {node.isLoading ? (
                <span className={clsx("treeview-file-icon", makeIconClass("spinner", false), "fa-spin")} />
            ) : (
                <span
                    className={clsx("treeview-file-icon", makeIconClass(getFileIcon(node), false), {
                        "treeview-symlink": node.isSymlink,
                    })}
                />
            )}
            <span className="treeview-node-name">{node.name}</span>
            {node.isSymlink && (
                <span className="treeview-symlink-badge" title="Symbolic link">
                    ↪
                </span>
            )}
        </div>
    );
}

type SearchResultRowProps = {
    node: TreeNode;
    rootPath: string;
    selectedPath: string | null;
    onSelect: (path: string) => void;
    onOpen: (node: TreeNode) => void;
};

export function SearchResultRow({ node, rootPath, selectedPath, onSelect, onOpen }: SearchResultRowProps) {
    const isSelected = selectedPath === node.path;
    const relativePath = node.path.startsWith(rootPath + "/") ? node.path.slice(rootPath.length + 1) : node.path;

    const activate = () => {
        onSelect(node.path);
        if (!node.isDir) onOpen(node);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        activate();
    };

    return (
        <div
            className={clsx("treeview-search-result", { "treeview-search-result-selected": isSelected })}
            role="button"
            onClick={handleClick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } }}
            tabIndex={0}
            title={node.path}
        >
            <span className={clsx("treeview-file-icon", makeIconClass(getFileIcon(node), false))} />
            <div className="treeview-search-result-info">
                <span className="treeview-search-result-name">{node.name}</span>
                <span className="treeview-search-result-path">{relativePath}</span>
            </div>
        </div>
    );
}

export function renderNodes(
    nodes: TreeNode[],
    model: TreeViewModel,
    onToggle: (node: TreeNode) => void,
    onOpen: (node: TreeNode) => void,
    selectedPath: string | null,
    onSelect: (path: string) => void
): React.ReactNode[] {
    const result: React.ReactNode[] = [];
    for (const node of nodes) {
        result.push(
            <TreeNodeRow
                key={node.path}
                node={node}
                model={model}
                onToggle={onToggle}
                onOpen={onOpen}
                selectedPath={selectedPath}
                onSelect={onSelect}
            />
        );
        if (node.isExpanded && node.children && node.children.length > 0) {
            result.push(...renderNodes(node.children, model, onToggle, onOpen, selectedPath, onSelect));
        }
        if (node.isExpanded && node.error) {
            result.push(
                <div
                    key={`${node.path}-error`}
                    className="treeview-error"
                    style={{ paddingLeft: `${(node.depth + 1) * 16 + 4}px` }}
                >
                    {node.error}
                </div>
            );
        }
        if (node.isExpanded && node.children?.length === 0 && !node.isLoading && !node.error) {
            result.push(
                <div
                    key={`${node.path}-empty`}
                    className="treeview-empty"
                    style={{ paddingLeft: `${(node.depth + 1) * 16 + 4}px` }}
                >
                    (empty)
                </div>
            );
        }
    }
    return result;
}
