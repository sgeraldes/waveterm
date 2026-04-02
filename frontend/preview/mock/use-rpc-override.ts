// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// useRpcOverride is a no-op stub for preview environments.
// In a real implementation it would intercept RPC calls for mock data.
export function useRpcOverride(_commandName: string, _handler: (...args: unknown[]) => unknown): void {
    // no-op in preview
}
