
import { describe, expect, it } from "vitest";
import { tabManagementPanelOpenAtom, TabManagementPanel } from "./tab-management-panel";

describe("TabManagementPanel", () => {
    it("should be exported as a named export", () => {
        expect(TabManagementPanel).toBeDefined();
    });

    it("should have a displayName", () => {
        expect(TabManagementPanel.displayName).toBe("TabManagementPanel");
    });

    it("should export the panel open atom", () => {
        expect(tabManagementPanelOpenAtom).toBeDefined();
    });

    it("should have atom with initial value of false", () => {
        expect(tabManagementPanelOpenAtom.init).toBe(false);
    });
});
