import { describe, expect, it } from "vitest";
import { strArrayIsEqual } from "./use-tab-drag";

describe("strArrayIsEqual", () => {
    it("should return true for two null arrays", () => {
        expect(strArrayIsEqual(null, null)).toBe(true);
    });

    it("should return false when one array is null", () => {
        expect(strArrayIsEqual(null, ["a"])).toBe(false);
        expect(strArrayIsEqual(["a"], null)).toBe(false);
    });

    it("should return false for arrays of different length", () => {
        expect(strArrayIsEqual(["a"], ["a", "b"])).toBe(false);
    });

    it("should return true for identical arrays", () => {
        expect(strArrayIsEqual(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
    });

    it("should return false for arrays with different elements", () => {
        expect(strArrayIsEqual(["a", "b"], ["a", "c"])).toBe(false);
    });

    it("should return true for empty arrays", () => {
        expect(strArrayIsEqual([], [])).toBe(true);
    });
});
