// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { cn } from "@/util/util";
import { memo, useCallback, useRef, useState } from "react";

interface HotkeyControlProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

const ModifierKeys = new Set(["Control", "Shift", "Alt", "Meta"]);

/**
 * Convert a KeyboardEvent into Wave's colon-separated hotkey format.
 * Example: Win+Shift+W → "Meta:Shift:w"
 */
function keyEventToWaveKey(e: KeyboardEvent): string | null {
    // Ignore standalone modifier presses
    if (ModifierKeys.has(e.key)) {
        return null;
    }

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Meta");

    // Need at least one modifier for a global hotkey
    if (parts.length === 0) {
        return null;
    }

    // Normalize the key
    let key = e.key;
    if (key === " ") {
        key = " "; // space is kept as space in Wave format
    } else if (key.length === 1) {
        key = key.toLowerCase();
    }
    // e.key already gives us "F1", "Tab", "Escape", "ArrowUp", etc.

    parts.push(key);
    return parts.join(":");
}

/**
 * Format a Wave key string for display.
 * "Meta:Shift:w" → "Win + Shift + W" (on Windows) or "⌘ + Shift + W" (on Mac)
 */
function formatWaveKeyForDisplay(waveKey: string): string {
    if (!waveKey) return "";
    const isMac = navigator.platform?.startsWith("Mac");
    const parts = waveKey.split(":");
    const displayParts = parts.map((part) => {
        switch (part) {
            case "Ctrl":
                return isMac ? "⌃" : "Ctrl";
            case "Alt":
                return isMac ? "⌥" : "Alt";
            case "Shift":
                return isMac ? "⇧" : "Shift";
            case "Meta":
                return isMac ? "⌘" : "Win";
            case " ":
                return "Space";
            default:
                return part.length === 1 ? part.toUpperCase() : part;
        }
    });
    return displayParts.join(" + ");
}

const HotkeyControl = memo(({ value, onChange, disabled, className, placeholder }: HotkeyControlProps) => {
    const [isCapturing, setIsCapturing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            e.preventDefault();
            e.stopPropagation();

            // Escape clears the hotkey
            if (e.key === "Escape") {
                onChange("");
                inputRef.current?.blur();
                return;
            }

            // Backspace/Delete clears
            if (e.key === "Backspace" || e.key === "Delete") {
                onChange("");
                return;
            }

            const waveKey = keyEventToWaveKey(e.nativeEvent);
            if (waveKey) {
                onChange(waveKey);
                inputRef.current?.blur();
            }
        },
        [onChange]
    );

    const handleFocus = useCallback(() => {
        setIsCapturing(true);
    }, []);

    const handleBlur = useCallback(() => {
        setIsCapturing(false);
    }, []);

    const displayValue = isCapturing ? "Press a key combination..." : formatWaveKeyForDisplay(value);

    return (
        <div className={cn("setting-text", className, { disabled })}>
            <input
                ref={inputRef}
                type="text"
                className={cn("setting-text-input", { "hotkey-capturing": isCapturing })}
                value={displayValue}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                disabled={disabled}
                placeholder={placeholder ?? "Click to set hotkey..."}
                readOnly
            />
        </div>
    );
});

HotkeyControl.displayName = "HotkeyControl";

export { HotkeyControl, formatWaveKeyForDisplay };
export type { HotkeyControlProps };
