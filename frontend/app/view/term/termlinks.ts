// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * termlinks.ts — File path link provider for xterm.js terminals.
 *
 * Detects file paths in terminal output and provides clickable links
 * that open the file in a Wave preview block (click) or external
 * editor / OS default (Ctrl+click / Cmd+click).
 */

import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { atoms, createBlock, getApi, globalStore } from "@/store/global";
import { isBlockedPath, quickValidatePath } from "@/util/pathutil";
import { makeConnRoute } from "@/util/util";
import type { ILink, ILinkProvider, Terminal } from "@xterm/xterm";

// ---------------------------------------------------------------------------
// Regex
// ---------------------------------------------------------------------------

/**
 * Matches file paths in terminal output lines.
 *
 * Groups:
 *   1 — the file path (without any line/col suffix)
 *   2 — optional line number (after first colon)
 *   3 — optional column number (after second colon)
 *
 * Supported formats:
 *   /absolute/unix/path
 *   ./relative  ../relative
 *   C:\Windows\path  or  C:/Windows/path  (Windows drive letter)
 *   Any of the above optionally followed by :line or :line:col
 *
 * The leading look-behind requires the match to start at the beginning of
 * the string OR after whitespace or an opening parenthesis, so bare words
 * like "something" don't fire.
 */
