// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Block } from "@/app/block/block";
import { ErrorBoundary } from "@/element/errorboundary";
import { CenteredDiv } from "@/element/quickelems";
import { ContentRenderer, NodeModel, PreviewRenderer, TileLayout } from "@/layout/index";
import { TileLayoutContents } from "@/layout/lib/types";
import { atoms, getApi } from "@/store/global";
import { globalStore } from "@/store/jotaiStore";
import * as services from "@/store/services";
import * as WOS from "@/store/wos";
import { atom, useAtomValue } from "jotai";
import * as React from "react";
import { useMemo } from "react";

const tileGapSizeAtom = atom((get) => {
    const settings = get(atoms.settingsAtom);
    return settings["window:tilegapsize"];
});

function sanitizeErrorMessage(error: Error): string {
    if (!error?.message) return "Unknown error occurred";
    // Take only the first line, remove file paths and "at" traces
    const firstLine = error.message.split("\n")[0];
    return firstLine.replace(/\s+at\s+.*$/g, "").trim();
}

function copyErrorDetails(error: Error, context: string) {
    const details = JSON.stringify(
        {
            context,
            name: error?.name || "Error",
            message: error?.message || "Unknown error",
            stack: error?.stack || "No stack trace available",
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
        },
        null,
        2
    );
    navigator.clipboard.writeText(details);
}

const TabErrorFallback = ({ error, tabId }: { error: Error; tabId: string }) => (
    <div className="flex flex-col items-center justify-center h-full">
        <i className="fa fa-exclamation-triangle text-4xl text-red-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Tab Error</h2>
        <p className="text-gray-400 mb-2">This tab encountered an error while loading.</p>
        {error && <p className="text-gray-500 text-sm mb-4 text-center max-w-md">{sanitizeErrorMessage(error)}</p>}
        <button
            className="px-4 py-2 bg-accent-500 hover:bg-accent-600 rounded"
            onClick={() => {
                const oref = WOS.makeORef("tab", tabId);
                const tabAtom = WOS.getWaveObjectAtom<Tab>(oref);
                const tab = globalStore.get(tabAtom);
                if (tab) {
                    // Force reload tab state
                    globalStore.set(tabAtom, { ...tab });
                }
            }}
        >
            <i className="fa fa-refresh mr-2" />
            Reload Tab
        </button>
        {error && (
            <details className="mt-4 max-w-xl">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-400">
                    Technical Details
                </summary>
                <div className="mt-2 p-3 bg-black/50 rounded text-xs space-y-2 text-left">
                    <div>
                        <strong className="text-gray-300">Error:</strong>{" "}
                        <span className="text-gray-400">{error.name || "Error"}</span>
                    </div>
                    <div>
                        <strong className="text-gray-300">Message:</strong>{" "}
                        <span className="text-gray-400">{error.message || "Unknown error"}</span>
                    </div>
                    <div>
                        <strong className="text-gray-300">Tab ID:</strong>{" "}
                        <span className="text-gray-400">{tabId}</span>
                    </div>
                    <div>
                        <strong className="text-gray-300">Time:</strong>{" "}
                        <span className="text-gray-400">{new Date().toISOString()}</span>
                    </div>
                    {error.stack && (
                        <div>
                            <strong className="text-gray-300">Stack Trace:</strong>
                            <pre className="mt-1 text-xs overflow-auto max-h-48 text-gray-400 whitespace-pre-wrap">
                                {error.stack}
                            </pre>
                        </div>
                    )}
                    <button
                        className="mt-2 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                        onClick={() => copyErrorDetails(error, `Tab Error (ID: ${tabId})`)}
                    >
                        <i className="fa fa-copy mr-1" />
                        Copy Error Details
                    </button>
                </div>
            </details>
        )}
    </div>
);

const TabContent = React.memo(({ tabId }: { tabId: string }) => {
    const oref = useMemo(() => WOS.makeORef("tab", tabId), [tabId]);
    const loadingAtom = useMemo(() => WOS.getWaveObjectLoadingAtom(oref), [oref]);
    const tabLoading = useAtomValue(loadingAtom);
    const tabAtom = useMemo(() => WOS.getWaveObjectAtom<Tab>(oref), [oref]);
    const tabData = useAtomValue(tabAtom);
    const tileGapSize = useAtomValue(tileGapSizeAtom);

    const tileLayoutContents = useMemo(() => {
        const renderContent: ContentRenderer = (nodeModel: NodeModel) => {
            return <Block key={nodeModel.blockId} nodeModel={nodeModel} preview={false} />;
        };

        const renderPreview: PreviewRenderer = (nodeModel: NodeModel) => {
            return <Block key={nodeModel.blockId} nodeModel={nodeModel} preview={true} />;
        };

        function onNodeDelete(data: TabLayoutData) {
            return services.ObjectService.DeleteBlock(data.blockId);
        }

        return {
            renderContent,
            renderPreview,
            tabId,
            onNodeDelete,
            gapSizePx: tileGapSize,
        } as TileLayoutContents;
    }, [tabId, tileGapSize]);

    let innerContent;

    if (tabLoading) {
        innerContent = <CenteredDiv>Tab Loading</CenteredDiv>;
    } else if (!tabData) {
        innerContent = <CenteredDiv>Tab Not Found</CenteredDiv>;
    } else if (tabData?.blockids?.length == 0) {
        innerContent = null;
    } else {
        innerContent = (
            <ErrorBoundary fallback={<TabErrorFallback error={null} tabId={tabId} />}>
                <TileLayout
                    key={tabId}
                    contents={tileLayoutContents}
                    tabAtom={tabAtom}
                    getCursorPoint={getApi().getCursorPoint}
                />
            </ErrorBoundary>
        );
    }

    return (
        <div className="flex flex-row flex-grow min-h-0 w-full items-center justify-center overflow-hidden relative pt-[3px] pr-[3px]">
            {innerContent}
        </div>
    );
});

export { TabContent };
