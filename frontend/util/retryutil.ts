// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Retry utility for network operations with exponential backoff
 */

export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: any) => boolean;
    onRetry?: (attempt: number, error: any, delay: number) => void;
}

export class RetryableError extends Error {
    constructor(message: string, public readonly originalError?: any) {
        super(message);
        this.name = "RetryableError";
    }
}

export class NonRetryableError extends Error {
    constructor(message: string, public readonly originalError?: any) {
        super(message);
        this.name = "NonRetryableError";
    }
}

/**
 * Default logic to determine if an error should be retried
 */
function defaultShouldRetry(error: any): boolean {
    // Don't retry if explicitly marked as non-retryable
    if (error instanceof NonRetryableError) {
        return false;
    }

    // Always retry if explicitly marked as retryable
    if (error instanceof RetryableError) {
        return true;
    }

    // Check for HTTP status codes
    if (error?.response?.status) {
        const status = error.response.status;
        // Retry on rate limits, service unavailable, gateway errors, timeout
        if (status === 429 || status === 503 || status === 504 || status === 408) {
            return true;
        }
        // Don't retry on client errors (except rate limit and timeout)
        if (status >= 400 && status < 500) {
            return false;
        }
        // Retry on server errors
        if (status >= 500) {
            return true;
        }
    }

    // Check for network errors (common error messages)
    const errorMsg = error?.message?.toLowerCase() || "";
    if (
        errorMsg.includes("network") ||
        errorMsg.includes("timeout") ||
        errorMsg.includes("econnreset") ||
        errorMsg.includes("econnrefused") ||
        errorMsg.includes("enotfound") ||
        errorMsg.includes("etimedout") ||
        errorMsg.includes("socket hang up") ||
        errorMsg.includes("connection closed")
    ) {
        return true;
    }

    // Don't retry on authentication/authorization errors
    if (errorMsg.includes("unauthorized") || errorMsg.includes("forbidden") || errorMsg.includes("invalid")) {
        return false;
    }

    // Default: retry on unknown errors (conservative approach)
    return true;
}

/**
 * Retry an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 16000,
        backoffMultiplier = 2,
        shouldRetry = defaultShouldRetry,
        onRetry,
    } = options;

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // If this is the last attempt or error shouldn't be retried, throw immediately
            if (attempt >= maxRetries || !shouldRetry(error)) {
                throw error;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), maxDelay);

            // Notify caller about retry attempt
            if (onRetry) {
                onRetry(attempt + 1, error, delay);
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but TypeScript doesn't know that
    throw lastError;
}

/**
 * Create a retry wrapper for a function that will always use the same retry options
 */
export function createRetryWrapper<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: RetryOptions = {}
): T {
    return ((...args: any[]) => {
        return retryWithBackoff(() => fn(...args), options);
    }) as T;
}

/**
 * Determine if an HTTP status code is retryable
 */
export function isRetryableHttpStatus(status: number): boolean {
    return status === 429 || status === 503 || status === 504 || status === 408 || status >= 500;
}

/**
 * Parse retry-after header from HTTP response
 */
export function parseRetryAfter(retryAfter: string | undefined): number | null {
    if (!retryAfter) {
        return null;
    }

    // Try parsing as number (seconds)
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
        return seconds * 1000; // Convert to milliseconds
    }

    // Try parsing as HTTP date
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
        return Math.max(0, date.getTime() - Date.now());
    }

    return null;
}
