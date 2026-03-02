// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import {
    allOk,
    chainResult,
    chainResultAsync,
    err,
    getErrValues,
    getOkValues,
    isErr,
    isOk,
    mapResult,
    ok,
    safeAsync,
    safeAsyncError,
    safeSync,
    unwrap,
    unwrapOr,
    type Result,
} from "./resultutil";

describe("Result Type Utilities", () => {
    describe("ok and err constructors", () => {
        it("should create Ok result", () => {
            const result = ok(42);
            expect(result.success).toBe(true);
            if (isOk(result)) {
                expect(result.data).toBe(42);
            }
        });

        it("should create Err result with string", () => {
            const result = err("error message");
            expect(result.success).toBe(false);
            if (isErr(result)) {
                expect(result.error).toBe("error message");
            }
        });

        it("should create Err result with Error object", () => {
            const error = new Error("test error");
            const result = err(error);
            expect(result.success).toBe(false);
            if (isErr(result)) {
                expect(result.error).toBe(error);
            }
        });
    });

    describe("safeAsync", () => {
        it("should return Ok for successful async operation", async () => {
            const result = await safeAsync(async () => {
                return "success";
            });
            expect(result.success).toBe(true);
            if (isOk(result)) {
                expect(result.data).toBe("success");
            }
        });

        it("should return Err for failed async operation", async () => {
            const result = await safeAsync(async () => {
                throw new Error("operation failed");
            });
            expect(result.success).toBe(false);
            if (isErr(result)) {
                expect(result.error).toBe("operation failed");
            }
        });

        it("should handle non-Error throws", async () => {
            const result = await safeAsync(async () => {
                throw "string error";
            });
            expect(result.success).toBe(false);
            if (isErr(result)) {
                expect(result.error).toBe("string error");
            }
        });
    });

    describe("safeAsyncError", () => {
        it("should preserve Error object", async () => {
            const originalError = new Error("test error");
            originalError.stack = "test stack";

            const result = await safeAsyncError(async () => {
                throw originalError;
            });

            expect(result.success).toBe(false);
            if (isErr(result)) {
                expect(result.error).toBe(originalError);
                expect(result.error.stack).toBe("test stack");
            }
        });

        it("should convert non-Error to Error", async () => {
            const result = await safeAsyncError(async () => {
                throw "string error";
            });

            expect(result.success).toBe(false);
            if (isErr(result)) {
                expect(result.error instanceof Error).toBe(true);
                expect(result.error.message).toBe("string error");
            }
        });
    });

    describe("safeSync", () => {
        it("should return Ok for successful sync operation", () => {
            const result = safeSync(() => {
                return JSON.parse('{"key":"value"}');
            });
            expect(result.success).toBe(true);
            if (isOk(result)) {
                expect(result.data).toEqual({ key: "value" });
            }
        });

        it("should return Err for failed sync operation", () => {
            const result = safeSync(() => {
                return JSON.parse("invalid json");
            });
            expect(result.success).toBe(false);
            if (isErr(result)) {
                expect(result.error).toContain("JSON");
            }
        });
    });

    describe("mapResult", () => {
        it("should transform Ok value", () => {
            const result = ok(42);
            const mapped = mapResult(result, (n: number) => n * 2);
            expect(mapped.success).toBe(true);
            if (isOk(mapped)) {
                expect(mapped.data).toBe(84);
            }
        });

        it("should preserve Err", () => {
            const result: Result<number, string> = err("error");
            const mapped = mapResult(result, (n: number) => n * 2);
            expect(mapped.success).toBe(false);
            if (isErr(mapped)) {
                expect(mapped.error).toBe("error");
            }
        });
    });

    describe("chainResult", () => {
        it("should chain Ok results", () => {
            const result1 = ok(42);
            const result2 = chainResult(result1, (n: number) => ok(n * 2));
            expect(result2.success).toBe(true);
            if (isOk(result2)) {
                expect(result2.data).toBe(84);
            }
        });

        it("should stop at first Err", () => {
            const result1: Result<number, string> = err("first error");
            const result2 = chainResult(result1, (n: number) => ok(n * 2));
            expect(result2.success).toBe(false);
            if (isErr(result2)) {
                expect(result2.error).toBe("first error");
            }
        });

        it("should propagate second Err", () => {
            const result1 = ok(42);
            const result2 = chainResult(result1, () => err("second error"));
            expect(result2.success).toBe(false);
            if (isErr(result2)) {
                expect(result2.error).toBe("second error");
            }
        });
    });

    describe("chainResultAsync", () => {
        it("should chain Ok results asynchronously", async () => {
            const result1 = ok(42);
            const result2 = await chainResultAsync(result1, async (n: number) => ok(n * 2));
            expect(result2.success).toBe(true);
            if (isOk(result2)) {
                expect(result2.data).toBe(84);
            }
        });

        it("should stop at first Err", async () => {
            const result1: Result<number, string> = err("first error");
            const result2 = await chainResultAsync(result1, async (n: number) => ok(n * 2));
            expect(result2.success).toBe(false);
            if (isErr(result2)) {
                expect(result2.error).toBe("first error");
            }
        });
    });

    describe("unwrap", () => {
        it("should return data for Ok", () => {
            const result = ok(42);
            expect(unwrap(result)).toBe(42);
        });

        it("should throw for Err", () => {
            const result = err(new Error("test error"));
            expect(() => unwrap(result)).toThrow("test error");
        });
    });

    describe("unwrapOr", () => {
        it("should return data for Ok", () => {
            const result = ok(42);
            expect(unwrapOr(result, 0)).toBe(42);
        });

        it("should return default for Err", () => {
            const result: Result<number, string> = err("error");
            expect(unwrapOr(result, 0)).toBe(0);
        });
    });

    describe("allOk", () => {
        it("should return true for all Ok results", () => {
            const results = [ok(1), ok(2), ok(3)];
            expect(allOk(results)).toBe(true);
        });

        it("should return false if any Err", () => {
            const results: Result<number, string>[] = [ok(1), err("error"), ok(3)];
            expect(allOk(results)).toBe(false);
        });

        it("should return true for empty array", () => {
            expect(allOk([])).toBe(true);
        });
    });

    describe("getOkValues", () => {
        it("should extract all Ok values", () => {
            const results: Result<number, string>[] = [ok(1), err("error"), ok(3), ok(5)];
            expect(getOkValues(results)).toEqual([1, 3, 5]);
        });

        it("should return empty array if no Ok values", () => {
            const results: Result<number, string>[] = [err("error1"), err("error2")];
            expect(getOkValues(results)).toEqual([]);
        });
    });

    describe("getErrValues", () => {
        it("should extract all Err values", () => {
            const results: Result<number, string>[] = [ok(1), err("error1"), ok(3), err("error2")];
            expect(getErrValues(results)).toEqual(["error1", "error2"]);
        });

        it("should return empty array if no Err values", () => {
            const results = [ok(1), ok(2), ok(3)];
            expect(getErrValues(results)).toEqual([]);
        });
    });

    describe("type safety", () => {
        it("should narrow types correctly with success check", () => {
            // Use a function return to keep the union type (prevents TypeScript from
            // narrowing result to Ok<number> at the assignment site)
            const makeResult = (succeed: boolean): Result<number, string> =>
                succeed ? ok(42) : err("error");
            const result = makeResult(true);

            if (isOk(result)) {
                // TypeScript should know result.data exists and is number
                const doubled: number = result.data * 2;
                expect(doubled).toBe(84);
            } else if (isErr(result)) {
                // TypeScript should know result.error exists and is string
                const errorLength: number = result.error.length;
                expect(errorLength).toBeGreaterThan(0);
            }
        });

        it("should work with complex types", () => {
            interface User {
                id: number;
                name: string;
            }

            const result: Result<User, string> = ok({ id: 1, name: "Alice" });

            if (isOk(result)) {
                expect(result.data.id).toBe(1);
                expect(result.data.name).toBe("Alice");
            }
        });
    });
});
