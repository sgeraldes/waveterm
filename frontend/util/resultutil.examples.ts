// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Example implementations demonstrating Result type usage for critical operations
 *
 * These examples show how to gradually adopt Result types in the codebase.
 * Copy these patterns when converting existing code or writing new operations.
 *
 * NOTE: This file contains reference implementations and may not compile standalone.
 * It is intended as documentation and copy-paste reference for actual implementation.
 */

import type { Result } from "./resultutil";
import { err, isErr, isOk, ok, safeAsync } from "./resultutil";

// Type declarations for reference (these come from the actual codebase)
declare const RpcApi: any;
declare const TabRpcClient: any;
declare function showErrorNotification(title: string, message: string): void;

/**
 * EXAMPLE 1: Connection Establishment
 *
 * Before (untyped error handling):
 * ```typescript
 * try {
 *     await RpcApi.ConnConnectCommand(TabRpcClient, { host: connName, logblockid: blockId });
 * } catch (e) {
 *     const errorMsg = e instanceof Error ? e.message : String(e);
 *     setConnectionError(`Failed to connect: ${errorMsg}`);
 * }
 * ```
 *
 * After (Result type):
 */
export async function connectToRemote(
    connName: string,
    blockId: string,
    timeoutMs: number = 60000
): Promise<Result<void, string>> {
    return safeAsync(async () => {
        await RpcApi.ConnConnectCommand(TabRpcClient, { host: connName, logblockid: blockId }, { timeout: timeoutMs });
    });
}

/**
 * Usage of connectToRemote:
 * ```typescript
 * import { isErr } from "./resultutil";
 *
 * const result = await connectToRemote(connName, blockId);
 * if (isErr(result)) {
 *     showErrorNotification("Connection Failed", result.error);
 *     setConnectionError(result.error);
 *     return;
 * }
 * // Connection successful
 * setConnectionError("");
 * ```
 */

/**
 * EXAMPLE 2: File Operations
 *
 * Before (silent failure):
 * ```typescript
 * try {
 *     await RpcApi.FileMkdirCommand(TabRpcClient, { info: { path: remotePath } });
 * } catch {
 *     // Directory may already exist; ignore mkdir errors
 * }
 * ```
 *
 * After (explicit error handling):
 */
export async function ensureDirectoryExists(remotePath: string): Promise<Result<void, string>> {
    return safeAsync(async () => {
        await RpcApi.FileMkdirCommand(TabRpcClient, { info: { path: remotePath } });
    });
}

export async function writeFileWithBase64(
    remotePath: string,
    base64Data: string
): Promise<Result<void, string>> {
    return safeAsync(async () => {
        await RpcApi.FileWriteCommand(TabRpcClient, { info: { path: remotePath }, data64: base64Data });
    });
}

/**
 * Usage of file operations with proper error handling:
 * ```typescript
 * import { isErr } from "./resultutil";
 *
 * const mkdirResult = await ensureDirectoryExists(imagesDirPath);
 * if (isErr(mkdirResult) && !mkdirResult.error.includes("exists")) {
 *     // Only show error if it's not "already exists"
 *     showErrorNotification("Failed to create directory", mkdirResult.error);
 *     return null;
 * }
 *
 * const writeResult = await writeFileWithBase64(filePath, base64Data);
 * if (isErr(writeResult)) {
 *     showErrorNotification("Failed to save file", writeResult.error);
 *     return null;
 * }
 * ```
 */

/**
 * EXAMPLE 3: AI API Calls
 *
 * AI operations can fail for many reasons (rate limits, network, invalid input).
 * Result types make these failure modes explicit.
 */
export async function sendAIMessage(chatId: string, message: string): Promise<Result<void, string>> {
    return safeAsync(async () => {
        const data = {
            chatid: chatId,
            message: message,
        };
        await RpcApi.AiSendMessageCommand(TabRpcClient, data);
    });
}

/**
 * Usage of AI operations:
 * ```typescript
 * import { isErr } from "./resultutil";
 *
 * const result = await sendAIMessage(chatId, userMessage);
 * if (isErr(result)) {
 *     if (result.error.includes("rate limit")) {
 *         showErrorNotification("Rate Limited", "Please wait before sending another message");
 *     } else {
 *         showErrorNotification("AI Error", result.error);
 *     }
 *     return;
 * }
 * // Message sent successfully
 * ```
 */

/**
 * EXAMPLE 4: State Updates with Validation
 *
 * State updates that involve RPC calls can fail. Result types ensure we handle these failures.
 */
