// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { makeIconClass } from "@/util/util";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import * as React from "react";
import { useEffect } from "react";
import type { TreeNode, TreeViewModel } from "./treeview-model";
import "./treeview.scss";

function getFileIcon(node: TreeNode): string {
    if (node.isDir) {
        return node.isExpanded ? "folder-open" : "folder";
    }
    const ext = node.name.split(".").pop()?.toLowerCase();
    switch (ext) {
        case "ts":
        case "tsx":
            return "file-code";
        case "js":
        case "jsx":
            return "file-code";
        case "md":
            return "file-lines";
        case "json":
            return "file-code";
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

type TreeNodeProps = {
    node: TreeNode;
    model: TreeViewModel;
    onToggle: (node: TreeNode) => void;
    onOpen: (node: TreeNode) => void;
    selectedPath: string | null;
    onSelect: (path: string) => void;
};

function TreeNodeRow({ node, onToggle, onOpen, selectedPath, onSelect }: TreeNodeProps) {
    const isSelected = selectedPath === node.path;
    const indentPx = node.depth * 16;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(node.path);
        if (node.isDir) {
            onToggle(node);
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!node.isDir) {
            onOpen(node);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (node.isDir) {
                onToggle(node);
            } else {
                onOpen(node);
            }
        }
    };

    return (
        <div
            className={clsx("treeview-node", {
                "treeview-node-selected": isSelected,
                "treeview-node-dir": node.isDir,
                "treeview-node-file": !node.isDir,
            })}
            style={{ paddingLeft: `${indentPx + 4}px` }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
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
            {node.isSymlink && <span className="treeview-symlink-badge" title="Symbolic link">↪</span>}
        </div>
    );
}

function renderNodes(
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
                <div key={`${node.path}-error`} className="treeview-error" style={{ paddingLeft: `${(node.depth + 1) * 16 + 4}px` }}>
                    {node.error}
                </div>
            );
        }
        if (node.isExpanded && node.children && node.children.length === 0 && !node.isLoading && !node.error) {
            result.push(
                <div key={`${node.path}-empty`} className="treeview-empty" style={{ paddingLeft: `${(node.depth + 1) * 16 + 4}px` }}>
                    (empty)
                </div>
            );
        }
    }
    return result;
}

export function TreeViewComponent({
    model,
}: {
    blockId: string;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    model: TreeViewModel;
}) {
    const rootNodes = useAtomValue(model.rootNodes);
    const isLoading = useAtomValue(model.isLoading);
    const error = useAtomValue(model.error);
    const rootPath = useAtomValue(model.rootPath);
    const selectedPath = useAtomValue(model.selectedPath);

    // Load root when rootPath changes
    useEffect(() => {
        model.loadRoot();
    }, [rootPath]);

    const handleToggle = (node: TreeNode) => {
        model.toggleExpand(node);
    };

    const handleOpen = (node: TreeNode) => {
        model.openInPreview(node);
    };

    const handleSelect = (path: string) => {
        import("@/app/store/global").then(({ globalStore }) => {
            globalStore.set(model.selectedPath, path);
        });
    };

    if (isLoading) {
        return (
            <div className="treeview-loading">
                <i className={makeIconClass("spinner", false) + " fa-spin"} />
                <span>Loading...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="treeview-error-state">
                <i className={makeIconClass("triangle-exclamation", false)} />
                <span>{error}</span>
                <button className="treeview-retry" onClick={() => model.loadRoot()}>
                    Retry
                </button>
            </div>
        );
    }

    const isHomeDir = rootPath === "~";

    return (
        <div className="treeview-container" role="tree">
            {isHomeDir && (
                <div className="treeview-info-banner">
                    Set a tab base directory to focus on a project
                </div>
            )}
            <div className="treeview-root-label">
                <i className={makeIconClass("folder", false)} />
                <span title={rootPath}>{rootPath === "~" ? "Home" : rootPath.split("/").pop() || rootPath}</span>
            </div>
            {renderNodes(rootNodes, model, handleToggle, handleOpen, selectedPath, handleSelect)}
        </div>
    );
}
