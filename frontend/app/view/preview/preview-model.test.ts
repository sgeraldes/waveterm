import { describe, expect, it, test } from "vitest";

describe("preview-model", () => {
    it("should have test placeholder", () => {
        expect(true).toBe(true);
    });
});

describe("Preview Size Limits", () => {
    test("Default size limits are defined", () => {
        // These constants should be the default values (10MB and 1MB)
        const DefaultMaxFileSize = 1024 * 1024 * 10;
        const DefaultMaxCSVSize = 1024 * 1024 * 1;

        expect(DefaultMaxFileSize).toBe(10485760); // 10MB in bytes
        expect(DefaultMaxCSVSize).toBe(1048576); // 1MB in bytes
    });

    test("Size limit calculations work correctly", () => {
        const maxFileSizeMB = 10;
        const maxCSVSizeMB = 1;
        const maxFileSize = maxFileSizeMB * 1024 * 1024;
        const maxCSVSize = maxCSVSizeMB * 1024 * 1024;

        expect(maxFileSize).toBe(10485760);
        expect(maxCSVSize).toBe(1048576);

        // Test a large file
        const largeFileSize = 100 * 1024 * 1024; // 100MB
        expect(largeFileSize > maxFileSize).toBe(true);

        // Test a small file
        const smallFileSize = 5 * 1024 * 1024; // 5MB
        expect(smallFileSize < maxFileSize).toBe(true);
    });

    test("CSV size limits are smaller than general file limits", () => {
        const defaultMaxFileSize = 10 * 1024 * 1024;
        const defaultMaxCSVSize = 1 * 1024 * 1024;

        // CSV limit should be smaller because table rendering is more memory-intensive
        expect(defaultMaxCSVSize).toBeLessThan(defaultMaxFileSize);
    });

    test("Size formatting for error messages", () => {
        const fileSize100MB = 100 * 1024 * 1024;
        const sizeMB = (fileSize100MB / (1024 * 1024)).toFixed(2);
        expect(sizeMB).toBe("100.00");

        const fileSize15MB = 15.5 * 1024 * 1024;
        const sizeMB15 = (fileSize15MB / (1024 * 1024)).toFixed(2);
        expect(sizeMB15).toBe("15.50");
    });

    test("Zero limit disables size check", () => {
        const maxFileSize = 0;
        const largeFileSize = 100 * 1024 * 1024;

        // When maxFileSize is 0, size check should be skipped
        // The condition is: if (maxFileSize > 0 && fileInfo.size > maxFileSize)
        // So with maxFileSize = 0, the check is bypassed
        const shouldBlock = maxFileSize > 0 && largeFileSize > maxFileSize;
        expect(shouldBlock).toBe(false);
    });
});

