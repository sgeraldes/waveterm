/**
 * Path validation utilities for sanitizing untrusted paths from terminal output.
 * Provides defense against path traversal, injection, and other security attacks.
 *
 * Security checks performed:
 * - Null byte detection (prevents path truncation attacks)
 * - Path traversal pattern detection (../ sequences)
 * - UNC path blocking on Windows (prevents network data exfiltration)
 * - Windows device name blocking (CON, NUL, AUX, etc.)
 * - Length limit enforcement (prevents DoS via long paths)
 * - Blocked sensitive directory detection
 */

import { PLATFORM, PlatformWindows } from "@/util/platformutil";

const MAX_PATH_LENGTH = 4096;

const WINDOWS_DEVICE_NAMES = [
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
];

const BLOCKED_PATHS_UNIX = [
    "/etc",
    "/root",
    "/var/log",
    "/boot",
    "/sys",
    "/proc",
    "/dev",
    "/private/etc",
    "/private/var",
    "/System",
    "/Library/System",
];

const BLOCKED_PATHS_WINDOWS = [
    "C:\\Windows",
    "C:\\Windows\\System32",
    "C:\\Windows\\SysWOW64",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData",
    "C:\\Recovery",
    "C:\\$Recycle.Bin",
];

/**
 * Checks if a string contains null bytes (injection attack).
 */
export function hasNullBytes(str: string): boolean {
    return str.includes("\0");
}

/**
 * Checks if a path contains path traversal sequences.
 * Detects both Unix (..) and Windows-style traversal patterns.
 */
export function containsPathTraversal(path: string): boolean {
    if (/\.\.[/\\]/.test(path)) {
        return true;
    }

    if (/[/\\]\.\./.test(path)) {
        return true;
    }

    if (path === "..") {
        return true;
    }

    if (path.endsWith("..")) {
        return true;
    }

    return false;
}

/**
 * Checks if a path is a WSL UNC path (safe local virtualization path).
 * WSL UNC paths look like \\wsl.localhost\Ubuntu\... or \\wsl$\Ubuntu\...
 * These are safe because they access the local WSL filesystem, not a network share.
 */
export function isWslUncPath(path: string): boolean {
    const lower = path.toLowerCase();
    if (lower.startsWith("\\\\wsl.localhost\\")) {
        return true;
    }
    if (lower.startsWith("\\\\wsl$\\")) {
        return true;
    }
    return false;
}

/**
 * Checks if a path is a UNC path (Windows network path).
 * UNC paths start with \\ and can be used for data exfiltration.
 * WSL UNC paths (\\wsl.localhost\, \\wsl$\) are explicitly allowed.
 */
export function isUncPath(path: string): boolean {
    if (isWslUncPath(path)) {
        return false;
    }

    if (path.startsWith("\\\\")) {
        return true;
    }

    if (/^\/\/[^/]/.test(path)) {
        return true;
    }

    if (path.startsWith("/\\\\")) {
        return true;
    }

    return false;
}

/**
 * Checks if a path contains invalid characters for the platform.
 * On Windows, checks for reserved characters.
 */
