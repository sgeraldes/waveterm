import { makeIconClass } from "@/util/util";
import { useAtomValue } from "jotai";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import type { TreeViewModel } from "./treeview-model";
import { renderNodes, searchNodes, SearchResultRow } from "./treeview-nodes";
import "./treeview.scss";

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
    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setSearchQuery("");
    }, [rootPath]);

    useEffect(() => {
        model.loadRoot();
    }, [rootPath]);

    const handleToggle = (node: Parameters<typeof model.toggleExpand>[0]) => {
        model.toggleExpand(node);
    };

    const handleOpen = (node: Parameters<typeof model.openInPreview>[0]) => {
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
    const trimmedQuery = searchQuery.trim();
    const searchResults = trimmedQuery ? searchNodes(rootNodes, trimmedQuery) : null;

    return (
        <div className="treeview-container" role="tree">
            {isHomeDir && <div className="treeview-info-banner">Set a tab base directory to focus on a project</div>}
            <div className="treeview-search-bar">
                <i className={makeIconClass("magnifying-glass", false)} />
                <input
                    ref={searchInputRef}
                    type="text"
                    className="treeview-search-input"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") setSearchQuery("");
                    }}
                />
                {searchQuery && (
                    <button
                        className="treeview-search-clear"
                        onClick={() => {
                            setSearchQuery("");
                            searchInputRef.current?.focus();
                        }}
                        tabIndex={-1}
                        title="Clear search"
                    >
                        <i className={makeIconClass("xmark", false)} />
                    </button>
                )}
            </div>
            {searchResults ? (
                <div className="treeview-search-results">
                    {searchResults.length === 0 ? (
                        <div className="treeview-search-empty">No matches in loaded files</div>
                    ) : (
                        searchResults.map((node) => (
                            <SearchResultRow
                                key={node.path}
                                node={node}
                                rootPath={rootPath}
                                selectedPath={selectedPath}
                                onSelect={handleSelect}
                                onOpen={handleOpen}
                            />
                        ))
                    )}
                </div>
            ) : (
                renderNodes(rootNodes, model, handleToggle, handleOpen, selectedPath, handleSelect)
            )}
        </div>
    );
}
