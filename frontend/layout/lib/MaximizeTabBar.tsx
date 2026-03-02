// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { blockViewToIcon, blockViewToName } from "@/app/block/blockutil";
import { WOS } from "@/app/store/global";
import { makeIconClass } from "@/util/util";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import React from "react";
import { LayoutModel } from "./layoutModel";
import "./maximize-tab-bar.scss";

interface MaximizeTabChipProps {
    blockId: string;
    isActive: boolean;
    onClick: () => void;
}

const MaximizeTabChip = React.memo(({ blockId, isActive, onClick }: MaximizeTabChipProps) => {
    const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", blockId));
    const icon = blockData?.meta?.["frame:icon"] ?? blockViewToIcon(blockData?.meta?.view);
    const name = blockData?.meta?.["frame:title"] ?? blockViewToName(blockData?.meta?.view);
    const iconClass = makeIconClass(icon, false);

    return (
        <div className={clsx("maximize-tab", { active: isActive })} onClick={onClick} title={name}>
            {iconClass && <i className={iconClass} />}
            <span className="maximize-tab-name">{name}</span>
        </div>
    );
});
MaximizeTabChip.displayName = "MaximizeTabChip";

interface MaximizeTabBarProps {
    layoutModel: LayoutModel;
}

export const MaximizeTabBar = React.memo(({ layoutModel }: MaximizeTabBarProps) => {
    const leafOrder = useAtomValue(layoutModel.leafOrder);
    const activeBlockId = useAtomValue(layoutModel.maximizeActiveBlockIdAtom);

    return (
        <div className="maximize-tab-bar">
            {leafOrder.map((entry) => (
                <MaximizeTabChip
                    key={entry.blockid}
                    blockId={entry.blockid}
                    isActive={entry.blockid === activeBlockId}
                    onClick={() => layoutModel.maximizeSetActiveBlock(entry.blockid)}
                />
            ))}
            <div
                className="maximize-tab-close"
                onClick={() => layoutModel.maximizeModeExit()}
                title="Exit Maximize Mode"
            >
                <i className="fa-sharp fa-solid fa-xmark" />
            </div>
        </div>
    );
});
MaximizeTabBar.displayName = "MaximizeTabBar";
