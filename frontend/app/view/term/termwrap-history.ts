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

export async function loadInitialTerminalData(ctx: TermDataCtx): Promise<void> {
    const startTs = Date.now();
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
        `terminal loaded cachefile:${cacheData?.byteLength ?? 0} main:${mainData?.byteLength ?? 0} bytes, ${Date.now() - startTs}ms`
    );
    if (mainFile != null) {
        await ctx.doTerminalWrite(mainData);
    }
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

function getSessionMeta(ctx: SessionHistoryCtx): { tabBaseDir: string; connection: string; cwd: string } {
    const tabData = globalStore.get(WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", ctx.tabId)));
    const blockData = globalStore.get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", ctx.blockId)));
    return {
        tabBaseDir: (tabData?.meta?.["tab:basedir"] as string) ?? "",
        connection: (blockData?.meta?.connection as string) ?? "",
        cwd: (blockData?.meta?.["cmd:cwd"] as string) ?? "",
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
            reason
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
            meta.cwd
        )
    );
}
