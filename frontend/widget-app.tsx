// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// Widget window React app — renders a single block without tab/workspace context.

import { BlockNodeModel } from "@/app/block/blocktypes";
import { makeViewModel } from "@/app/block/blockregistry";
import { useTheme } from "@/app/hook/usetheme";
import { TabModel, TabModelContext } from "@/app/store/tab-model";
import { registerBlockComponentModel, unregisterBlockComponentModel } from "@/store/global";
import { ErrorBoundary } from "@/element/errorboundary";
import { CenteredDiv } from "@/element/quickelems";
import { atom } from "jotai";
import { memo, Suspense, useEffect, useMemo, useRef } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

interface WidgetAppProps {
    blockId: string;
    blockData: Block;
}

/**
 * Creates a minimal BlockNodeModel stub for the widget window.
 * Widget blocks are always focused and never magnified. Close is a no-op
 * since the widget window lifecycle is managed by Electron, not the layout system.
 */
function createWidgetNodeModel(blockId: string): BlockNodeModel {
    return {
        blockId,
        isFocused: atom(true),
        isMagnified: atom(false),
        onClose: () => {
            // In widget context, closing is handled by the window itself
        },
        focusNode: () => {
            // No-op in widget context — there's only one block
        },
        toggleMagnify: () => {
            // No-op in widget context
        },
    };
}

/**
 * The main widget app component. Renders a single block view without
 * the full BlockFrame chrome. Provides a TabModel context so that
 * view models that call useTabModel() don't throw.
 */
const WidgetApp = memo(({ blockId, blockData }: WidgetAppProps) => {
    useTheme();

    const blockRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Create a stub TabModel for the widget context.
    // We use a synthetic tabId. The TabModel is lightweight —
    // it just holds atoms and methods that view models may call.
    const tabModel = useMemo(() => new TabModel("widget:" + blockId), [blockId]);

    // Create the node model stub
    const nodeModel = useMemo(() => createWidgetNodeModel(blockId), [blockId]);

    // Create the view model using the block registry
    const viewModel = useMemo(() => {
        const blockView = blockData?.meta?.view;
        if (!blockView) return null;
        return makeViewModel(blockId, blockView, nodeModel, tabModel);
    }, [blockId, blockData?.meta?.view, nodeModel, tabModel]);

    // Register/unregister the block component model
    useEffect(() => {
        if (viewModel) {
            registerBlockComponentModel(blockId, { viewModel });
        }
        return () => {
            unregisterBlockComponentModel(blockId);
            viewModel?.dispose?.();
        };
    }, [blockId, viewModel]);

    if (!viewModel || !viewModel.viewComponent) {
        const viewType = blockData?.meta?.view || "unknown";
        return (
            <div className="widget-app widget-fallback">
                <CenteredDiv>
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>
                            Block type: {viewType}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.6 }}>
                            No renderer available for this block type in widget mode.
                        </div>
                    </div>
                </CenteredDiv>
            </div>
        );
    }

    const VC = viewModel.viewComponent;

    return (
        <DndProvider backend={HTML5Backend}>
            <TabModelContext.Provider value={tabModel}>
                <div className="widget-app" ref={blockRef} style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
                    <div
                        className="block-content"
                        ref={contentRef}
                        style={{ width: "100%", height: "100%", position: "relative" }}
                    >
                        <ErrorBoundary>
                            <Suspense fallback={<CenteredDiv>Loading...</CenteredDiv>}>
                                <VC
                                    key={blockId}
                                    blockId={blockId}
                                    blockRef={blockRef}
                                    contentRef={contentRef}
                                    model={viewModel}
                                />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </div>
            </TabModelContext.Provider>
        </DndProvider>
    );
});

WidgetApp.displayName = "WidgetApp";

export { WidgetApp };
