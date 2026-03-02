// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import {
    NonRetryableError,
    RetryableError,
    isRetryableHttpStatus,
    parseRetryAfter,
    retryWithBackoff,
} from "./retryutil";

describe("retryutil", () => {
    describe("retryWithBackoff", () => {
        it("should succeed on first attempt", async () => {
            const fn = vi.fn().mockResolvedValue("success");
            const result = await retryWithBackoff(fn);
            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should retry on transient failures", async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error("network timeout"))
                .mockRejectedValueOnce(new Error("connection reset"))
                .mockResolvedValue("success");

            const result = await retryWithBackoff(fn, {
                maxRetries: 3,
                initialDelay: 10,
            });

            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it("should respect maxRetries", async () => {
            const fn = vi.fn().mockRejectedValue(new Error("network error"));

            await expect(
                retryWithBackoff(fn, {
                    maxRetries: 2,
                    initialDelay: 10,
                })
            ).rejects.toThrow("network error");

            expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });

        it("should not retry on NonRetryableError", async () => {
            const fn = vi.fn().mockRejectedValue(new NonRetryableError("auth failed"));

            await expect(
                retryWithBackoff(fn, {
                    maxRetries: 3,
                    initialDelay: 10,
                })
            ).rejects.toThrow("auth failed");

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should always retry on RetryableError", async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new RetryableError("temporary failure"))
                .mockResolvedValue("success");

            const result = await retryWithBackoff(fn, {
                maxRetries: 3,
                initialDelay: 10,
            });

            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it("should call onRetry callback", async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error("network error"))
                .mockResolvedValue("success");

            const onRetry = vi.fn();

            await retryWithBackoff(fn, {
                maxRetries: 3,
                initialDelay: 10,
                onRetry,
            });

            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 10);
        });

        it("should use exponential backoff", async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error("error1"))
                .mockRejectedValueOnce(new Error("error2"))
                .mockResolvedValue("success");

            const onRetry = vi.fn();

            await retryWithBackoff(fn, {
                maxRetries: 3,
                initialDelay: 100,
                backoffMultiplier: 2,
                onRetry,
            });

            expect(onRetry).toHaveBeenCalledTimes(2);
            expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 100);
            expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 200);
        });

        it("should respect maxDelay", async () => {
            const fn = vi
                .fn()
                .mockRejectedValueOnce(new Error("error1"))
                .mockRejectedValueOnce(new Error("error2"))
                .mockResolvedValue("success");

            const onRetry = vi.fn();

            await retryWithBackoff(fn, {
                maxRetries: 3,
                initialDelay: 1000,
                maxDelay: 1500,
                backoffMultiplier: 2,
                onRetry,
            });

            expect(onRetry).toHaveBeenCalledTimes(2);
            expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), 1000);
            expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), 1500); // Capped at maxDelay
        });

        it("should not retry on authentication errors", async () => {
            const fn = vi.fn().mockRejectedValue(new Error("unauthorized access"));

            await expect(
                retryWithBackoff(fn, {
                    maxRetries: 3,
                    initialDelay: 10,
                })
            ).rejects.toThrow("unauthorized");

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it("should retry on rate limit (429)", async () => {
            const error = new Error("Rate limited") as any;
            error.response = { status: 429 };

            const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("success");

            const result = await retryWithBackoff(fn, {
                maxRetries: 3,
                initialDelay: 10,
            });

            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it("should retry on service unavailable (503)", async () => {
            const error = new Error("Service unavailable") as any;
            error.response = { status: 503 };

            const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("success");

            const result = await retryWithBackoff(fn, {
                maxRetries: 3,
                initialDelay: 10,
            });

            expect(result).toBe("success");
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });

    describe("isRetryableHttpStatus", () => {
        it("should return true for 429 (rate limit)", () => {
            expect(isRetryableHttpStatus(429)).toBe(true);
        });

        it("should return true for 503 (service unavailable)", () => {
            expect(isRetryableHttpStatus(503)).toBe(true);
        });

        it("should return true for 504 (gateway timeout)", () => {
            expect(isRetryableHttpStatus(504)).toBe(true);
        });

        it("should return true for 5xx errors", () => {
            expect(isRetryableHttpStatus(500)).toBe(true);
            expect(isRetryableHttpStatus(502)).toBe(true);
        });

        it("should return false for 4xx errors (except rate limit)", () => {
            expect(isRetryableHttpStatus(400)).toBe(false);
            expect(isRetryableHttpStatus(401)).toBe(false);
            expect(isRetryableHttpStatus(403)).toBe(false);
            expect(isRetryableHttpStatus(404)).toBe(false);
        });

        it("should return false for 2xx success codes", () => {
            expect(isRetryableHttpStatus(200)).toBe(false);
            expect(isRetryableHttpStatus(201)).toBe(false);
        });
    });

    describe("parseRetryAfter", () => {
        it("should parse seconds as number", () => {
            expect(parseRetryAfter("60")).toBe(60000);
            expect(parseRetryAfter("120")).toBe(120000);
        });

        it("should parse HTTP date", () => {
            const futureDate = new Date(Date.now() + 60000);
            const result = parseRetryAfter(futureDate.toUTCString());
            expect(result).toBeGreaterThan(59000);
            expect(result).toBeLessThan(61000);
        });

        it("should return null for invalid input", () => {
            expect(parseRetryAfter(undefined)).toBe(null);
            expect(parseRetryAfter("invalid")).toBe(null);
        });

        it("should return 0 for past dates", () => {
            const pastDate = new Date(Date.now() - 60000);
            expect(parseRetryAfter(pastDate.toUTCString())).toBe(0);
        });
    });
});