export function hasInvalidChars(path: string, platform: string): boolean {
    if (platform === PlatformWindows) {
        // Note: : is allowed as second char for drive letter
        const pathWithoutDrive = path.length >= 2 && path[1] === ":" ? path.substring(2) : path;
        if (/[<>"|?*]/.test(pathWithoutDrive)) {
            return true;
        }
        // eslint-disable-next-line no-control-regex
        if (/[\u0000-\u001F]/.test(path)) {
            return true;
        }
    }
    return false;
}

/**
 * Checks if a path matches a Windows device name.
 * Device names like CON, NUL, AUX can cause issues.
 */
function isWindowsDeviceName(path: string): boolean {
    const parts = path.split(/[/\\]/);
    const filename = parts[parts.length - 1] || path;

    const nameWithoutExt = filename.split(".")[0].toUpperCase();

    return WINDOWS_DEVICE_NAMES.includes(nameWithoutExt);
}

/**
 * Checks if a normalized path starts with or equals a blocked path.
 */
export function isBlockedPath(normalizedPath: string): boolean {
    const blockedPaths = PLATFORM === PlatformWindows ? BLOCKED_PATHS_WINDOWS : BLOCKED_PATHS_UNIX;

    const normalizedForComparison = PLATFORM === PlatformWindows ? normalizedPath.replace(/\\/g, "/") : normalizedPath;
    const lowerPath = normalizedForComparison.toLowerCase();

    for (const blocked of blockedPaths) {
        const normalizedBlocked = PLATFORM === PlatformWindows ? blocked.replace(/\\/g, "/") : blocked;
        const lowerBlocked = normalizedBlocked.toLowerCase();
        if (lowerPath === lowerBlocked || lowerPath.startsWith(lowerBlocked + "/")) {
            return true;
        }
    }

    return false;
}

export type PathValidationResult = {
    valid: boolean;
    reason?: string;
};

/**
 * Performs quick synchronous validation of a path without filesystem access.
 * This is the first line of defense against obviously malicious paths.
 *
 * @param rawPath - The untrusted path to validate
 * @returns Validation result with valid flag and optional reason for rejection
 */
export function quickValidatePath(rawPath: string): PathValidationResult {
    if (!rawPath || rawPath.trim() === "") {
        return { valid: true };
    }

    if (rawPath.length > MAX_PATH_LENGTH) {
        return { valid: false, reason: "path too long" };
    }

    if (hasNullBytes(rawPath)) {
        return { valid: false, reason: "null byte detected" };
    }

    if (containsPathTraversal(rawPath)) {
        return { valid: false, reason: "path traversal detected" };
    }

    if (isUncPath(rawPath)) {
        return { valid: false, reason: "UNC path detected" };
    }

    if (PLATFORM === PlatformWindows) {
        if (isWindowsDeviceName(rawPath)) {
            return { valid: false, reason: "Windows device name" };
        }

        if (hasInvalidChars(rawPath, PlatformWindows)) {
            return { valid: false, reason: "invalid characters" };
        }
    }

    return { valid: true };
}

/**
 * Sanitizes a path from OSC 7 terminal escape sequence.
 * Returns the validated path or null if the path should be rejected.
 *
 * This function performs:
 * 1. Quick synchronous validation (pattern-based)
 * 2. Blocked path checking
 *
 * Note: Filesystem-based validation (symlink resolution, existence check)
 * is handled separately via IPC to the main process.
 *
 * @param rawPath - The untrusted path from terminal output (already URL-decoded)
 * @returns Validated path string or null if rejected
 */
export function sanitizeOsc7Path(rawPath: string): string | null {
    const quickResult = quickValidatePath(rawPath);
    if (!quickResult.valid) {
        console.warn(`[Security] OSC 7 path rejected (${quickResult.reason}):`, rawPath);
        return null;
    }

    // Note: We don't resolve symlinks here - that requires filesystem access
    const normalizedPath = rawPath;

    if (isBlockedPath(normalizedPath)) {
        console.warn("[Security] OSC 7 blocked path rejected:", normalizedPath);
        return null;
    }

    return normalizedPath;
}

/**
 * Converts a Windows path to WSL path format.
 * Example: "C:\Users\foo\bar.png" -> "/mnt/c/Users/foo/bar.png"
 *
 * @param windowsPath - A Windows-style path (e.g., "C:\Users\...")
 * @returns The WSL-compatible path, or null if the input is not a valid Windows path
 */
export function windowsToWslPath(windowsPath: string): string | null {
    if (!windowsPath || windowsPath.length < 3) {
        return null;
    }

    // Check for UNC paths - not supported
    if (windowsPath.startsWith("\\\\") || windowsPath.startsWith("//")) {
        return null;
    }

    // Check for drive letter pattern: X:\ or X:/
    const driveMatch = windowsPath.match(/^([a-zA-Z]):[/\\]/);
    if (!driveMatch) {
        return null;
    }

    const driveLetter = driveMatch[1].toLowerCase();
    const restOfPath = windowsPath.substring(3); // Skip "X:\" or "X:/"

    // Convert backslashes to forward slashes
    const unixPath = restOfPath.replace(/\\/g, "/");

    return `/mnt/${driveLetter}/${unixPath}`;
}
