// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { showErrorNotification } from "@/util/errorutil";
import { formatRemoteUri } from "@/util/waveutil";

const IMAGES_DIR = ".wave/images";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export function generateImageFilename(): string {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${date}-${random}.png`;
}

export function getMarkdownImageRef(filename: string): string {
    return `![](.wave/images/${filename})`;
}

async function imageItemToBase64(item: DataTransferItem): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const file = item.getAsFile();
        if (!file) {
            reject(new Error("Cannot get file from clipboard item"));
            return;
        }

        // Validate file size
        if (file.size > MAX_IMAGE_SIZE) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            showErrorNotification(
                "Image Too Large",
                `Image size (${sizeMB} MB) exceeds maximum allowed size of 10 MB. Please use a smaller image.`
            );
            resolve(null);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            // dataUrl is "data:image/png;base64,<data>"
            const base64 = dataUrl.split(",")[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error("Failed to read clipboard image"));
        reader.readAsDataURL(file);
    });
}

/**
 * Handle clipboard paste event containing an image.
 * Saves the image to .wave/images/ relative to tabBasedir and returns markdown reference.
 *
 * @param clipboardData - The clipboard data from a paste event
 * @param tabBasedir - The tab base directory (or empty/"~" for home dir fallback)
 * @param connection - The connection string (empty/"local" for local)
 * @returns markdown image reference string (e.g. ![](.wave/images/2025-01-15-abc123.png)), or null if no image in clipboard
 */
export async function handleImagePaste(
    clipboardData: DataTransfer,
    tabBasedir: string,
    connection: string
): Promise<string | null> {
    // Only works for local connections
    const isLocal = !connection || connection === "local";
    if (!isLocal) {
        return null;
    }

    // Find an image item in clipboard
    const items = Array.from(clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) {
        return null;
    }

    // Determine base directory
    const baseDir = !tabBasedir || tabBasedir === "~" ? "~" : tabBasedir;
    const imagesDirPath = `${baseDir}/${IMAGES_DIR}`;
    const remotePath = formatRemoteUri(imagesDirPath, "local");

    // Ensure .wave/images/ directory exists
    try {
        await RpcApi.FileMkdirCommand(TabRpcClient, {
            info: { path: remotePath },
        });
    } catch {
        // Directory may already exist; ignore mkdir errors
    }

    // Convert clipboard image to base64
    const base64Data = await imageItemToBase64(imageItem);

    // If validation failed (image too large), return null
    if (!base64Data) {
        return null;
    }

    // Generate unique filename and save
    const filename = generateImageFilename();
    const filePath = `${baseDir}/${IMAGES_DIR}/${filename}`;
    const fileRemotePath = formatRemoteUri(filePath, "local");

    await RpcApi.FileWriteCommand(TabRpcClient, {
        info: { path: fileRemotePath },
        data64: base64Data,
    });

    return getMarkdownImageRef(filename);
}
