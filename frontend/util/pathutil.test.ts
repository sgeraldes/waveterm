
import { describe, expect, test } from "vitest";
import { isUncPath, isWslUncPath, windowsToWslPath } from "./pathutil";

describe("isWslUncPath", () => {
    test("detects \\\\wsl.localhost\\ prefix", () => {
        expect(isWslUncPath("\\\\wsl.localhost\\Ubuntu\\home\\user")).toBe(true);
    });

    test("detects \\\\wsl$\\ prefix", () => {
        expect(isWslUncPath("\\\\wsl$\\Ubuntu\\home\\user")).toBe(true);
    });

    test("is case-insensitive", () => {
        expect(isWslUncPath("\\\\WSL.LOCALHOST\\Ubuntu\\home")).toBe(true);
        expect(isWslUncPath("\\\\WSL$\\Ubuntu\\home")).toBe(true);
    });

    test("rejects regular network UNC paths", () => {
        expect(isWslUncPath("\\\\server\\share")).toBe(false);
        expect(isWslUncPath("\\\\192.168.1.1\\share")).toBe(false);
    });

    test("rejects non-UNC paths", () => {
        expect(isWslUncPath("/home/user")).toBe(false);
        expect(isWslUncPath("C:\\Users\\user")).toBe(false);
        expect(isWslUncPath("")).toBe(false);
    });
});

describe("isUncPath - WSL paths are allowed", () => {
    test("WSL localhost path is not a blocked UNC path", () => {
        expect(isUncPath("\\\\wsl.localhost\\Ubuntu\\home\\user")).toBe(false);
    });

    test("WSL dollar path is not a blocked UNC path", () => {
        expect(isUncPath("\\\\wsl$\\Ubuntu\\home\\user")).toBe(false);
    });

    test("regular network UNC path is blocked", () => {
        expect(isUncPath("\\\\server\\share")).toBe(true);
        expect(isUncPath("\\\\192.168.1.1\\share")).toBe(true);
    });

    test("double-slash URL-style path is blocked", () => {
        expect(isUncPath("//server/share")).toBe(true);
    });

    test("non-UNC paths are not blocked", () => {
        expect(isUncPath("/home/user")).toBe(false);
        expect(isUncPath("C:\\Users\\user")).toBe(false);
        expect(isUncPath("")).toBe(false);
    });
});

describe("windowsToWslPath", () => {
    test("converts C: drive path to /mnt/c/", () => {
        expect(windowsToWslPath("C:\\Users\\foo\\bar.png")).toBe("/mnt/c/Users/foo/bar.png");
    });

    test("converts D: drive path to /mnt/d/", () => {
        expect(windowsToWslPath("D:\\some\\path\\file.txt")).toBe("/mnt/d/some/path/file.txt");
    });

    test("handles lowercase drive letter", () => {
        expect(windowsToWslPath("c:\\data\\image.png")).toBe("/mnt/c/data/image.png");
    });

    test("handles paths with spaces", () => {
        expect(windowsToWslPath("C:\\Program Files\\App\\data.txt")).toBe("/mnt/c/Program Files/App/data.txt");
    });

    test("handles typical temp file path", () => {
        expect(windowsToWslPath("C:\\Users\\seb\\AppData\\Local\\Temp\\waveterm-123\\image.png")).toBe(
            "/mnt/c/Users/seb/AppData/Local/Temp/waveterm-123/image.png"
        );
    });

    test("returns null for non-Windows paths", () => {
        expect(windowsToWslPath("/home/user/file.txt")).toBeNull();
        expect(windowsToWslPath("relative/path.txt")).toBeNull();
    });

    test("returns null for empty or invalid input", () => {
        expect(windowsToWslPath("")).toBeNull();
        expect(windowsToWslPath("X")).toBeNull();
    });

    test("handles UNC paths by returning null", () => {
        expect(windowsToWslPath("\\\\server\\share\\file.txt")).toBeNull();
    });
});
