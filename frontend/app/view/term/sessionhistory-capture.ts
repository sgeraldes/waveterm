/** Minimum serialized content length to bother saving (skip empty terminals). */
export const MIN_CAPTURE_BYTES = 100;

/** Minimum milliseconds between consecutive snapshot saves to prevent spam. */
export const SNAPSHOT_DEBOUNCE_MS = 10000;

/** Maximum serialized content size to save (5MB). */
export const MAX_CAPTURE_BYTES = 5 * 1024 * 1024;

/** Rolling capture interval in milliseconds (30 seconds). */
export const ROLLING_INTERVAL_MS = 30000;

/**
 * Returns true if the serialized terminal content is large enough to be worth saving.
 */
export function shouldCapture(content: string): boolean {
    return content.length >= MIN_CAPTURE_BYTES;
}

/**
 * Returns true if enough time has passed since the last snapshot to allow a new one.
 * @param lastSnapshotTime - millisecond timestamp of the last snapshot (0 = never)
 */
export function shouldSnapshot(lastSnapshotTime: number): boolean {
    if (lastSnapshotTime === 0) {
        return true;
    }
    return Date.now() - lastSnapshotTime >= SNAPSHOT_DEBOUNCE_MS;
}
