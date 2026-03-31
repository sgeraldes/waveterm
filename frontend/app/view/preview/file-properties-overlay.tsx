// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useRef } from "react";
import { getBestUnit, getLastModifiedTime } from "./preview-directory-utils";

interface FilePropertiesOverlayProps {
    finfo: FileInfo;
    onClose: () => void;
    style?: React.CSSProperties;
    forwardRef?: React.Ref<HTMLDivElement>;
}

function formatPermissions(modestr: string): string {
    if (!modestr) return "-";
    return modestr;
}

function formatModTime(modtime: number): string {
    if (!modtime) return "-";
    const d = new Date(modtime);
    return d.toLocaleString();
}

function isReadOnly(finfo: FileInfo): boolean {
    if (finfo.readonly != null) return finfo.readonly;
    const modestr = finfo.modestr;
    if (!modestr || modestr.length < 2) return false;
    // Check owner write bit (position 2 in "-rwxrwxrwx" format)
    return modestr[2] !== "w";
}

export const FilePropertiesOverlay = React.memo(
    ({ finfo, onClose, style, forwardRef }: FilePropertiesOverlayProps) => {
        const overlayRef = useRef<HTMLDivElement>(null);

        const handleKeyDown = useCallback(
            (e: KeyboardEvent) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                }
            },
            [onClose]
        );

        const handleOutsideClick = useCallback(
            (e: MouseEvent) => {
                if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
                    onClose();
                }
            },
            [onClose]
        );

        useEffect(() => {
            document.addEventListener("keydown", handleKeyDown);
            document.addEventListener("mousedown", handleOutsideClick);
            return () => {
                document.removeEventListener("keydown", handleKeyDown);
                document.removeEventListener("mousedown", handleOutsideClick);
            };
        }, [handleKeyDown, handleOutsideClick]);

        const fileName = finfo.path.split("/").pop() || finfo.path;
        const readOnly = isReadOnly(finfo);

        const rows: { label: string; value: string }[] = [
            { label: "Name", value: fileName },
            { label: "Full Path", value: finfo.path },
            { label: "Size", value: finfo.isdir ? "-" : getBestUnit(finfo.size) },
            { label: "MIME Type", value: finfo.mimetype || "-" },
            { label: "Permissions", value: formatPermissions(finfo.modestr) },
            { label: "Modified", value: formatModTime(finfo.modtime) },
            { label: "Read-only", value: readOnly ? "Yes" : "No" },
        ];

        return (
            <div
                className="file-properties-overlay"
                role="dialog"
                aria-labelledby="file-properties-title"
                aria-modal="true"
                ref={(node) => {
                    (overlayRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                    if (typeof forwardRef === "function") {
                        forwardRef(node);
                    } else if (forwardRef) {
                        (forwardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                    }
                }}
                style={style}
            >
                <div className="file-properties-header">
                    <span id="file-properties-title" className="file-properties-title">
                        Properties
                    </span>
                    <button className="file-properties-close" onClick={onClose} aria-label="Close properties">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>
                <div className="file-properties-body">
                    {rows.map(({ label, value }) => (
                        <div className="file-properties-row" key={label}>
                            <span className="file-properties-label">{label}</span>
                            <span className="file-properties-value" title={value}>
                                {value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
);

FilePropertiesOverlay.displayName = "FilePropertiesOverlay";
