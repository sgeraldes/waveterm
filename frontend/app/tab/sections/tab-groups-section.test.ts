
import { describe, expect, it } from "vitest";
import { TabGroupsSection } from "./tab-groups-section";

describe("TabGroupsSection", () => {
    it("should be exported as a named export", () => {
        expect(TabGroupsSection).toBeDefined();
    });

    it("should have a displayName", () => {
        expect(TabGroupsSection.displayName).toBe("TabGroupsSection");
    });
});
