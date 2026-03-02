import { CenteredDiv } from "@/app/element/quickelems";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { BlockHeaderSuggestionControl } from "@/app/suggestion/suggestion";
import { globalStore } from "@/store/global";
import { isBlank, jotaiLoadableValue, makeConnRoute } from "@/util/util";
import * as WPS from "@/store/wps";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useEffect } from "react";
import { useDrop } from "react-dnd";
import { CSVView } from "./csvview";
import { DirectoryPreview } from "./preview-directory";
import { CodeEditPreview } from "./preview-edit";
import { ErrorOverlay } from "./preview-error-overlay";
import { MarkdownPreview } from "./preview-markdown";
import type { PreviewModel } from "./preview-model";
import { StreamingPreview } from "./preview-streaming";

export type SpecializedViewProps = {
    model: PreviewModel;
    parentRef: React.RefObject<HTMLDivElement>;
};

const SpecializedViewMap: { [view: string]: ({ model }: SpecializedViewProps) => React.JSX.Element } = {
    streaming: StreamingPreview,
    markdown: MarkdownPreview,
    codeedit: CodeEditPreview,
    csv: CSVViewPreview,
    directory: DirectoryPreview,
};

function canPreview(mimeType: string): boolean {
    if (mimeType == null) {
        return false;
    }
    return mimeType.startsWith("text/markdown") || mimeType.startsWith("text/csv");
}

function CSVViewPreview({ model, parentRef }: SpecializedViewProps) {
    const fileContent = useAtomValue(model.fileContent);
    const loadableFileInfo = useAtomValue(model.loadableFileInfo);
    const fileName = jotaiLoadableValue(loadableFileInfo, null)?.path;
    return <CSVView parentRef={parentRef} readonly={true} content={fileContent} filename={fileName} />;
}

const SpecializedView = memo(({ parentRef, model }: SpecializedViewProps) => {
    const loadableSpecializedView = useAtomValue(model.loadableSpecializedView);
    const loadableMimeType = useAtomValue(model.fileMimeTypeLoadable);
    const loadableFileInfo = useAtomValue(model.loadableFileInfo);
    const setCanPreview = useSetAtom(model.canPreview);

    const mimeType = jotaiLoadableValue(loadableMimeType, null);
    const fileInfo = jotaiLoadableValue(loadableFileInfo, null);
    const specializedView = jotaiLoadableValue(loadableSpecializedView, { specializedView: null, errorStr: null });

    useEffect(() => {
        setCanPreview(canPreview(mimeType));
    }, [mimeType, setCanPreview]);

    if (loadableSpecializedView.state === "loading") {
        return <CenteredDiv>Loading...</CenteredDiv>;
    }

    if (specializedView.errorStr != null) {
        return <CenteredDiv>{specializedView.errorStr}</CenteredDiv>;
    }
    const SpecializedViewComponent = SpecializedViewMap[specializedView.specializedView];
    if (!SpecializedViewComponent) {
        return <CenteredDiv>Invalid Specialized View Component ({specializedView.specializedView})</CenteredDiv>;
    }
    return <SpecializedViewComponent key={model.blockId} model={model} parentRef={parentRef} />;
});

const fetchSuggestions = async (
    model: PreviewModel,
    query: string,
    reqContext: SuggestionRequestContext
): Promise<FetchSuggestionsResponse> => {
    try {
        const conn = await globalStore.get(model.connection);
        let route = makeConnRoute(conn);
        if (isBlank(conn)) {
            route = null;
        }
        if (reqContext?.dispose) {
            RpcApi.DisposeSuggestionsCommand(TabRpcClient, reqContext.widgetid, { noresponse: true, route: route });
            return null;
        }
        const fileInfo = await globalStore.get(model.statFile);
        if (fileInfo == null) {
            return null;
        }
        const sdata = {
            suggestiontype: "file",
            "file:cwd": fileInfo.path,
            query: query,
            widgetid: reqContext.widgetid,
            reqnum: reqContext.reqnum,
            "file:connection": conn,
        };
        return await RpcApi.FetchSuggestionsCommand(TabRpcClient, sdata, {
            route: route,
        });
    } catch (error) {
        console.error("Failed to fetch file suggestions:", error);
        return null;
    }
};

