// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// CONN-003: Deduplicate concurrent ConnEnsureCommand calls to prevent race conditions
// when connection changes + EnsureConnection happen simultaneously.

class ConnectionDeduplicator {
    private inFlightRequests: Map<string, Promise<void>>;

    constructor() {
        this.inFlightRequests = new Map();
    }

    /**
     * Deduplicates concurrent connection ensure requests.
     * If a request is already in flight for the same connection, returns the existing promise.
     * Otherwise, executes the request and tracks it until completion.
     *
     * @param connName - The connection name to ensure
     * @param requestFn - The function that performs the actual ConnEnsureCommand
     * @returns A promise that resolves when the connection is ensured
     */
    async ensureConnection(connName: string, requestFn: () => Promise<void>): Promise<void> {
        // Check if there's already an in-flight request for this connection
        const existingRequest = this.inFlightRequests.get(connName);
        if (existingRequest) {
            console.log(`[CONN-003] Deduplicating ConnEnsureCommand for ${connName}`);
            return existingRequest;
        }

        // Create a new request
        const newRequest = (async () => {
            try {
                await requestFn();
            } finally {
                // Clean up the in-flight request when done
                this.inFlightRequests.delete(connName);
            }
        })();

        this.inFlightRequests.set(connName, newRequest);
        return newRequest;
    }

    /**
     * Clears all in-flight requests. Useful for testing or cleanup.
     */
    clear(): void {
        this.inFlightRequests.clear();
    }
}

// Global singleton instance
export const connectionDeduplicator = new ConnectionDeduplicator();
