// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { buildShellMenuItems } from "./shell-selector";

describe("buildShellMenuItems", () => {
    it("should return empty array when no profiles", () => {
        const items = buildShellMenuItems(undefined);
        expect(items).toHaveLength(0);
    });

    it("should return items for each profile", () => {
        const profiles: Record<string, ShellProfileType> = {
            bash: { "display:name": "Bash", "display:order": 1 },
            zsh: { "display:name": "Zsh", "display:order": 2 },
        };
        const items = buildShellMenuItems(profiles);
        expect(items).toHaveLength(2);
    });

    it("should sort by display order", () => {
        const profiles: Record<string, ShellProfileType> = {
            zsh: { "display:name": "Zsh", "display:order": 2 },
            bash: { "display:name": "Bash", "display:order": 1 },
        };
        const items = buildShellMenuItems(profiles);
        expect(items[0].shellId).toBe("bash");
        expect(items[1].shellId).toBe("zsh");
    });

    it("should include shellId and label in each item", () => {
        const profiles: Record<string, ShellProfileType> = {
            bash: { "display:name": "Bash" },
        };
        const items = buildShellMenuItems(profiles);
        expect(items[0].shellId).toBe("bash");
        expect(items[0].label).toBe("Bash");
    });

    it("should fall back to shellId when no display:name", () => {
        const profiles: Record<string, ShellProfileType> = {
            bash: {},
        };
        const items = buildShellMenuItems(profiles);
        expect(items[0].label).toBe("Bash"); // capitalize first letter
    });

    it("should filter out hidden profiles", () => {
        const profiles: Record<string, ShellProfileType> = {
            bash: { "display:name": "Bash" },
            hidden: { "display:name": "Hidden", hidden: true },
        };
        const items = buildShellMenuItems(profiles);
        expect(items).toHaveLength(1);
        expect(items[0].shellId).toBe("bash");
    });
});
