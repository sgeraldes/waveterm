import { UserConfig, defineConfig, mergeConfig } from "vitest/config";
import electronViteConfig from "./electron.vite.config";

export default mergeConfig(
    electronViteConfig.renderer as UserConfig,
    defineConfig({
        test: {
            setupFiles: ["./vitest.setup.ts"],
            reporters: ["verbose", "junit"],
            outputFile: {
                junit: "test-results.xml",
            },
            coverage: {
                provider: "istanbul",
                reporter: ["lcov"],
                reportsDirectory: "./coverage",
            },
            typecheck: {
                tsconfig: "tsconfig.json",
            },
            alias: {
                // @xterm/addon-ligatures ships only .mjs but declares .js in "main",
                // causing Vite's test resolver to fail. Point directly to the .mjs file.
                "@xterm/addon-ligatures": "@xterm/addon-ligatures/lib/addon-ligatures.mjs",
            },
        },
    })
);
