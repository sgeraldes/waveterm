import { describe, expect, it } from "vitest";
import { WaveAIButton } from "./wave-ai-button";

describe("WaveAIButton", () => {
    it("should be exported as a named export", () => {
        expect(WaveAIButton).toBeDefined();
    });

    it("should have a displayName", () => {
        expect(WaveAIButton.displayName).toBe("WaveAIButton");
    });
});
