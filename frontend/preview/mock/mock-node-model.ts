// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { atom } from "jotai";
import * as React from "react";
import type { LayoutNodeAdditionalProps, NodeModel } from "@/layout/lib/types";

type MockNodeModelOpts = {
    nodeId: string;
    blockId: string;
    innerRect?: { width: string; height: string };
    numLeafs?: number;
};

export function makeMockNodeModel(opts: MockNodeModelOpts): NodeModel {
    const { nodeId, blockId, innerRect, numLeafs } = opts;
    const displayContainerRef = React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;
    return {
        nodeId,
        blockId,
        additionalProps: atom<LayoutNodeAdditionalProps>({ treeKey: nodeId }),
        innerRect: atom(innerRect ?? { width: "800px", height: "500px" }),
        blockNum: atom(1),
        numLeafs: atom(numLeafs ?? 1),
        animationTimeS: atom(0),
        isResizing: atom(false),
        isFocused: atom(false),
        isMagnified: atom(false),
        isEphemeral: atom(false),
        ready: atom(true),
        disablePointerEvents: atom(false),
        isMaximizeMode: atom(false),
        isMaximizedActive: atom(false),
        displayContainerRef,
        addEphemeralNodeToLayout: () => {},
        toggleMagnify: () => {},
        toggleMaximize: () => {},
        focusNode: () => {},
        onClose: () => {},
    };
}
