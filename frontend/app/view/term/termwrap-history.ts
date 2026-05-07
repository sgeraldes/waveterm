/**
 * Terminal data loading, state caching, and session history capture.
 * Standalone functions extracted from TermWrap to keep termwrap.ts under the module size limit.
 */
import { fetchWaveFile, globalStore, WOS } from "@/store/global";
import * as services from "@/store/services";
import { fireAndForget } from "@/util/util";
import debug from "debug";
import { MAX_CAPTURE_BYTES, shouldCapture, shouldSnapshot } from "./sessionhistory-capture";

const dlog = debug("wave:termwrap");

export const TermFileName = "term";
export const TermCacheFileName = "cache:term:full";
const MinDataProcessedForCache = 100 * 1024;

/** Minimal TermWrap context needed for data loading and state caching. */
export interface TermDataCtx {
    blockId: string;
    terminal: {
        rows: number;
        cols: number;
        resize(cols: number, rows: number): void;
    };
    ptyOffset: number;
    dataBytesProcessed: number;
    serializeAddon: { serialize(): string };
    doTerminalWrite(data: string | Uint8Array, setPtyOffset?: number): Promise<void>;
}

/** Minimal TermWrap context needed for session history capture. */
export interface SessionHistoryCtx {
    blockId: string;
    tabId: string;
    loaded: boolean;
    lastSnapshotTime: number;
    lastRollingLength: number;
    serializeAddon: { serialize(): string };
}

/**
 * Loads cache + main term file content into xterm.
 * Returns the absolute byte offset in the term file that the read covered up to.
 * Callers use this to deduplicate against subscription events that fire concurrently:
 * any held subscription event with offset < returned value is already in the file we just read.
 */
