// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import * as WOS from "@/store/wos";
import { makeIconClass } from "@/util/util";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import "./preview-doctab-bar.scss";

type PreviewDocTabBarProps = {
    containerBlockId: string;
    subBlockIds: string[];
    activeTabId: string;
    onSelectTab: (subBlockId: string) => void;
    onCloseTab: (subBlockId: string) => void;
    onNewTab: () => void;
};

function DocTabItem({
    subBlockId,
    isActive,
    onSelect,
    onClose,
}: {
    subBlockId: string;
    isActive: boolean;
    onSelect: () => void;
    onClose: () => void;
}) {
    const blockAtom = WOS.getWaveObjectAtom<Block>(`block:${subBlockId}`);
    const blockData = useAtomValue(blockAtom);
    const filePath = blockData?.meta?.file ?? "";
    const basename = filePath ? filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath : "(new)";

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    };

    return (
        <div
            className={clsx("doctab-item", { active: isActive })}
            onClick={onSelect}
            role="tab"
            aria-selected={isActive}
            title={filePath || basename}
        >
            <i className={clsx(makeIconClass("file", false), "doctab-icon")} />
            <span className="doctab-name">{basename}</span>
            <button
                className="doctab-close"
                onClick={handleClose}
                aria-label={`Close ${basename}`}
                tabIndex={-1}
            >
                <i className={makeIconClass("xmark", false)} />
            </button>
        </div>
    );
}

function PreviewDocTabBar({
    containerBlockId,
    subBlockIds,
    activeTabId,
    onSelectTab,
    onCloseTab,
    onNewTab,
}: PreviewDocTabBarProps) {
    return (
        <div className="preview-doctab-bar" role="tablist" aria-label="Document tabs">
            <div className="doctab-list">
                {subBlockIds.map((subBlockId) => (
                    <DocTabItem
                        key={subBlockId}
                        subBlockId={subBlockId}
                        isActive={subBlockId === activeTabId}
                        onSelect={() => onSelectTab(subBlockId)}
                        onClose={() => onCloseTab(subBlockId)}
                    />
                ))}
            </div>
            <button
                className="doctab-add-btn"
                onClick={onNewTab}
                aria-label="Add document tab"
                title="Open new document tab"
            >
                <i className={makeIconClass("plus", false)} />
            </button>
        </div>
    );
}

export { PreviewDocTabBar };
