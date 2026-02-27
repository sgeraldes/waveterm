// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { TabBar } from "./tabbar";

describe("TabBar", () => {
    it("should be exported as a named export", () => {
        expect(TabBar).toBeDefined();
    });
});
