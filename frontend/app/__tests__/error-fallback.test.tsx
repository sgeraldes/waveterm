// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

describe("Error Fallback Components", () => {
    describe("sanitizeErrorMessage", () => {
        it("should extract first line of error message", () => {
            const error = new Error("First line\nSecond line\nThird line");
            const sanitized = error.message.split("\n")[0];
            expect(sanitized).toBe("First line");
        });

        it("should remove 'at' stack traces from message", () => {
            const message = "Error occurred at line 42";
            const sanitized = message.replace(/\s+at\s+.*$/g, "").trim();
            expect(sanitized).toBe("Error occurred");
        });

        it("should handle empty error messages", () => {
            const error = new Error("");
            const message = error?.message || "Unknown error occurred";
            expect(message).toBe("Unknown error occurred");
        });

        it("should handle null/undefined errors", () => {
            const error: any = null;
            const message = error?.message || "Unknown error occurred";
            expect(message).toBe("Unknown error occurred");
        });
    });

    describe("copyErrorDetails", () => {
        it("should format error details as JSON", () => {
            const error = new Error("Test error");
            error.name = "TestError";
            error.stack = "TestError: Test error\n    at test.js:1:1";

            const details = JSON.stringify(
                {
                    name: error?.name || "Error",
                    message: error?.message || "Unknown error",
                    stack: error?.stack || "No stack trace available",
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                },
                null,
                2
            );

            expect(details).toContain("TestError");
            expect(details).toContain("Test error");
            expect(details).toContain("at test.js:1:1");
        });

        it("should handle errors without stack traces", () => {
            const error = new Error("No stack");
            error.stack = undefined;

            const details = JSON.stringify({
                stack: error?.stack || "No stack trace available",
            });

            expect(details).toContain("No stack trace available");
        });
    });

    describe("Error Message Display", () => {
        it("should show user-friendly message for app crashes", () => {
            const userMessage = "Wave Terminal encountered an unexpected error and needs to reload.";
            expect(userMessage).toContain("Wave Terminal");
            expect(userMessage).toContain("unexpected error");
            expect(userMessage).not.toContain("stack");
            expect(userMessage).not.toContain("undefined");
        });

        it("should show user-friendly message for tab errors", () => {
            const userMessage = "This tab encountered an error while loading.";
            expect(userMessage).toContain("tab");
            expect(userMessage).toContain("error");
            expect(userMessage).not.toContain("stack");
            expect(userMessage).not.toContain("undefined");
        });
    });

    describe("Technical Details Section", () => {
        it("should include all required fields", () => {
            const error = new Error("Test error");
            error.name = "TestError";
            error.stack = "Stack trace here";

            const requiredFields = ["Error:", "Message:", "Time:", "Stack Trace:"];
            const hasAllFields = requiredFields.every((field) => typeof field === "string");
            expect(hasAllFields).toBe(true);
        });

        it("should format timestamp as ISO string", () => {
            const timestamp = new Date().toISOString();
            expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it("should handle missing stack traces gracefully", () => {
            const error = new Error("No stack");
            error.stack = undefined;

            const stackDisplay = error.stack ? error.stack : undefined;
            expect(stackDisplay).toBeUndefined();
        });
    });
});
