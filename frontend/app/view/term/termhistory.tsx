import { WOS } from "@/store/global";
import * as services from "@/store/services";
import { base64ToArray, fireAndForget } from "@/util/util";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import * as jotai from "jotai";
import * as React from "react";
import type { TermHistoryViewModel } from "./termhistory-model";
import { computeTheme } from "./termutil";
import "./xterm.css";

const MAX_LOAD_BYTES = 10 * 1024 * 1024;

export const TermHistoryView = ({ blockId }: ViewComponentProps<TermHistoryViewModel>) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const termRef = React.useRef<Terminal>(null);
    const fitAddonRef = React.useRef<FitAddon>(null);
    const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", blockId));
    const sourceBlockId = blockData?.meta?.["termhistory:blockid"] as string;

    const [termTheme] = computeTheme(null, null, null);

    React.useEffect(() => {
        if (!containerRef.current) return;

        const term = new Terminal({
            theme: termTheme,
            scrollback: 10000,
            disableStdin: true,
            cursorStyle: "block",
            cursorBlink: false,
            fontSize: 12,
        });

        term.attachCustomKeyEventHandler(() => false);

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        fitAddon.fit();

        termRef.current = term;
        fitAddonRef.current = fitAddon;

        if (sourceBlockId) {
            fireAndForget(async () => {
                try {
                    const b64content = await services.SessionHistoryService.ReadLatestSegments(
                        sourceBlockId,
                        MAX_LOAD_BYTES
                    );
                    if (b64content) {
                        const data = base64ToArray(b64content);
                        term.write(data);
                    }
                } catch (e) {
                    term.write(`\x1b[31mFailed to load session history: ${e}\x1b[0m\r\n`);
                }
            });
        }

        return () => {
            term.dispose();
            termRef.current = null;
            fitAddonRef.current = null;
        };
    }, [sourceBlockId]);

    React.useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(() => {
            fitAddonRef.current?.fit();
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} style={{ width: "100%", height: "100%", overflow: "hidden" }} data-blockid={blockId} />
    );
};

void jotai.atom;