function PreviewView({
    blockRef,
    contentRef,
    model,
}: {
    blockId: string;
    blockRef: React.RefObject<HTMLDivElement>;
    contentRef: React.RefObject<HTMLDivElement>;
    model: PreviewModel;
}) {
    const connStatus = useAtomValue(model.connStatus);
    const [errorMsg, setErrorMsg] = useAtom(model.errorMsgAtom);
    const connection = useAtomValue(model.connectionImmediate);
    const loadableFileInfo = useAtomValue(model.loadableFileInfo);
    const fileInfo = jotaiLoadableValue(loadableFileInfo, null);
    const loadableSpecializedView = useAtomValue(model.loadableSpecializedView);
    const currentView =
        loadableSpecializedView.state === "hasData" ? loadableSpecializedView.data.specializedView : null;

    const [{ isOver, canDrop }, dropRef] = useDrop(
        () => ({
            accept: "FILE_ITEM",
            canDrop: (draggedFile: DraggedFile) => {
                if (currentView === "directory") return false;
                const fileConn = isBlank(connection) ? "local" : connection;
                const expectedPrefix = `wsh://${fileConn}/`;
                return draggedFile.uri.startsWith(expectedPrefix);
            },
            drop: (draggedFile: DraggedFile) => {
                // Extract path from URI: "wsh://local/path/to/file" -> "/path/to/file"
                const url = new URL(draggedFile.uri);
                const filePath = url.pathname;
                model.goHistory(filePath);
            },
            collect: (monitor) => ({
                isOver: monitor.isOver(),
                canDrop: monitor.canDrop(),
            }),
        }),
        [connection, currentView, model]
    );

    useEffect(() => {
        if (contentRef.current) {
            dropRef(contentRef.current);
        }
    }, [contentRef.current, dropRef]);

    useEffect(() => {
        if (!fileInfo) {
            return;
        }
        setErrorMsg(null);
    }, [connection, fileInfo]);

    // Start/stop file watching based on view type
    useEffect(() => {
        if (currentView === "codeedit" || currentView === "markdown" || currentView === "csv") {
            model.startFileWatcher();
        }
        return () => {
            model.stopFileWatcher();
        };
    }, [currentView, model]);

    // Subscribe to file change events
    useEffect(() => {
        const unsubFn = WPS.waveEventSubscribe({
            eventType: "file:change",
            scope: model.blockId,
            handler: (event) => {
                model.handleFileChangeEvent();
            },
        });
        return () => {
            unsubFn();
        };
    }, [model]);

    if (connStatus?.status != "connected") {
        return null;
    }
    const handleSelect = (s: SuggestionType, queryStr: string): boolean => {
        if (s == null) {
            if (isBlank(queryStr)) {
                globalStore.set(model.openFileModal, false);
                return true;
            }
            model.handleOpenFile(queryStr);
            return true;
        }
        model.handleOpenFile(s["file:path"]);
        return true;
    };
    const handleTab = (s: SuggestionType, query: string): string => {
        if (s["file:mimetype"] == "directory") {
            return s["file:name"] + "/";
        } else {
            return s["file:name"];
        }
    };
    const fetchSuggestionsFn = async (query, ctx) => {
        return await fetchSuggestions(model, query, ctx);
    };

    return (
        <>
            <div key="fullpreview" className="flex flex-col w-full overflow-hidden scrollbar-hide-until-hover">
                {errorMsg && <ErrorOverlay errorMsg={errorMsg} resetOverlay={() => setErrorMsg(null)} />}
                <div ref={contentRef} className="flex-grow overflow-hidden" style={{ position: "relative" }}>
                    <SpecializedView parentRef={contentRef} model={model} />
                    {isOver && canDrop && (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                backgroundColor: "rgba(var(--accent-color-rgb, 59, 130, 246), 0.15)",
                                border: "2px dashed var(--accent-color, #3b82f6)",
                                borderRadius: "4px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                pointerEvents: "none",
                                zIndex: 10,
                                fontSize: "14px",
                                color: "var(--main-text-color)",
                            }}
                        >
                            Open File
                        </div>
                    )}
                </div>
            </div>
            <BlockHeaderSuggestionControl
                blockRef={blockRef}
                openAtom={model.openFileModal}
                onClose={() => model.updateOpenFileModalAndError(false)}
                onSelect={handleSelect}
                onTab={handleTab}
                fetchSuggestions={fetchSuggestionsFn}
                placeholderText="Open File..."
            />
        </>
    );
}

export { PreviewView };