export async function loadInitialTerminalData(ctx: TermDataCtx): Promise<number> {
    const startTs = Date.now();

    // Check if this block should restore scrollback from another block's session history
    const blockData = globalStore.get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", ctx.blockId)));
    const restoreFromBlockId = blockData?.meta?.["term:restorefrom"] as string;
    if (restoreFromBlockId) {
        try {
            const base64Data = await services.SessionHistoryService.ReadLatestSegments(restoreFromBlockId, 5 * 1024 * 1024);
            if (base64Data) {
                const binaryStr = atob(base64Data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                const content = new TextDecoder().decode(bytes);
                if (content) {
                    await ctx.doTerminalWrite(content, 0);
                    dlog("restored %d bytes from session history of block %s in %dms", content.length, restoreFromBlockId, Date.now() - startTs);
                }
            }
        } catch (e) {
            console.error("[session-restore] failed to load from source block %s:", restoreFromBlockId, e);
        }
        // Clear the restore flag so it doesn't reload on reconnect
        fireAndForget(() =>
            services.ObjectService.UpdateObjectMeta(WOS.makeORef("block", ctx.blockId), { "term:restorefrom": null })
        );
    }

    const { data: cacheData, fileInfo: cacheFile } = await fetchWaveFile(ctx.blockId, TermCacheFileName);
    let ptyOffset = 0;
    if (cacheFile != null) {
        ptyOffset = cacheFile.meta["ptyoffset"] ?? 0;
        if (cacheData.byteLength > 0) {
            const curTermSize: TermSize = { rows: ctx.terminal.rows, cols: ctx.terminal.cols };
            const fileTermSize: TermSize = cacheFile.meta["termsize"];
            let didResize = false;
            if (
                fileTermSize != null &&
                (fileTermSize.rows != curTermSize.rows || fileTermSize.cols != curTermSize.cols)
            ) {
                console.log("terminal restore size mismatch, temp resize", fileTermSize, curTermSize);
                ctx.terminal.resize(fileTermSize.cols, fileTermSize.rows);
                didResize = true;
            }
            ctx.doTerminalWrite(cacheData, ptyOffset);
            if (didResize) {
                ctx.terminal.resize(curTermSize.cols, curTermSize.rows);
            }
        }
    }
    const { data: mainData, fileInfo: mainFile } = await fetchWaveFile(ctx.blockId, TermFileName, ptyOffset);
    dlog(
        "terminal loaded cachefile:%d main:%d bytes, %dms",
        cacheData?.byteLength ?? 0,
        mainData?.byteLength ?? 0,
        Date.now() - startTs
    );
    if (mainFile != null) {
        await ctx.doTerminalWrite(mainData);
    }
    return ptyOffset + (mainData?.byteLength ?? 0);
}

export function processAndCacheData(ctx: TermDataCtx): void {
    if (ctx.dataBytesProcessed < MinDataProcessedForCache) {
        return;
    }
    const serializedOutput = ctx.serializeAddon.serialize();
    const termSize: TermSize = { rows: ctx.terminal.rows, cols: ctx.terminal.cols };
    console.log("idle timeout term", ctx.dataBytesProcessed, serializedOutput.length, termSize);
    fireAndForget(() =>
        services.BlockService.SaveTerminalState(ctx.blockId, serializedOutput, "full", ctx.ptyOffset, termSize)
    );
    ctx.dataBytesProcessed = 0;
}

export function runProcessIdleTimeout(ctx: TermDataCtx): void {
    setTimeout(() => {
        window.requestIdleCallback(() => {
            processAndCacheData(ctx);
            runProcessIdleTimeout(ctx);
        });
    }, 5000);
}

function getSessionMeta(ctx: SessionHistoryCtx): { tabBaseDir: string; connection: string; cwd: string; shellType: string; title: string } {
    const tabData = globalStore.get(WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", ctx.tabId)));
    const blockData = globalStore.get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", ctx.blockId)));
    // Build terminal title the same way term-model.ts viewName does
    const termTitle = (blockData?.meta?.["term:title"] as string) ?? "";
    const shellProfile = (blockData?.meta?.["shell:profile"] as string) ?? "";
    let title = termTitle;
    if (!title && shellProfile) {
        const lower = shellProfile.toLowerCase();
        if (lower === "pwsh" || lower === "powershell") title = "PowerShell";
        else if (lower.startsWith("wsl:")) title = shellProfile.substring(4);
        else title = shellProfile;
    }
    return {
        tabBaseDir: (tabData?.meta?.["tab:basedir"] as string) ?? "",
        connection: (blockData?.meta?.connection as string) ?? "",
        cwd: (blockData?.meta?.["cmd:cwd"] as string) ?? "",
        shellType: (blockData?.meta?.["term:shelltype"] as string) ?? "",
        title: title,
    };
}

export function saveSessionSnapshot(ctx: SessionHistoryCtx, reason: string): void {
    if (!ctx.loaded) {
        return;
    }
    if (!shouldSnapshot(ctx.lastSnapshotTime)) {
        return;
    }
    const content = ctx.serializeAddon.serialize();
    if (!shouldCapture(content)) {
        return;
    }
    if (content.length > MAX_CAPTURE_BYTES) {
        console.warn("session history: content too large for snapshot, skipping");
        return;
    }
    ctx.lastSnapshotTime = Date.now();
    const meta = getSessionMeta(ctx);
    fireAndForget(() =>
        services.SessionHistoryService.SaveSnapshotSegment(
            ctx.blockId,
            content,
            ctx.tabId,
            meta.tabBaseDir,
            meta.connection,
            meta.cwd,
            reason,
            meta.shellType,
            meta.title
        )
    );
}

export function saveRollingCapture(ctx: SessionHistoryCtx): void {
    if (!ctx.loaded) {
        return;
    }
    const content = ctx.serializeAddon.serialize();
    if (!shouldCapture(content)) {
        return;
    }
    if (content.length === ctx.lastRollingLength) {
        return;
    }
    if (content.length > MAX_CAPTURE_BYTES) {
        console.warn("session history: content too large for rolling capture, skipping");
        return;
    }
    ctx.lastRollingLength = content.length;
    const meta = getSessionMeta(ctx);
    fireAndForget(() =>
        services.SessionHistoryService.SaveRollingSegment(
            ctx.blockId,
            content,
            ctx.tabId,
            meta.tabBaseDir,
            meta.connection,
            meta.cwd,
            meta.shellType,
            meta.title
        )
    );
}
