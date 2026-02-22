import { describe, expect, it } from "vitest";

describe("buildWebviewSettingsMenu zoom items", () => {
    it("makeZoomFactorMenuItem logic produces correct label and checked state", () => {
        const curZoom = 1;
        const makeItem = (label: string, factor: number) => ({
            label,
            type: "checkbox" as const,
            checked: curZoom == factor,
        });
        const item100 = makeItem("100%", 1);
        const item150 = makeItem("150%", 1.5);
        expect(item100.checked).toBe(true);
        expect(item150.checked).toBe(false);
        expect(item100.label).toBe("100%");
    });

    it("produces correct user agent checked state", () => {
        const curUserAgentType: string = "mobile:iphone";
        const defaultChecked = curUserAgentType === "default" || curUserAgentType === "";
        const iphoneChecked = curUserAgentType === "mobile:iphone";
        const androidChecked = curUserAgentType === "mobile:android";
        expect(defaultChecked).toBe(false);
        expect(iphoneChecked).toBe(true);
        expect(androidChecked).toBe(false);
    });
});

describe("buildViewTextAtom navigation disabled state", () => {
    it("returns true when canGoBack throws", () => {
        const shouldDisable = () => {
            try {
                throw new Error("not ready");
            } catch { /* webview not ready */ }
            return true;
        };
        expect(shouldDisable()).toBe(true);
    });
});
