
import { describe, expect, it } from "vitest";
import { RecentlyClosedSection } from "./recently-closed-section";

describe("RecentlyClosedSection", () => {
    it("should be exported as a named export", () => {
        expect(RecentlyClosedSection).toBeDefined();
    });

    it("should have a displayName", () => {
        expect(RecentlyClosedSection.displayName).toBe("RecentlyClosedSection");
    });
});