export const FILE_PATH_REGEX =
    /(?:^|(?<=[\s(]))((?:[a-zA-Z]:[/\\][^\s:,;"'`|><()\[\]{}]*|\.{1,2}\/[^\s:,;"'`|><()\[\]{}]*|\/[^\s:,;"'`|><()\[\]{}]+))(?::(\d+)(?::(\d+))?)?/g;

// ---------------------------------------------------------------------------
// LRU-ish cache (Map preserves insertion order, so oldest entry = first key)
// ---------------------------------------------------------------------------

const CACHE_MAX_SIZE = 200;
const CACHE_TTL_MS = 10_000; // 10 seconds

interface CacheEntry {
    exists: boolean;
    time: number;
}

// Exported for testing
export const pathCache = new Map<string, CacheEntry>();

/**
 * Evicts entries that have exceeded the TTL and trims the cache to
 * CACHE_MAX_SIZE by removing the oldest entries first.
 */
export function evictCache(): void {
    const now = Date.now();
    for (const [key, entry] of pathCache) {
        if (now - entry.time >= CACHE_TTL_MS) {
            pathCache.delete(key);
        }
    }
    // If still over the limit, drop oldest (first-inserted) entries.
    while (pathCache.size > CACHE_MAX_SIZE) {
        const firstKey = pathCache.keys().next().value;
        pathCache.delete(firstKey);
    }
}

// ---------------------------------------------------------------------------
// File existence probe
// ---------------------------------------------------------------------------

/**
 * Checks whether a path exists on the local filesystem or, when a remote
 * connection is provided, on the remote host. Results are cached for TTL ms.
 *
 * @param path       Validated path string to probe.
 * @param connection Optional connection name (e.g. "ssh://host") for remote.
 * @returns          true if the file/directory exists, false otherwise.
 */
export async function probeFileExists(path: string, connection: string | null): Promise<boolean> {
    const cacheKey = connection ? `${connection}:${path}` : path;
    const cached = pathCache.get(cacheKey);
    if (cached != null && Date.now() - cached.time < CACHE_TTL_MS) {
        return cached.exists;
    }

    try {
        let fileInfo: FileInfo;
        if (connection) {
            fileInfo = await RpcApi.RemoteFileInfoCommand(TabRpcClient, path, {
                route: makeConnRoute(connection),
            });
        } else {
            fileInfo = await RpcApi.FileInfoCommand(TabRpcClient, { info: { path } }, null);
        }
        const exists = !fileInfo.notfound;
        evictCache();
        pathCache.set(cacheKey, { exists, time: Date.now() });
        return exists;
    } catch {
        // Don't cache errors so a transient failure retries next time.
        return false;
    }
}

// ---------------------------------------------------------------------------
// Open helpers
// ---------------------------------------------------------------------------

/**
 * Opens a file in a Wave preview block, optionally jumping to a specific line
 * and column.
 */
export function openFilePath(
    path: string,
    line: number | null,
    col: number | null,
    connection: string | null
): void {
    const meta: Record<string, unknown> = {
        view: "preview",
        file: path,
    };
    if (connection) {
        meta.connection = connection;
    }
    if (line != null) {
        meta["preview:line"] = line;
    }
    if (col != null) {
        meta["preview:col"] = col;
    }
    createBlock({ meta });
}

/**
 * Opens a file in the configured external editor (term:externaleditor) or
 * falls back to the OS default handler via openNativePath.
 *
 * Remote paths are not supported — a console warning is emitted instead.
 */
export function openFileExternal(path: string, connection: string | null): void {
    if (connection) {
        console.warn("[termlinks] external editor not available for remote connection:", connection);
        return;
    }
    const settings = globalStore.get(atoms.settingsAtom);
    const editor = settings?.["term:externaleditor"];
    if (editor) {
        getApi().openExternalEditor(editor, path);
    } else {
        getApi().openNativePath(path);
    }
}

// ---------------------------------------------------------------------------
// ILinkProvider implementation
// ---------------------------------------------------------------------------

/**
 * Creates an xterm.js ILinkProvider that detects file paths in terminal
 * output and makes them clickable.
 *
 * @param terminal      The xterm Terminal instance to read buffer lines from.
 * @param blockId       The block's ID (unused directly but kept for future use).
 * @param getConnection A function that returns the current connection string or
 *                      null for local.
 * @param getCwd        A function that returns the current working directory or
 *                      null if unknown (used for resolving relative paths in
 *                      future iterations; probing uses the raw path for now).
 */
export function createFileLinkProvider(
    terminal: Terminal,
    _blockId: string,
    getConnection: () => string | null,
    getCwd: () => string | null
): ILinkProvider {
    return {
        provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
            const bufferLine = terminal.buffer.active.getLine(bufferLineNumber - 1);
            if (bufferLine == null) {
                callback(undefined);
                return;
            }

            const lineText = bufferLine.translateToString(true);
            const connection = getConnection();

            // Collect all regex matches first (reset lastIndex each call).
            FILE_PATH_REGEX.lastIndex = 0;
            const rawMatches: Array<{ pathText: string; line: number | null; col: number | null; startX: number; endX: number }> = [];

            for (const match of lineText.matchAll(FILE_PATH_REGEX)) {
                const pathText = match[1];
                const lineNum = match[2] != null ? parseInt(match[2], 10) : null;
                const colNum = match[3] != null ? parseInt(match[3], 10) : null;

                // Determine where in the line the path text starts/ends.
                // match.index is the start of the full match; the path group
                // starts one character later when the leading boundary char is
                // captured (space, '('). We need to find the actual path start.
                const fullMatchStart = match.index ?? 0;
                const fullMatchText = match[0];
                const pathOffset = fullMatchText.indexOf(pathText);
                const startX = fullMatchStart + pathOffset + 1; // xterm columns are 1-based
                const endX = startX + pathText.length - 1;

                // Quick synchronous validation before the async probe.
                const validation = quickValidatePath(pathText);
                if (!validation.valid) {
                    continue;
                }
                if (isBlockedPath(pathText)) {
                    continue;
                }

                rawMatches.push({ pathText, line: lineNum, col: colNum, startX, endX });
            }

            if (rawMatches.length === 0) {
                callback(undefined);
                return;
            }

            // Resolve relative paths against cwd before probing.
            const cwd = getCwd();
            const resolvedMatches = rawMatches.map((m) => {
                const isAbsolute = m.pathText.startsWith("/") || /^[A-Za-z]:/.test(m.pathText);
                const resolvedPath = !isAbsolute && cwd ? cwd + "/" + m.pathText : m.pathText;
                return { ...m, resolvedPath };
            });

            // Probe all matches in parallel, then build the link list.
            Promise.all(
                resolvedMatches.map(async (m) => {
                    const exists = await probeFileExists(m.resolvedPath, connection);
                    return exists ? m : null;
                })
            ).then((results) => {
                const links: ILink[] = results
                    .filter((r): r is NonNullable<typeof r> => r != null)
                    .map((m) => ({
                        range: {
                            start: { x: m.startX, y: bufferLineNumber },
                            end: { x: m.endX, y: bufferLineNumber },
                        },
                        text: m.pathText,
                        activate(event: MouseEvent, _text: string) {
                            if (event.ctrlKey || event.metaKey) {
                                openFileExternal(m.resolvedPath, connection);
                            } else {
                                openFilePath(m.resolvedPath, m.line, m.col, connection);
                            }
                        },
                    }));
                callback(links.length > 0 ? links : undefined);
            }).catch(() => {
                callback(undefined);
            });
        },
    };
}
