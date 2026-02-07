// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * OMP Configurator Utilities
 *
 * Shared utilities for OMP configuration management.
 */

import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";

/**
 * Reinitialize OMP in all active terminal blocks
 * This sends the appropriate reinit command to each terminal
 */
/**
 * Get segment type icon class string (includes fa-solid or fa-brands prefix)
 */
export function getSegmentIconClass(type: string): string {
    const brandIcons: Record<string, string> = {
        node: "fa-node-js",
        python: "fa-python",
        go: "fa-golang",
        rust: "fa-rust",
        java: "fa-java",
        php: "fa-php",
        dotnet: "fa-microsoft",
        aws: "fa-aws",
        az: "fa-microsoft",
        gcp: "fa-google",
        docker: "fa-docker",
    };

    const solidIcons: Record<string, string> = {
        os: "fa-desktop",
        path: "fa-folder",
        git: "fa-code-branch",
        session: "fa-user",
        time: "fa-clock",
        battery: "fa-battery-full",
        shell: "fa-terminal",
        text: "fa-font",
        exit: "fa-circle-xmark",
        root: "fa-hashtag",
        ruby: "fa-gem",
        kubectl: "fa-cloud",
        terraform: "fa-cubes",
        executiontime: "fa-stopwatch",
        status: "fa-circle-check",
        cmake: "fa-gears",
    };

    if (brandIcons[type]) {
        return `fa-brands ${brandIcons[type]}`;
    }
    if (solidIcons[type]) {
        return `fa-solid ${solidIcons[type]}`;
    }
    return "fa-solid fa-puzzle-piece";
}

export async function reinitOmpInAllTerminals(): Promise<void> {
    try {
        // Get all blocks in the current workspace
        const blocks = await RpcApi.BlocksListCommand(TabRpcClient, {});

        // Filter for terminal blocks and send reinit command to each
        for (const block of blocks) {
            if (block.meta?.view === "term") {
                try {
                    await RpcApi.OmpReinitCommand(TabRpcClient, { blockid: block.blockid });
                } catch (err) {
                    // Log but don't fail - individual terminals may not support OMP
                    console.warn(`Failed to reinit OMP for block ${block.blockid}:`, err);
                }
            }
        }
    } catch (err) {
        console.error("Failed to get blocks for OMP reinit:", err);
    }
}