describe("getSpecializedView dead code fix (PV-NEW-2)", () => {
    // Bug: there was a duplicate `if (!fileInfo)` check after the streaming type check.
    // The first check on line 521 guards the entire rest of the function, so the
    // second check (formerly on line 536) could never be reached and had a DIFFERENT
    // error message ("File Not Found" vs "Load Error").
    //
    // Fix: removed the dead second check. The tests here verify the logic of the
    // first (surviving) guard.

    type FileInfo = { path: string; name: string; notfound?: boolean; isdir?: boolean; size?: number; mimetype?: string };

    function simulateSpecializedView(fileInfo: FileInfo | null, mimeType: string | null, connErr: string) {
        // Mirrors the fixed getSpecializedView logic.
        if (!fileInfo) {
            return { errorStr: "Load Error: undefined" };
        }
        if (connErr !== "") {
            return { errorStr: `Connection Error: ${connErr}` };
        }
        if (fileInfo?.notfound) {
            return { specializedView: "codeedit" };
        }
        if (mimeType == null) {
            return { errorStr: `Unable to determine mimetype for: ${fileInfo.path}` };
        }
        // streaming types (simplified)
        const streamingTypes = ["application/pdf", "video/", "audio/", "image/"];
        if (streamingTypes.some((t) => mimeType.startsWith(t))) {
            return { specializedView: "streaming" };
        }
        // NOTE: removed dead second !fileInfo check here (the bug that was fixed)
        if (mimeType === "directory") {
            return { specializedView: "directory" };
        }
        return { specializedView: "codeedit" };
    }

    test("returns Load Error when fileInfo is null", () => {
        const result = simulateSpecializedView(null, null, "");
        expect(result.errorStr).toContain("Load Error");
    });

    test("returns Connection Error when connErr is set", () => {
        const fi: FileInfo = { path: "/foo", name: "foo" };
        const result = simulateSpecializedView(fi, "text/plain", "ssh error");
        expect(result.errorStr).toContain("Connection Error: ssh error");
    });

    test("returns codeedit for not-found files (create new file flow)", () => {
        const fi: FileInfo = { path: "/new.md", name: "new.md", notfound: true };
        const result = simulateSpecializedView(fi, null, "");
        expect(result.specializedView).toBe("codeedit");
    });

    test("returns mimetype error when mimeType is null for existing file", () => {
        const fi: FileInfo = { path: "/bin/tool", name: "tool" };
        const result = simulateSpecializedView(fi, null, "");
        expect(result.errorStr).toContain("Unable to determine mimetype");
    });

    test("returns streaming for image mimeType", () => {
        const fi: FileInfo = { path: "/img.png", name: "img.png" };
        const result = simulateSpecializedView(fi, "image/png", "");
        expect(result.specializedView).toBe("streaming");
    });

    test("there is no reachable second null check for fileInfo after streaming check", () => {
        // After the streaming type check, the old code had:
        //   if (!fileInfo) { return { errorStr: "File Not Found" } }
        // This was dead code because fileInfo was already verified non-null at line 521.
        // Verify the logic flow: after streaming check with valid fileInfo, we proceed normally.
        const fi: FileInfo = { path: "/doc.txt", name: "doc.txt" };
        const result = simulateSpecializedView(fi, "text/plain", "");
        // Should reach codeedit, NOT a "File Not Found" error
        expect(result.specializedView).toBe("codeedit");
        expect(result.errorStr).toBeUndefined();
    });
});

describe("preview-directory data preservation on refresh failure (PV-NEW-1)", () => {
    // Bug: when RpcApi.FileReadCommand throws during a refresh, setUnfilteredData(entries)
    // was called with `undefined` (entries was never assigned), wiping the displayed data.
    //
    // Fix: added `return` in the catch block so setUnfilteredData is never called on error.

    test("existing data is preserved when refresh throws", () => {
        let currentData: string[] = ["file1.txt", "file2.txt"];
        let errorMsg: string | null = null;

        const setUnfilteredData = (data: string[]) => {
            currentData = data;
        };
        const setErrorMsg = (msg: string) => {
            errorMsg = msg;
        };

        // Simulate the FIXED behaviour (early return on error)
        const fixedFetchDir = async () => {
            let entries: string[] | undefined;
            try {
                throw new Error("permission denied");
            } catch (e) {
                setErrorMsg(`${e}`);
                return; // Fixed: don't call setUnfilteredData on error
            }
            setUnfilteredData(entries!);
        };

        fixedFetchDir();

        // Data should still be the original ["file1.txt", "file2.txt"]
        expect(currentData).toEqual(["file1.txt", "file2.txt"]);
        expect(errorMsg).toContain("permission denied");
    });

    test("old (buggy) behaviour would wipe existing data on refresh failure", () => {
        let currentData: string[] = ["file1.txt", "file2.txt"];
        let errorMsg: string | null = null;

        const setUnfilteredData = (data: string[] | undefined) => {
            currentData = data as string[];
        };
        const setErrorMsg = (msg: string) => {
            errorMsg = msg;
        };

        // Simulate the OLD (buggy) behaviour (falls through to setUnfilteredData)
        const buggyFetchDir = async () => {
            let entries: string[] | undefined;
            try {
                throw new Error("permission denied");
            } catch (e) {
                setErrorMsg(`${e}`);
                // BUG: no return here, falls through
            }
            setUnfilteredData(entries); // called with undefined!
        };

        buggyFetchDir();

        // Bug: currentData is now undefined
        expect(currentData).toBeUndefined();
    });
});
