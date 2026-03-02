// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Error notification utilities for displaying user-facing errors
 */

export interface ErrorNotificationOptions {
    /** Whether the notification persists across sessions */
    persistent?: boolean;
    /** Expiration time in milliseconds from now */
    expiration?: number;
    /** Whether to also log to console.error (default: true) */
    logToConsole?: boolean;
    /** Additional context to include in console log */
    context?: string;
}

/**
 * Show an error notification to the user
 * This is the preferred way to display errors that users need to be aware of
 *
 * @param title Brief error title
 * @param message Detailed error message
 * @param options Additional notification options
 */
export function showErrorNotification(
    title: string,
    message: string,
    options: ErrorNotificationOptions = {}
): void {
    const { persistent = false, expiration, logToConsole = true, context } = options;

    // Import pushNotification dynamically to avoid circular dependencies
    import("@/store/global").then(({ pushNotification }) => {
        const notification: NotificationType = {
            icon: "triangle-exclamation",
            title,
            message,
            timestamp: new Date().toISOString(),
            type: "error",
            persistent,
            expiration: expiration ? Date.now() + expiration : undefined,
        };

        pushNotification(notification);
    });

    // Log to console if requested
    if (logToConsole) {
        const logMessage = context ? `[${context}] ${title}: ${message}` : `${title}: ${message}`;
        console.error(logMessage);
    }
}

/**
 * Show an error notification from an Error object
 *
 * @param title Brief error title
 * @param error The error object
 * @param options Additional notification options
 */
export function showErrorNotificationFromError(
    title: string,
    error: Error | unknown,
    options: ErrorNotificationOptions = {}
): void {
    const message = error instanceof Error ? error.message : String(error);
    const context = options.context || (error instanceof Error && error.stack ? "with stack trace" : undefined);

    showErrorNotification(title, message, {
        ...options,
        context,
    });

    // If we have a stack trace and console logging is enabled, log it separately
    if (options.logToConsole !== false && error instanceof Error && error.stack) {
        console.error("Stack trace:", error.stack);
    }
}

/**
 * Show a warning notification to the user
 * Similar to showErrorNotification but for non-critical issues
 *
 * @param title Brief warning title
 * @param message Detailed warning message
 * @param options Additional notification options
 */
export function showWarningNotification(
    title: string,
    message: string,
    options: ErrorNotificationOptions = {}
): void {
    const { persistent = false, expiration, logToConsole = true, context } = options;

    import("@/store/global").then(({ pushNotification }) => {
        const notification: NotificationType = {
            icon: "triangle-exclamation",
            title,
            message,
            timestamp: new Date().toISOString(),
            type: "warning",
            persistent,
            expiration: expiration ? Date.now() + expiration : undefined,
        };

        pushNotification(notification);
    });

    if (logToConsole) {
        const logMessage = context ? `[${context}] ${title}: ${message}` : `${title}: ${message}`;
        console.warn(logMessage);
    }
}
