// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Result type for operations that can fail
 *
 * This provides type-safe error handling that forces consumers to check for success
 * before accessing data. This is preferred over throwing exceptions or returning
 * nullable values for operations where failure is expected (RPC calls, file operations, etc.)
 *
 * Usage:
 * ```typescript
 * const result = await someOperation();
 * if (!result.success) {
 *     showErrorNotification("Operation Failed", result.error.message);
 *     return;
 * }
 * // TypeScript knows result.data is available here
 * console.log(result.data);
 * ```
 */

/**
 * Represents a successful operation result
 */
export interface Ok<T> {
    success: true;
    data: T;
}

/**
 * Represents a failed operation result
 */
export interface Err<E = Error> {
    success: false;
    error: E;
}

/**
 * Result type that represents either success (Ok) or failure (Err)
 *
 * @template T - The type of successful result data
 * @template E - The type of error (defaults to Error)
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Type guard to check if a Result is Ok
 *
 * @param result - The result to check
 * @returns true if result is Ok, with proper type narrowing
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
    return result.success;
}

/**
 * Type guard to check if a Result is Err
 *
 * @param result - The result to check
 * @returns true if result is Err, with proper type narrowing
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
    return !result.success;
}

/**
 * Create a successful Result
 *
 * @param data - The successful operation data
 * @returns Ok result containing the data
 *
 * @example
 * ```typescript
 * return ok({ id: 123, name: "example" });
 * ```
 */
export function ok<T>(data: T): Ok<T> {
    return { success: true, data };
}

/**
 * Create a failed Result
 *
 * @param error - The error that occurred
 * @returns Err result containing the error
 *
 * @example
 * ```typescript
 * return err(new Error("Connection failed"));
 * // or with string error
 * return err("Connection failed");
 * ```
 */
export function err<E = Error>(error: E): Err<E> {
    return { success: false, error };
}

/**
 * Wrap an async function that may throw into a Result-returning function
 *
 * @param fn - Async function that may throw
 * @returns Result with data or error message
 *
 * @example
 * ```typescript
 * const result = await safeAsync(() => RpcApi.ConnectCommand(client, data));
 * if (!result.success) {
 *     console.error("Failed:", result.error);
 *     return;
 * }
 * console.log("Success:", result.data);
 * ```
 */
export async function safeAsync<T>(fn: () => Promise<T>): Promise<Result<T, string>> {
    try {
        const data = await fn();
        return ok(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
    }
}

/**
 * Wrap an async function that may throw into a Result-returning function,
 * preserving the full Error object
 *
 * @param fn - Async function that may throw
 * @returns Result with data or Error object
 *
 * @example
 * ```typescript
 * const result = await safeAsyncError(() => RpcApi.ConnectCommand(client, data));
 * if (!result.success) {
 *     console.error("Failed:", result.error.message, result.error.stack);
 *     return;
 * }
 * console.log("Success:", result.data);
 * ```
 */
export async function safeAsyncError<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
        const data = await fn();
        return ok(data);
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { success: false, error: err };
    }
}

/**
 * Wrap a synchronous function that may throw into a Result-returning function
 *
 * @param fn - Synchronous function that may throw
 * @returns Result with data or error message
 *
 * @example
 * ```typescript
 * const result = safeSync(() => JSON.parse(data));
 * if (!result.success) {
 *     console.error("Parse failed:", result.error);
 *     return;
 * }
 * console.log("Parsed:", result.data);
 * ```
 */
export function safeSync<T>(fn: () => T): Result<T, string> {
    try {
        const data = fn();
        return ok(data);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return err(message);
    }
}

/**
 * Map a Result's success value to a new value
 *
 * @param result - The result to map
 * @param fn - Function to transform success value
 * @returns New Result with transformed data or original error
 *
 * @example
 * ```typescript
 * const result = await getUser(id);
 * const nameResult = mapResult(result, user => user.name);
 * ```
 */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
    if (result.success) {
        return ok(fn(result.data));
    }
    return err((result as Err<E>).error);
}

/**
 * Chain multiple Result-returning operations
 *
 * @param result - The result to chain from
 * @param fn - Function that returns another Result
 * @returns Result from fn, or original error
 *
 * @example
 * ```typescript
 * const result = await getUserResult(id);
 * const profileResult = await chainResult(result, user => getUserProfile(user.id));
 * ```
 */
export function chainResult<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>
): Result<U, E> {
    if (result.success) {
        return fn(result.data);
    }
    return err((result as Err<E>).error);
}

/**
 * Chain multiple Result-returning async operations
 *
 * @param result - The result to chain from
 * @param fn - Async function that returns another Result
 * @returns Result from fn, or original error
 *
 * @example
 * ```typescript
 * const result = await getUserResult(id);
 * const profileResult = await chainResultAsync(result, async user => {
 *     return await getUserProfileResult(user.id);
 * });
 * ```
 */
export async function chainResultAsync<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
    if (result.success) {
        return await fn(result.data);
    }
    return err((result as Err<E>).error);
}

/**
 * Unwrap a Result, throwing if it's an error
 * Use this sparingly - prefer explicit error handling
 *
 * @param result - The result to unwrap
 * @returns The success data
 * @throws The error if result is not successful
 *
 * @example
 * ```typescript
 * const data = unwrap(result); // throws if result.success === false
 * ```
 */
export function unwrap<T, E>(result: Result<T, E>): T {
    if (!result.success) {
        throw (result as Err<E>).error;
    }
    return result.data;
}

/**
 * Unwrap a Result with a default value if it's an error
 *
 * @param result - The result to unwrap
 * @param defaultValue - Value to return if result is error
 * @returns The success data or default value
 *
 * @example
 * ```typescript
 * const data = unwrapOr(result, { id: 0, name: "Unknown" });
 * ```
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (result.success) {
        return result.data;
    }
    return defaultValue;
}

/**
 * Check if all results are successful
 *
 * @param results - Array of results to check
 * @returns true if all results are successful
 *
 * @example
 * ```typescript
 * const results = await Promise.all([op1(), op2(), op3()]);
 * if (allOk(results)) {
 *     console.log("All operations succeeded");
 * }
 * ```
 */
export function allOk<T, E>(results: Result<T, E>[]): boolean {
    return results.every((r) => r.success);
}

/**
 * Get all successful results from an array
 *
 * @param results - Array of results
 * @returns Array of successful data values
 *
 * @example
 * ```typescript
 * const results = await Promise.all([op1(), op2(), op3()]);
 * const successData = getOkValues(results);
 * ```
 */
export function getOkValues<T, E>(results: Result<T, E>[]): T[] {
    return results.filter((r): r is Ok<T> => r.success).map((r) => r.data);
}

/**
 * Get all errors from an array of results
 *
 * @param results - Array of results
 * @returns Array of error values
 *
 * @example
 * ```typescript
 * const results = await Promise.all([op1(), op2(), op3()]);
 * const errors = getErrValues(results);
 * if (errors.length > 0) {
 *     console.error("Some operations failed:", errors);
 * }
 * ```
 */
export function getErrValues<T, E>(results: Result<T, E>[]): E[] {
    return results.filter((r): r is Err<E> => !r.success).map((r) => r.error);
}