export async function updateBlockMetadata(
    blockId: string,
    metaKey: string,
    metaValue: any
): Promise<Result<void, string>> {
    return safeAsync(async () => {
        await RpcApi.SetMetaCommand(TabRpcClient, {
            oref: { otype: "block", oid: blockId },
            meta: { [metaKey]: metaValue },
        });
    });
}

/**
 * Usage of state updates:
 * ```typescript
 * import { isErr, isOk } from "./resultutil";
 *
 * const result = await updateBlockMetadata(blockId, "view:name", newName);
 * if (isErr(result)) {
 *     showErrorNotification("Failed to update block", result.error);
 *     // Revert optimistic UI update
 *     setLocalState(previousValue);
 *     return;
 * }
 * // Update successful, optimistic UI stays
 * ```
 */

/**
 * EXAMPLE 5: Settings Operations
 *
 * Settings saves can fail due to validation errors or file system issues.
 */
export async function saveSettings(settings: Record<string, any>): Promise<Result<void, string>> {
    return safeAsync(async () => {
        await RpcApi.SetConfigCommand(TabRpcClient, settings);
    });
}

export async function loadGitBashPath(rescan: boolean = false): Promise<Result<string, string>> {
    return safeAsync(async () => {
        const path = await RpcApi.FindGitBashCommand(TabRpcClient, rescan, { timeout: 2000 });
        return path;
    });
}

/**
 * Usage of settings operations:
 * ```typescript
 * import { isErr, isOk } from "./resultutil";
 *
 * const result = await saveSettings({ "term:fontsize": 14 });
 * if (isErr(result)) {
 *     showErrorNotification("Failed to save settings", result.error);
 *     return;
 * }
 * showSuccessNotification("Settings saved");
 *
 * // For operations where failure is expected (like Git Bash detection)
 * const pathResult = await loadGitBashPath();
 * if (isOk(pathResult)) {
 *     globalStore.set(gitBashPathAtom, pathResult.data);
 * } else if (isErr(pathResult)) {
 *     // Don't notify user - this is background detection
 *     console.log("Git Bash not found:", pathResult.error);
 *     globalStore.set(gitBashPathAtom, "");
 * }
 * ```
 */

/**
 * MIGRATION STRATEGY
 *
 * 1. Start with new code - all new RPC calls should return Result types
 *
 * 2. Identify critical paths:
 *    - Connection establishment (highest priority)
 *    - File operations (data loss risk)
 *    - AI operations (rate limiting)
 *    - Settings saves (user-facing)
 *
 * 3. Create Result-returning wrappers (like examples above) for existing code
 *
 * 4. Update call sites one at a time:
 *    - Replace try-catch with Result checking
 *    - Add proper error notifications
 *    - Handle edge cases explicitly
 *
 * 5. Mark converted functions with JSDoc:
 *    ```typescript
 *    /**
 *     * @returns Result<void, string> - Success or error message
 *     *\/
 *    ```
 *
 * 6. Don't break existing code - both patterns can coexist during migration
 */

/**
 * ADVANCED PATTERN: Chaining Multiple Operations
 *
 * When multiple operations depend on each other, use chainResultAsync:
 */
export async function saveImageToDirectory(
    imageData: string,
    filename: string,
    baseDir: string
): Promise<Result<string, string>> {
    // Create directory
    const imagesDirPath = `${baseDir}/.wave/images`;
    const mkdirResult = await ensureDirectoryExists(imagesDirPath);

    // We tolerate "already exists" errors for mkdir
    if (isErr(mkdirResult)) {
        const errorLower = typeof mkdirResult.error === "string" ? mkdirResult.error.toLowerCase() : "";
        if (!errorLower.includes("exist")) {
            return err(`Failed to create directory: ${mkdirResult.error}`);
        }
    }

    // Write file
    const filePath = `${imagesDirPath}/${filename}`;
    const writeResult = await writeFileWithBase64(filePath, imageData);

    if (isErr(writeResult)) {
        return err(`Failed to write file: ${writeResult.error}`);
    }

    // Return relative path for markdown
    return ok(`.wave/images/${filename}`);
}

/**
 * Usage of chained operations:
 * ```typescript
 * import { isErr, isOk } from "./resultutil";
 *
 * const result = await saveImageToDirectory(base64Data, filename, tabBasedir);
 * if (isErr(result)) {
 *     showErrorNotification("Failed to save image", result.error);
 *     return null;
 * }
 * // Use result.data (the markdown path)
 * return `![](${result.data})`;
 * ```
 */
