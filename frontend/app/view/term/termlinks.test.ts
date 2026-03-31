// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FILE_PATH_REGEX, evictCache, pathCache, probeFileExists } from "./termlinks";

// ---------------------------------------------------------------------------
// FILE_PATH_REGEX — matching
// ---------------------------------------------------------------------------

describe("FILE_PATH_REGEX — should match", () => {
    function findMatches(line: string): string[] {
        FILE_PATH_REGEX.lastIndex = 0;
        const paths: string[] = [];
        for (const m of line.matchAll(FILE_PATH_REGEX)) {
            paths.push(m[1]);
        }
        return paths;
    }

    it("matches a Unix absolute path at the start of a line", () => {
        expect(findMatches("/home/user/file.txt")).toContain("/home/user/file.txt");
    });

    it("matches a Unix absolute path after whitespace", () => {
        const paths = findMatches("Error in /var/app/main.go:42");
        expect(paths).toContain("/var/app/main.go");
    });

    it("matches a relative path starting with ./", () => {
        expect(findMatches("./src/index.ts")).toContain("./src/index.ts");
    });

    it("matches a relative path starting with ../", () => {
        expect(findMatches("../lib/util.go")).toContain("../lib/util.go");
    });

    it("matches a Windows drive-letter path with backslashes", () => {
        const paths = findMatches("C:\\Users\\foo\\bar.txt");
        expect(paths).toContain("C:\\Users\\foo\\bar.txt");
    });

    it("matches a Windows drive-letter path with forward slashes", () => {
        const paths = findMatches("C:/Users/foo/bar.txt");
        expect(paths).toContain("C:/Users/foo/bar.txt");
    });

    it("captures line number from :line suffix", () => {
        FILE_PATH_REGEX.lastIndex = 0;
        const results = [..."/home/user/app.ts:99".matchAll(FILE_PATH_REGEX)];
        expect(results[0]?.[2]).toBe("99");
    });

    it("captures line and column from :line:col suffix", () => {
        FILE_PATH_REGEX.lastIndex = 0;
        const results = [..."/home/user/app.ts:42:7".matchAll(FILE_PATH_REGEX)];
        expect(results[0]?.[2]).toBe("42");
        expect(results[0]?.[3]).toBe("7");
    });

    it("matches multiple paths on a single line", () => {
        const paths = findMatches("/foo/bar.ts and /baz/qux.ts");
        expect(paths).toContain("/foo/bar.ts");
        expect(paths).toContain("/baz/qux.ts");
    });

    it("matches path inside parentheses", () => {
        const paths = findMatches("(see /docs/guide.md for details)");
        expect(paths).toContain("/docs/guide.md");
    });

    it("matches path with a dot in the filename", () => {
        expect(findMatches("/etc/hosts")).toContain("/etc/hosts");
    });

    it("matches deep Windows path", () => {
        const paths = findMatches("D:\\projects\\wave\\main.go");
        expect(paths).toContain("D:\\projects\\wave\\main.go");
    });
});

// ---------------------------------------------------------------------------
// FILE_PATH_REGEX — non-matching
// ---------------------------------------------------------------------------

describe("FILE_PATH_REGEX — should NOT match", () => {
    function hasMatch(line: string): boolean {
        FILE_PATH_REGEX.lastIndex = 0;
        return [...line.matchAll(FILE_PATH_REGEX)].length > 0;
    }

    it("does not match http URLs", () => {
        expect(hasMatch("https://example.com/path")).toBe(false);
    });

    it("does not match bare words without a path prefix", () => {
        expect(hasMatch("hello world")).toBe(false);
    });

    it("does not match a single bare word", () => {
        expect(hasMatch("filename")).toBe(false);
    });

    it("does not match an email address", () => {
        expect(hasMatch("user@example.com")).toBe(false);
    });

    it("does not match a number followed by a colon (port)", () => {
        expect(hasMatch("localhost:8080")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// LRU cache — eviction and TTL
// ---------------------------------------------------------------------------

describe("pathCache — eviction and TTL", () => {
    beforeEach(() => {
        pathCache.clear();
    });

    afterEach(() => {
        pathCache.clear();
        vi.useRealTimers();
    });

    it("caches an entry and returns it before TTL expires", () => {
        vi.useFakeTimers();
        const now = Date.now();
        pathCache.set("/some/path", { exists: true, time: now });
        expect(pathCache.get("/some/path")?.exists).toBe(true);
    });

    it("evictCache removes entries past TTL", () => {
        vi.useFakeTimers();
        const oldTime = Date.now() - 11_000; // 11s ago, past 10s TTL
        pathCache.set("/old/path", { exists: true, time: oldTime });
        pathCache.set("/new/path", { exists: false, time: Date.now() });

        evictCache();

        expect(pathCache.has("/old/path")).toBe(false);
        expect(pathCache.has("/new/path")).toBe(true);
    });

    it("evictCache removes oldest entries when over CACHE_MAX_SIZE", () => {
        // Fill cache with 200 entries (at the limit).
        for (let i = 0; i < 200; i++) {
            pathCache.set(`/path/${i}`, { exists: true, time: Date.now() });
        }
        // Add one more to trigger eviction on next evictCache call.
        pathCache.set("/path/overflow", { exists: true, time: Date.now() });

        evictCache(); // no TTL evictions (all fresh), but size > 200

        expect(pathCache.size).toBeLessThanOrEqual(200);
        // The first-inserted key should have been removed.
        expect(pathCache.has("/path/0")).toBe(false);
        // The overflow entry should still be there.
        expect(pathCache.has("/path/overflow")).toBe(true);
    });

    it("returns cached result without calling RpcApi again within TTL", async () => {
        // Seed the cache manually so probeFileExists returns the cached value
        // without making any RPC call.
        pathCache.set("/cached/path", { exists: true, time: Date.now() });

        // probeFileExists should read from the cache and not throw even though
        // RpcApi is not mocked here.
        const result = await probeFileExists("/cached/path", null);
        expect(result).toBe(true);
    });

    it("does not cache errors from probeFileExists", async () => {
        // RpcApi is not available in the test environment; probeFileExists
        // should return false on error and leave the cache empty.
        const result = await probeFileExists("/nonexistent/path", null);
        expect(result).toBe(false);
        expect(pathCache.has("/nonexistent/path")).toBe(false);
    });
});
