// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Button } from "@/app/element/button";
import { CenteredDiv } from "@/app/element/quickelems";
import { globalStore } from "@/store/global";
import { getWebServerEndpoint } from "@/util/endpoints";
import { jotaiLoadableValue } from "@/util/util";
import { formatRemoteUri } from "@/util/waveutil";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import type { SpecializedViewProps } from "./preview";
import * as EXIF from "exif-js";

function ImageZoomControls() {
    const { zoomIn, zoomOut, resetTransform } = useControls();

    return (
        <div className="absolute flex flex-row z-[2] top-0 right-0 p-[5px] gap-1">
            <Button onClick={() => zoomIn()} title="Zoom In" className="py-1 px-[5px]">
                <i className="fa-sharp fa-plus" />
            </Button>
            <Button onClick={() => zoomOut()} title="Zoom Out" className="py-1 px-[5px]">
                <i className="fa-sharp fa-minus" />
            </Button>
            <Button onClick={() => resetTransform()} title="Reset Zoom" className="py-1 px-[5px]">
                <i className="fa-sharp fa-rotate-left" />
            </Button>
        </div>
    );
}

function StreamingImagePreview({ url }: { url: string }) {
    const imgRef = useRef<HTMLImageElement>(null);
    const [imgTransform, setImgTransform] = useState<string>("none");

    useEffect(() => {
        const img = imgRef.current;
        if (!img) return;

        const handleLoad = () => {
            EXIF.getData(img as any, function () {
                const orientation = EXIF.getTag(this, "Orientation");
                // Apply CSS transform based on EXIF orientation
                // 1: Normal (no rotation)
                // 3: Rotate 180°
                // 6: Rotate 90° CW
                // 8: Rotate 90° CCW (270° CW)
                const transforms: { [key: number]: string } = {
                    1: "none",
                    3: "rotate(180deg)",
                    6: "rotate(90deg)",
                    8: "rotate(-90deg)",
                    // Handle mirrored orientations (less common)
                    2: "scaleX(-1)", // Mirrored horizontal
                    4: "scaleX(-1) rotate(180deg)", // Mirrored horizontal + 180°
                    5: "scaleX(-1) rotate(90deg)", // Mirrored horizontal + 90° CW
                    7: "scaleX(-1) rotate(-90deg)", // Mirrored horizontal + 90° CCW
                };
                setImgTransform(transforms[orientation] || "none");
            });
        };

        img.addEventListener("load", handleLoad);
        // If image is already loaded (cached), trigger immediately
        if (img.complete) {
            handleLoad();
        }

        return () => {
            img.removeEventListener("load", handleLoad);
        };
    }, [url]);

    return (
        <div className="flex flex-row h-full overflow-hidden items-center justify-center relative">
            <TransformWrapper initialScale={1} centerOnInit pinch={{ step: 10 }}>
                {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
                    <>
                        <ImageZoomControls />
                        <TransformComponent wrapperClass="!h-full !w-full">
                            <img ref={imgRef} src={url} className="z-[1]" style={{ transform: imgTransform }} />
                        </TransformComponent>
                    </>
                )}
            </TransformWrapper>
        </div>
    );
}

function StreamingPreview({ model }: SpecializedViewProps) {
    useEffect(() => {
        model.refreshCallback = () => {
            globalStore.set(model.refreshVersion, (v) => v + 1);
        };
        return () => {
            model.refreshCallback = null;
        };
    }, []);
    const conn = useAtomValue(model.connectionImmediate);
    const loadableFileInfo = useAtomValue(model.loadableFileInfo);
    const fileInfo = jotaiLoadableValue(loadableFileInfo, null);
    if (!fileInfo) {
        return <CenteredDiv>Loading...</CenteredDiv>;
    }
    const filePath = fileInfo.path;
    const remotePath = formatRemoteUri(filePath, conn);
    const usp = new URLSearchParams();
    usp.set("path", remotePath);
    const streamingUrl = `${getWebServerEndpoint()}/wave/stream-file?${usp.toString()}`;
    if (fileInfo.mimetype === "application/pdf") {
        return (
            <div className="flex flex-row h-full overflow-hidden items-center justify-center p-[5px]">
                <iframe src={streamingUrl} width="100%" height="100%" name="pdfview" />
            </div>
        );
    }
    if (fileInfo.mimetype.startsWith("video/")) {
        return (
            <div className="flex flex-row h-full overflow-hidden items-center justify-center">
                <video controls className="w-full h-full p-[10px] object-contain">
                    <source src={streamingUrl} />
                </video>
            </div>
        );
    }
    if (fileInfo.mimetype.startsWith("audio/")) {
        return (
            <div className="flex flex-row h-full overflow-hidden items-center justify-center">
                <audio controls className="w-full h-full p-[10px] object-contain">
                    <source src={streamingUrl} />
                </audio>
            </div>
        );
    }
    if (fileInfo.mimetype.startsWith("image/")) {
        return <StreamingImagePreview url={streamingUrl} />;
    }
    return <CenteredDiv>Preview Not Supported</CenteredDiv>;
}

export { StreamingPreview };
