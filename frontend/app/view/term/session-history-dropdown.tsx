import type { TermViewModel } from "@/app/view/term/term-model";
import { createBlock, WOS } from "@/store/global";
import * as services from "@/store/services";
import { fireAndForget } from "@/util/util";
import {
    autoUpdate,
    flip,
    FloatingPortal,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
} from "@floating-ui/react";
import { useEffect, useState } from "react";

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatRelativeTime(ms: number): string {
    const seconds = Math.floor((Date.now() - ms) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ── Shell badge ───────────────────────────────────────────────────────────────

// Deterministic color from any string — no hardcoded shell names
const BADGE_HUES = [210, 140, 35, 280, 170, 0, 60, 320]; // spread across color wheel

function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function ShellBadge({ shelltype }: { shelltype: string | undefined }) {
    const label = shelltype || "shell";
    const hue = BADGE_HUES[hashString(label) % BADGE_HUES.length];
    return (
        <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium leading-none"
            style={{
                backgroundColor: `hsla(${hue}, 60%, 50%, 0.15)`,
                color: `hsla(${hue}, 70%, 70%, 1)`,
            }}
        >
            {label}
        </span>
    );
}

// ── Live / dead dot ───────────────────────────────────────────────────────────

/** A session updated within the last 10 minutes is considered "live" */
const LIVE_THRESHOLD_MS = 10 * 60 * 1000;

function LiveDot({ lastUpdatedAt }: { lastUpdatedAt: number }) {
    const isLive = Date.now() - lastUpdatedAt < LIVE_THRESHOLD_MS;
    return (
        <span
            title={isLive ? "Recently active" : "Inactive"}
            className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLive ? "bg-green-400" : "bg-zinc-500"}`}
        />
    );
}

// ── Session entry ─────────────────────────────────────────────────────────────

interface SessionEntryProps {
    session: SessionInfo;
    showBlockId?: boolean;
    onLoadInBuffer: () => void;
    onOpenViewer: () => void;
    onNewTab: () => void;
}

function SessionEntry({ session, showBlockId, onLoadInBuffer, onOpenViewer, onNewTab }: SessionEntryProps) {
    const cwdPath = session.cwd || session.blockId.substring(0, 8);
    const time = formatRelativeTime(session.lastUpdatedAt);
    const size = formatBytes(session.totalBytes);
    const shortId = session.blockId.substring(0, 6);

    return (
        <div className="group relative flex items-start gap-2 px-2 py-1.5 rounded mx-1 hover:bg-zinc-700/60 transition-colors">
            {/* Shell badge */}
            <div className="flex-shrink-0 pt-0.5">
                <ShellBadge shelltype={session.shelltype} />
            </div>

            {/* Main content — click to load into current buffer */}
            <button
                className="flex-1 min-w-0 text-left cursor-pointer"
                onClick={onLoadInBuffer}
                title={`Load session into terminal — ${cwdPath}`}
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[12px] text-[var(--main-text-color)] font-medium truncate">{session.title || cwdPath}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--secondary-text-color)] mt-0.5">
                    {showBlockId && (
                        <>
                            <span className="font-mono">#{shortId}</span>
                            <span>·</span>
                        </>
                    )}
                    <span>{time}</span>
                    <span>·</span>
                    <span>{size}</span>
                    <span>·</span>
                    <span>
                        {session.segmentCount} seg{session.segmentCount !== 1 ? "s" : ""}
                    </span>
                    <LiveDot lastUpdatedAt={session.lastUpdatedAt} />
                </div>
            </button>

            {/* Action buttons — visible on group hover */}
            <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenViewer();
                    }}
                    title="Open in viewer"
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-600 text-muted hover:text-foreground transition-colors"
                >
                    <i className="fa-sharp fa-regular fa-eye text-[10px]" />
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onNewTab();
                    }}
                    title="Resume in new tab"
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-600 text-muted hover:text-foreground transition-colors"
                >
                    <i className="fa-sharp fa-regular fa-plus text-[10px]" />
                </button>
            </div>
        </div>
    );
}

// ── Filter pills ──────────────────────────────────────────────────────────────

function FilterPills({
    available,
    active,
    onSelect,
}: {
    available: string[];
    active: string | null;
    onSelect: (shell: string | null) => void;
}) {
    return (
        <div className="flex items-center gap-1 flex-wrap">
            <button
                onClick={() => onSelect(null)}
                className={`px-1.5 py-0.5 rounded text-[10px] leading-none transition-colors ${
                    active === null
                        ? "bg-zinc-500/40 text-foreground"
                        : "text-muted hover:bg-zinc-700 hover:text-foreground"
                }`}
            >
                All
            </button>
            {available.map((sh) => (
                <button
                    key={sh}
                    onClick={() => onSelect(sh)}
                    className={`px-1.5 py-0.5 rounded text-[10px] leading-none font-mono transition-colors ${
                        active === sh
                            ? "bg-zinc-500/40 text-foreground"
                            : "text-muted hover:bg-zinc-700 hover:text-foreground"
                    }`}
                >
                    {sh}
                </button>
            ))}
        </div>
    );
}

// ── Main flyover component ────────────────────────────────────────────────────

interface SessionHistoryFlyoverProps {
    blockId: string;
    tabId?: string;
    termModel?: TermViewModel;
}

export function SessionHistoryFlyover({ blockId, tabId, termModel }: SessionHistoryFlyoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [sameDirFilter, setSameDirFilter] = useState<string | null>(null);

    const [tabData] = WOS.useWaveObjectValue<Tab>(WOS.makeORef("tab", tabId ?? ""));
    const tabBaseDir = (tabData?.meta?.["tab:basedir"] as string) ?? "";

    // Read the current block's shell type from metadata (for enriching sessions with empty shelltype)
    const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", blockId));
    const currentShellType = (blockData?.meta?.["term:shelltype"] as string)
        || (blockData?.meta?.["shell:profile"] as string)
        || "";

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: "bottom-end",
        middleware: [offset(8), flip(), shift({ padding: 8 })],
        whileElementsMounted: autoUpdate,
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);
    const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        setSessions(null);
        setSameDirFilter(null);
        fireAndForget(async () => {
            try {
                const result = await services.SessionHistoryService.ListSessionHistory(blockId, tabBaseDir);
                setSessions(result ?? []);
            } catch (e) {
                console.error("Failed to load session history:", e);
                setSessions([]);
            } finally {
                setLoading(false);
            }
        });
    }, [isOpen, blockId, tabBaseDir]);

    function loadInBuffer(session: SessionInfo) {
        setIsOpen(false);
        if (termModel) {
            fireAndForget(() => termModel.loadSessionIntoBuffer(session));
        } else {
            // Fallback: open in viewer if no model available
            openInViewer(session.blockId);
        }
    }

    function openInViewer(sourceBlockId: string) {
        setIsOpen(false);
        fireAndForget(() =>
            createBlock({
                meta: {
                    view: "termhistory",
                    "termhistory:blockid": sourceBlockId,
                },
            })
        );
    }

    function resumeInNewTab(session: SessionInfo) {
        setIsOpen(false);
        // Resume creates a new terminal with the same shell profile, cwd,
        // and a restore hint so initTerminal preloads the source session's scrollback
        fireAndForget(() =>
            createBlock({
                meta: {
                    view: "term",
                    controller: "shell",
                    "cmd:cwd": session.cwd ?? "",
                    ...(session.shelltype ? { "shell:profile": session.shelltype } : {}),
                    ...(session.connection ? { connection: session.connection } : {}),
                    "term:restorefrom": session.blockId,
                },
            })
        );
    }

    // Enrich "this terminal" sessions with the block's current shell type if missing
    const thisTerm = (sessions?.filter((s) => s.blockId === blockId) ?? []).map((s) => ({
        ...s,
        shelltype: s.shelltype || currentShellType,
    }));
    const allSameDir =
        sessions?.filter((s) => s.blockId !== blockId && tabBaseDir && s.tabBaseDir === tabBaseDir) ?? [];

    // Collect unique shell types from the same-dir section for filter pills
    const sameDirShells = Array.from(
        new Set(allSameDir.map((s) => (s.shelltype || "shell")).filter((l) => l !== "shell"))
    );

    const sameDir =
        sameDirFilter === null ? allSameDir : allSameDir.filter((s) => (s.shelltype || "shell") === sameDirFilter);

    const isEmpty = !loading && sessions != null && thisTerm.length === 0 && allSameDir.length === 0;

    return (
        <>
            <button
                ref={refs.setReference}
                {...getReferenceProps()}
                className="wave-iconbutton"
                title="Session History"
            >
                <i className="fa-sharp fa-regular fa-clock-rotate-left" />
            </button>
            {isOpen && (
                <FloatingPortal>
                    <div
                        ref={refs.setFloating}
                        style={floatingStyles}
                        {...getFloatingProps()}
                        className="bg-zinc-800 border border-border rounded-lg py-2 text-xs text-foreground shadow-2xl z-50 min-w-[300px] max-w-[340px] max-h-[480px] overflow-y-auto"
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocusCapture={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-3 pb-2 font-semibold text-secondary border-b border-border mb-1 text-[11px] uppercase tracking-wider">
                            Session History
                        </div>

                        {loading && <div className="px-3 py-4 text-muted text-center text-[11px]">Loading...</div>}

                        {isEmpty && (
                            <div className="px-3 py-4 text-muted text-center text-[11px]">No session history yet</div>
                        )}

                        {/* THIS TERMINAL section */}
                        {!loading && thisTerm.length > 0 && (
                            <div className="mb-1">
                                <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wider font-semibold">
                                    This Terminal
                                </div>
                                {thisTerm.map((s) => (
                                    <SessionEntry
                                        key={`${s.blockId}-${s.lastUpdatedAt}`}
                                        session={s}
                                        showBlockId={false}
                                        onLoadInBuffer={() => loadInBuffer(s)}
                                        onOpenViewer={() => openInViewer(s.blockId)}
                                        onNewTab={() => resumeInNewTab(s)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* SAME DIRECTORY section */}
                        {!loading && allSameDir.length > 0 && (
                            <div>
                                {/* Section header with filter pills */}
                                <div className="px-3 py-1 flex items-center justify-between gap-2">
                                    <span className="text-[10px] text-muted uppercase tracking-wider font-semibold flex-shrink-0">
                                        Same Directory
                                    </span>
                                    {sameDirShells.length > 0 && (
                                        <FilterPills
                                            available={sameDirShells}
                                            active={sameDirFilter}
                                            onSelect={setSameDirFilter}
                                        />
                                    )}
                                </div>
                                {sameDir.map((s) => (
                                    <SessionEntry
                                        key={`${s.blockId}-${s.lastUpdatedAt}`}
                                        session={s}
                                        showBlockId={true}
                                        onLoadInBuffer={() => loadInBuffer(s)}
                                        onOpenViewer={() => openInViewer(s.blockId)}
                                        onNewTab={() => resumeInNewTab(s)}
                                    />
                                ))}
                                {sameDir.length === 0 && sameDirFilter !== null && (
                                    <div className="px-3 py-2 text-muted text-[11px] text-center">
                                        No {sameDirFilter} sessions
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}
