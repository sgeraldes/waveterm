import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { isWslUncPath } from "@/util/pathutil";
import { fireAndForget } from "@/util/util";
import { globalStore } from "./jotaiStore";
import { ObjectService } from "./services";
import * as WOS from "./wos";

export type StalePathReason = "not_found" | "not_directory" | "access_denied" | "network_error" | "unknown_error";

export interface PathValidationResult {
    valid: boolean;
    path: string;
    reason?: StalePathReason;
    fileInfo?: FileInfo;
}

interface RetryConfig {
    maxAttempts: number;
    timeoutPerAttempt: number;
    delayBetweenRetries: number;
    totalWindow: number;
}

const defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    timeoutPerAttempt: 10000,
    delayBetweenRetries: 1000,
    totalWindow: 30000,
};

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyError(error: unknown): StalePathReason {
    const errorStr = String((error as Error)?.message || error || "").toLowerCase();

    if (errorStr.includes("enoent") || errorStr.includes("not found") || errorStr.includes("no such file")) {
        return "not_found";
    }

    if (errorStr.includes("eacces") || errorStr.includes("permission denied") || errorStr.includes("access denied")) {
        return "access_denied";
    }

    if (
        errorStr.includes("etimedout") ||
        errorStr.includes("timeout") ||
        errorStr.includes("econnrefused") ||
        errorStr.includes("ehostunreach") ||
        errorStr.includes("enetunreach") ||
        errorStr.includes("network")
    ) {
        return "network_error";
    }

    return "unknown_error";
}

function isNetworkPath(path: string): boolean {
    if (!path) return false;

    if (isWslUncPath(path)) {
        return false;
    }

    if (path.startsWith("\\\\") || path.startsWith("//")) {
        return true;
    }

    // SMB/CIFS: smb:// or cifs://
    if (path.startsWith("smb://") || path.startsWith("cifs://")) {
        return true;
    }

    // Match protocol-like prefixes (smb://, nfs://, etc.) but NOT single-letter Windows drive paths
    if (/^[a-zA-Z]{2,}:/.test(path)) {
        return true;
    }

    return false;
}

// Validate path with timeout
async function validatePathWithTimeout(basedir: string, timeout: number): Promise<PathValidationResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("ETIMEDOUT")), timeout);
    });

    try {
        const validationPromise = RpcApi.FileInfoCommand(TabRpcClient, { info: { path: basedir } }, null);
        const fileInfo = await Promise.race([validationPromise, timeoutPromise]);

        if (fileInfo.notfound) {
            return { valid: false, path: basedir, reason: "not_found" };
        }

        if (!fileInfo.isdir) {
            return { valid: false, path: basedir, reason: "not_directory" };
        }

        return { valid: true, path: basedir, fileInfo };
    } catch (error) {
        const reason = classifyError(error);
        return { valid: false, path: basedir, reason };
    }
}

async function validateWslPathWithTimeout(
    distro: string,
    linuxPath: string,
    timeout: number
): Promise<PathValidationResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("ETIMEDOUT")), timeout);
    });

    try {
        const validationPromise = RpcApi.WslPathStatCommand(TabRpcClient, { distro, path: linuxPath });
        const statResult = await Promise.race([validationPromise, timeoutPromise]);

        if (!statResult.exists) {
            return { valid: false, path: linuxPath, reason: "not_found" };
        }

        if (!statResult.isdir) {
            return { valid: false, path: linuxPath, reason: "not_directory" };
        }

        return { valid: true, path: linuxPath };
    } catch (error) {
        const reason = classifyError(error);
        return { valid: false, path: linuxPath, reason };
    }
}

async function validateWithNetworkRetry(
    basedir: string,
    config: RetryConfig = defaultRetryConfig
): Promise<PathValidationResult> {
    let lastError: StalePathReason | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
            const result = await validatePathWithTimeout(basedir, config.timeoutPerAttempt);

            if (result.valid) {
                return result;
            }

            if (result.reason !== "network_error") {
                return result;
            }

            lastError = result.reason;

            if (attempt < config.maxAttempts) {
                await sleep(config.delayBetweenRetries);
            }
        } catch (error) {
            lastError = classifyError(error);

            if (lastError !== "network_error" || attempt === config.maxAttempts) {
                return { valid: false, path: basedir, reason: lastError };
            }

            await sleep(config.delayBetweenRetries);
        }
    }

    return { valid: false, path: basedir, reason: "network_error" };
}

// Main validation function
export async function validateTabBasedir(tabId: string, basedir: string): Promise<PathValidationResult> {
    if (!basedir || basedir.trim() === "") {
        return { valid: true, path: basedir };
    }

    const tabAtom = WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", tabId));
    const tabData = globalStore.get(tabAtom);
    const wslDistro = tabData?.meta?.["tab:wsldistro"] as string | undefined;

    if (wslDistro) {
        return await validateWslPathWithTimeout(wslDistro, basedir, 5000);
    }

    const isNetwork = isNetworkPath(basedir);

    if (isNetwork) {
        return await validateWithNetworkRetry(basedir);
    } else {
        return await validatePathWithTimeout(basedir, 5000);
    }
}

