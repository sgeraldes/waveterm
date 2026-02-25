
import { describe, expect, it } from "vitest";
import { CollapsibleSection } from "./collapsible-section";

describe("CollapsibleSection", () => {
    it("should be exported as a named export", () => {
        expect(CollapsibleSection).toBeDefined();
    });

    it("should have a displayName", () => {
        expect(CollapsibleSection.displayName).toBe("CollapsibleSection");
    });
});
