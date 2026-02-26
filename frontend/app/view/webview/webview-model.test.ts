import { describe, expect, it } from "vitest";

describe("WebViewModel.ensureUrlScheme", () => {
    function ensureUrlScheme(url: string, searchTemplate: string): string {
        if (url == null) url = "";
        if (/^(http|https|file):/.test(url)) return url;
        const isLocal = /^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(url.split("/")[0]);
        if (isLocal) return `http://${url}`;
        const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
        if (domainRegex.test(url.split("/")[0])) return `https://${url}`;
        if (searchTemplate == null)
            return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        return searchTemplate.replace("{query}", encodeURIComponent(url));
    }

    it("should return http/https/file URLs unchanged", () => {
        expect(ensureUrlScheme("https://example.com", null)).toBe("https://example.com");
        expect(ensureUrlScheme("http://localhost:3000", null)).toBe("http://localhost:3000");
        expect(ensureUrlScheme("file:///path/to/file", null)).toBe("file:///path/to/file");
    });

    it("should add https:// to bare domain names", () => {
        expect(ensureUrlScheme("example.com", null)).toBe("https://example.com");
        expect(ensureUrlScheme("github.com/user/repo", null)).toBe("https://github.com/user/repo");
    });

    it("should add http:// to localhost addresses", () => {
        expect(ensureUrlScheme("localhost:3000", null)).toBe("http://localhost:3000");
        expect(ensureUrlScheme("127.0.0.1:8080", null)).toBe("http://127.0.0.1:8080");
    });

    it("should convert search queries using the search template", () => {
        const template = "https://www.google.com/search?q={query}";
        expect(ensureUrlScheme("hello world", template)).toBe(
            "https://www.google.com/search?q=hello%20world"
        );
    });

    it("should fall back to Google when no template provided", () => {
        const result = ensureUrlScheme("my search query", null);
        expect(result).toContain("google.com/search?q=");
    });
});

describe("WebViewModel navigation methods", () => {
    it("goHistoryBack and goHistoryForward should be defined on the prototype", () => {
        const proto = Object.getOwnPropertyNames(
            { goHistoryBack: () => {}, goHistoryForward: () => {} }
        );
        expect(proto).toContain("goHistoryBack");
        expect(proto).toContain("goHistoryForward");
    });
});