function getReasonMessage(reason: StalePathReason, path: string): string {
    switch (reason) {
        case "not_found":
            return `Path no longer valid (not found): ${path}`;
        case "not_directory":
            return `Path is no longer a directory: ${path}`;
        case "access_denied":
            return `Cannot access directory (permission denied): ${path}`;
        case "network_error":
            return `Cannot reach network path (after retries): ${path}`;
        case "unknown_error":
            return `Path no longer accessible: ${path}`;
        default:
            return `Path validation failed: ${path}`;
    }
}

// Clear stale path and notify user
export async function handleStaleBasedir(tabId: string, path: string, reason: StalePathReason): Promise<void> {
    const tabORef = WOS.makeORef("tab", tabId);

    try {
        // Don't clear for transient errors — directory may be temporarily unreachable
        if (reason === "access_denied" || reason === "network_error") {
            const { pushNotification } = await import("./global");
            pushNotification({
                id: `stale-basedir-${tabId}`,
                icon: "triangle-exclamation",
                type: "warning",
                title: "Tab base directory inaccessible",
                message: getReasonMessage(reason, path),
                timestamp: new Date().toISOString(),
                expiration: Date.now() + 10000,
                persistent: false,
            });
            console.log(`[TabBasedir] Inaccessible basedir for tab ${tabId}: ${path} (${reason}) - not clearing`);
            return;
        }
        // Only clear for permanent failures (not_found, not_directory, unknown_error)
        // Preserve tab:basedirlock — the user set it intentionally
        await ObjectService.UpdateObjectMeta(tabORef, {
            "tab:basedir": null,
        });

        const { pushNotification } = await import("./global");
        pushNotification({
            id: `stale-basedir-${tabId}`,
            icon: "triangle-exclamation",
            type: "warning",
            title: "Tab base directory cleared",
            message: getReasonMessage(reason, path),
            timestamp: new Date().toISOString(),
            expiration: Date.now() + 10000,
            persistent: false,
        });

        console.log(`[TabBasedir] Cleared stale basedir for tab ${tabId}: ${path} (${reason})`);
    } catch (error) {
        console.error(`[TabBasedir] Failed to clear stale basedir for tab ${tabId}:`, error);
    }
}

export async function handleMultipleStaleBasedirs(
    staleTabs: Array<{ tabId: string; path: string; reason: StalePathReason }>
): Promise<void> {
    if (staleTabs.length === 0) return;

    // Preserve tab:basedirlock — the user set it intentionally
    const clearPromises = staleTabs.map(({ tabId }) => {
        const tabORef = WOS.makeORef("tab", tabId);
        return ObjectService.UpdateObjectMeta(tabORef, {
            "tab:basedir": null,
        });
    });

    try {
        await Promise.all(clearPromises);

        const { pushNotification } = await import("./global");
        pushNotification({
            id: "stale-basedir-batch",
            icon: "triangle-exclamation",
            type: "warning",
            title: `Cleared base directory for ${staleTabs.length} tabs`,
            message: "Multiple tabs had stale paths. See logs for details.",
            timestamp: new Date().toISOString(),
            expiration: Date.now() + 15000,
            persistent: false,
        });

        staleTabs.forEach(({ tabId, path, reason }) => {
            console.log(`[TabBasedir] Cleared stale basedir for tab ${tabId}: ${path} (${reason})`);
        });
    } catch (error) {
        console.error("[TabBasedir] Failed to clear multiple stale basedirs:", error);
    }
}

interface BatchingState {
    staleTabs: Array<{ tabId: string; path: string; reason: StalePathReason }>;
    timer: NodeJS.Timeout | null;
}

const batchingState: BatchingState = {
    staleTabs: [],
    timer: null,
};

const BATCHING_WINDOW_MS = 5000;
const BATCH_THRESHOLD = 4;

export async function validateAndHandleStale(tabId: string): Promise<void> {
    const tabAtom = WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", tabId));
    const tabData = globalStore.get(tabAtom);

    if (!tabData) {
        return;
    }

    const basedir = tabData.meta?.["tab:basedir"];

    if (!basedir || basedir.trim() === "") {
        return;
    }

    const result = await validateTabBasedir(tabId, basedir);

    if (!result.valid && result.reason) {
        batchingState.staleTabs.push({ tabId, path: basedir, reason: result.reason });

        if (batchingState.timer) {
            clearTimeout(batchingState.timer);
        }

        batchingState.timer = setTimeout(() => {
            const staleTabs = [...batchingState.staleTabs];
            batchingState.staleTabs = [];
            batchingState.timer = null;

            if (staleTabs.length >= BATCH_THRESHOLD) {
                fireAndForget(() => handleMultipleStaleBasedirs(staleTabs));
            } else {
                staleTabs.forEach(({ tabId, path, reason }) => {
                    fireAndForget(() => handleStaleBasedir(tabId, path, reason));
                });
            }
        }, BATCHING_WINDOW_MS);
    }
}
