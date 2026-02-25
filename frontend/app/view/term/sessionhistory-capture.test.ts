import { describe, expect, it } from "vitest";
import { MIN_CAPTURE_BYTES, SNAPSHOT_DEBOUNCE_MS, shouldCapture, shouldSnapshot } from "./sessionhistory-capture";

describe("shouldCapture", () => {
    it("returns false for empty string", () => {
        expect(shouldCapture("")).toBe(false);
    });

    it("returns false when content is below threshold", () => {
        expect(shouldCapture("x".repeat(MIN_CAPTURE_BYTES - 1))).toBe(false);
    });

    it("returns true when content meets threshold exactly", () => {
        expect(shouldCapture("x".repeat(MIN_CAPTURE_BYTES))).toBe(true);
    });

    it("returns true when content exceeds threshold", () => {
        expect(shouldCapture("x".repeat(MIN_CAPTURE_BYTES + 500))).toBe(true);
    });
});

describe("shouldSnapshot", () => {
    it("returns true when lastSnapshotTime is 0 (never snapped)", () => {
        expect(shouldSnapshot(0)).toBe(true);
    });

    it("returns true when enough time has passed since last snapshot", () => {
        const longAgo = Date.now() - SNAPSHOT_DEBOUNCE_MS - 1;
        expect(shouldSnapshot(longAgo)).toBe(true);
    });

    it("returns false when called too soon after last snapshot", () => {
        const justNow = Date.now();
        expect(shouldSnapshot(justNow)).toBe(false);
    });

    it("returns true when exactly at the debounce threshold", () => {
        const atThreshold = Date.now() - SNAPSHOT_DEBOUNCE_MS;
        expect(shouldSnapshot(atThreshold)).toBe(true);
    });
});
