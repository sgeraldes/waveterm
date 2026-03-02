// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Loading Spinner Component
 *
 * Standard loading spinner for Wave Terminal with consistent styling and behavior.
 *
 * USAGE GUIDELINES:
 *
 * 1. WHEN TO USE SPINNERS:
 *    - Fast operations (<2 seconds)
 *    - Simple data loading
 *    - Button loading states
 *    - Initial page loads
 *
 * 2. WHEN TO USE SKELETON SCREENS (alternative to spinners):
 *    - Slow operations (>2 seconds)
 *    - Complex layouts with known structure
 *    - Content-heavy pages
 *
 * 3. WHEN TO USE PROGRESS BARS (alternative to spinners):
 *    - Operations with known progress (file uploads, batch operations)
 *    - Long-running tasks where progress can be measured
 *
 * LOADING TEXT PATTERNS:
 *
 * - Active operation: "<spinner> {action}ing..." (e.g., "Connecting...", "Saving...", "Loading...")
 * - Passive waiting: "<spinner> Loading..."
 * - Button states: Spinner + shortened text (e.g., "Save" → "Saving...")
 *
 * SIZE VARIANTS:
 *
 * - small: For inline use, tight spaces, or small buttons
 * - normal: Default size for most use cases
 * - large: For full-page loading states or prominent loaders
 *
 * EXAMPLES:
 *
 * ```tsx
 * // Full-page loading state
 * <LoadingSpinner size="normal" message="Loading connections..." />
 *
 * // Inline loading (no message)
 * <LoadingSpinner size="small" />
 *
 * // Button loading state
 * <button disabled={isSaving}>
 *   {isSaving ? (
 *     <>
 *       <LoadingSpinner size="small" />
 *       <span>Saving...</span>
 *     </>
 *   ) : (
 *     <>
 *       <i className="fa-sharp fa-solid fa-check" />
 *       <span>Save</span>
 *     </>
 *   )}
 * </button>
 * ```
 */

import { makeIconClass } from "@/util/util";
import { memo } from "react";

import "./spinner.scss";

export interface LoadingSpinnerProps {
    /**
     * Size variant of the spinner
     * - small: For inline use or small buttons
     * - normal: Default size
     * - large: For prominent loading states
     */
    size?: "small" | "normal" | "large";

    /**
     * Optional loading message to display next to spinner
     * Examples: "Loading...", "Connecting...", "Saving..."
     */
    message?: string;

    /**
     * Optional CSS class name for custom styling
     */
    className?: string;
}

/**
 * Standard loading spinner component with consistent styling.
 * Uses Font Awesome spinner icon with fa-spin animation.
 */
export const LoadingSpinner = memo(({ size = "normal", message, className }: LoadingSpinnerProps) => {
    const sizeClass = size === "small" ? "spinner-small" : size === "large" ? "spinner-large" : "spinner-normal";

    // Inline-only mode: just return the spinner icon without wrapper
    if (!message) {
        return <i className={`${makeIconClass("spinner", false)} fa-spin ${className || ""}`} />;
    }

    // Full loading state with message
    return (
        <div className={`loading-spinner ${sizeClass} ${className || ""}`}>
            <i className={`${makeIconClass("spinner", false)} fa-spin`} />
            <span className="loading-message">{message}</span>
        </div>
    );
});

LoadingSpinner.displayName = "LoadingSpinner";
