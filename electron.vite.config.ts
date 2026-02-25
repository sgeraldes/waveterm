import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "electron-vite";
import { mkdirSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import type { Plugin } from "vite";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

const CHROME = "chrome140";
const NODE = "node22";

/**
 * Writes the Vite dev server URL to dist/.dev-server-url so the Electron
 * main process can read it. This bridges the WSL2-to-Windows env var gap:
 * electron-vite sets ELECTRON_RENDERER_URL in the WSL Node.js process, but
 * that env var doesn't propagate to the Windows electron.exe child process.
 */
function writeDevServerUrl(): Plugin {
    return {
        name: "write-dev-server-url",
        configureServer(server) {
            server.httpServer?.once("listening", () => {
                const address = server.httpServer?.address();
                if (address && typeof address === "object") {
                    const protocol = server.config.server.https ? "https" : "http";
                    const host =
                        address.address === "::" || address.address === "0.0.0.0" ? "localhost" : address.address;
                    const url = `${protocol}://${host}:${address.port}`;
                    const urlFilePath = nodePath.resolve("dist", ".dev-server-url");
                    mkdirSync(nodePath.dirname(urlFilePath), { recursive: true });
                    writeFileSync(urlFilePath, url, "utf-8");
                    console.log(`[write-dev-server-url] wrote ${url} to ${urlFilePath}`);
                }
            });
        },
    };
}

export default defineConfig({
    main: {
        root: ".",
        build: {
            target: NODE,
            rollupOptions: {
                input: {
                    index: "emain/emain.ts",
                },
            },
            outDir: "dist/main",
        },
        plugins: [tsconfigPaths()],
        resolve: {
            alias: {
                "@": "frontend",
            },
        },
        server: {
            open: false,
        },
        define: {
            "process.env.WS_NO_BUFFER_UTIL": "true",
            "process.env.WS_NO_UTF_8_VALIDATE": "true",
        },
    },
    preload: {
        root: ".",
        build: {
            target: NODE,
            sourcemap: true,
            rollupOptions: {
                input: {
                    index: "emain/preload.ts",
                    "preload-webview": "emain/preload-webview.ts",
                },
                output: {
                    format: "cjs",
                },
            },
            outDir: "dist/preload",
        },
        server: {
            open: false,
        },
        plugins: [tsconfigPaths()],
    },
    renderer: {
        root: ".",
        build: {
            target: CHROME,
            sourcemap: true,
            outDir: "dist/frontend",
            rollupOptions: {
                input: {
                    index: "index.html",
                },
                output: {
                    manualChunks(id) {
                        const p = id.replace(/\\/g, "/");
                        if (p.includes("node_modules/monaco") || p.includes("node_modules/@monaco")) return "monaco";
                        if (p.includes("node_modules/mermaid") || p.includes("node_modules/@mermaid")) return "mermaid";
                        if (p.includes("node_modules/katex") || p.includes("node_modules/@katex")) return "katex";
                        if (p.includes("node_modules/shiki") || p.includes("node_modules/@shiki")) {
                            return "shiki";
                        }
                        if (p.includes("node_modules/cytoscape") || p.includes("node_modules/@cytoscape"))
                            return "cytoscape";
                        return undefined;
                    },
                },
            },
        },
        optimizeDeps: {
            include: ["monaco-yaml/yaml.worker.js"],
        },
        server: {
            open: false,
            watch: {
                ignored: [
                    "dist/**",
                    "**/*.go",
                    "**/go.mod",
                    "**/go.sum",
                    "**/*.md",
                    "**/*.json",
                    "emain/**",
                    "**/*.txt",
                    "**/*.log",
                ],
            },
        },
        plugins: [
            tsconfigPaths(),
            { ...ViteImageOptimizer(), apply: "build" },
            svgr({
                svgrOptions: { exportType: "default", ref: true, svgo: false, titleProp: true },
                include: "**/*.svg",
            }),
            react({}),
            tailwindcss(),
            writeDevServerUrl(),
        ],
    },
});
