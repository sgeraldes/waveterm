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
import { useEffect, useMemo, useState } from "react";

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatRelativeTime(ms: number): string {
    const seconds = Math.floor((Date.now() - ms) / 1000);
    if (seconds < 60) return "now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

// ── Shell badge ───────────────────────────────────────────────────────────────

const BADGE_HUES = [210, 140, 35, 280, 170, 0, 60, 320];

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
            className="inline-flex items-center justify-center w-[72px] shrink-0 px-1 py-[2px] rounded text-[10px] font-mono leading-none truncate"
            style={{
                backgroundColor: `hsla(${hue}, 55%, 45%, 0.18)`,
                color: `hsla(${hue}, 65%, 72%, 1)`,
            }}
        >
            {label}
        </span>
    );
}

// ── Session row ──────────────────────────────────────────────────────────────

interface SessionRowProps {
    session: SessionInfo;
    showBlockId?: boolean;
    isActive: boolean;
    blockNumber?: number;
    onLoadInBuffer: () => void;
    onOpenViewer: () => void;
    onNewTab: () => void;
}

function SessionRow({ session, showBlockId, isActive, blockNumber, onLoadInBuffer, onOpenViewer, onNewTab }: SessionRowProps) {
    const cwdPath = session.title || session.cwd || session.blockId.substring(0, 8);
    const time = formatRelativeTime(session.lastUpdatedAt);
    const size = formatBytes(session.totalBytes);

    return (
        <div
            className="group flex items-center h-[36px] px-2 mx-1 rounded cursor-pointer transition-colors"
            style={{ background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            onClick={onLoadInBuffer}
            title={`Load into terminal — ${session.cwd || session.blockId}${isActive && blockNumber ? ` (Ctrl+Shift+${blockNumber})` : ""}`}
        >
            {/* Active indicator — number badge or dim bar */}
            {isActive && blockNumber ? (
                <span
                    className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 mr-1.5 text-[10px] font-mono font-bold"
                    style={{ backgroundColor: "rgba(74, 222, 128, 0.15)", color: "#4ade80" }}
                >
                    {blockNumber}
                </span>
            ) : (
                <div className="w-[3px] h-[20px] rounded-full shrink-0 mr-2" style={{
                    backgroundColor: isActive ? "#4ade80" : "rgba(255,255,255,0.08)",
                    marginLeft: "7px",
                }} />
            )}

            {/* Shell badge — fixed width */}
            <ShellBadge shelltype={session.shelltype} />

            {/* Path / title */}
            <span className="flex-1 min-w-0 mx-2 text-[11px] truncate" style={{ color: "var(--main-text-color)" }}>
                {cwdPath}
            </span>

            {/* Metadata — right-aligned, always visible */}
            <div
                className="shrink-0 flex items-center gap-[6px] text-[10px] font-mono tabular-nums group-hover:hidden"
                style={{ color: "rgba(255,255,255,0.3)" }}
            >
                {showBlockId && <span>{session.blockId.substring(0, 5)}</span>}
                <span className="w-[24px] text-right">{time}</span>
                <span className="w-[28px] text-right">{size}</span>
                <span className="w-[8px] text-center">{session.segmentCount}</span>
            </div>

            {/* Actions — replace metadata on hover */}
            <div className="shrink-0 hidden group-hover:flex items-center gap-[2px]">
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenViewer(); }}
                    title="Open in viewer"
                    className="w-[24px] h-[24px] flex items-center justify-center rounded transition-colors"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--main-text-color)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
                >
                    <i className="fa-sharp fa-regular fa-eye text-[10px]" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onNewTab(); }}
                    title="Resume in new tab"
                    className="w-[24px] h-[24px] flex items-center justify-center rounded transition-colors"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "var(--main-text-color)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
                >
                    <i className="fa-sharp fa-regular fa-arrow-up-right-from-square text-[10px]" />
                </button>
            </div>
        </div>
    );
}

// ── Column header ────────────────────────────────────────────────────────────

function ColumnHeader({ showBlockId }: { showBlockId?: boolean }) {
    return (
        <div className="flex items-center h-[20px] px-2 mx-1 text-[9px] font-mono uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.2)" }}>
            <div className="w-[3px] mr-2" />
            <div className="w-[72px] shrink-0">shell</div>
            <div className="flex-1 mx-2">path</div>
            <div className="shrink-0 flex items-center gap-[6px]">
                {showBlockId && <span>id</span>}
                <span className="w-[24px] text-right">age</span>
                <span className="w-[28px] text-right">size</span>
                <span className="w-[8px] text-center">#</span>
            </div>
        </div>
    );
}

// ── Filter pills ─────────────────────────────────────────────────────────────

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
        <div className="flex items-center gap-[4px] px-3 pb-1">
            <button
                onClick={() => onSelect(null)}
                className="px-[6px] py-[2px] rounded text-[10px] font-mono leading-none transition-colors"
                style={{
                    background: active === null ? "rgba(255,255,255,0.1)" : "transparent",
                    color: active === null ? "var(--main-text-color)" : "rgba(255,255,255,0.3)",
                }}
            >
                all
            </button>
            {available.map((sh) => (
                <button
                    key={sh}
                    onClick={() => onSelect(sh)}
                    className="px-[6px] py-[2px] rounded text-[10px] font-mono leading-none transition-colors"
                    style={{
                        background: active === sh ? "rgba(255,255,255,0.1)" : "transparent",
                        color: active === sh ? "var(--main-text-color)" : "rgba(255,255,255,0.3)",
                    }}
                >
                    {sh}
                </button>
            ))}
        </div>
    );
}

// ── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.08em] font-medium"
            style={{ color: "rgba(255,255,255,0.25)" }}
        >
            {children}
        </div>
    );
}

// ── Main flyover ─────────────────────────────────────────────────────────────

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
    const activeBlockIds = useMemo(() => new Set(tabData?.blockids ?? []), [tabData?.blockids]);
    // Map blockId → 1-based index for Ctrl+Shift+N shortcut display
    const blockNumberMap = useMemo(() => {
        const map = new Map<string, number>();
        (tabData?.blockids ?? []).forEach((id, i) => map.set(id, i + 1));
        return map;
    }, [tabData?.blockids]);

    const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", blockId));
    const currentShellType =
        (blockData?.meta?.["term:shelltype"] as string) || (blockData?.meta?.["shell:profile"] as string) || "";

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: "bottom-end",
        middleware: [offset(6), flip(), shift({ padding: 8 })],
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
            openInViewer(session.blockId);
        }
    }

    function openInViewer(sourceBlockId: string) {
        setIsOpen(false);
        fireAndForget(() =>
            createBlock({ meta: { view: "termhistory", "termhistory:blockid": sourceBlockId } })
        );
    }

    function resumeInNewTab(session: SessionInfo) {
        setIsOpen(false);
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

    const thisTerm = (sessions?.filter((s) => s.blockId === blockId) ?? []).map((s) => ({
        ...s,
        shelltype: s.shelltype || currentShellType,
    }));
    const allSameDir =
        sessions?.filter((s) => s.blockId !== blockId && tabBaseDir && s.tabBaseDir === tabBaseDir) ?? [];
    const sameDirShells = Array.from(
        new Set(allSameDir.map((s) => s.shelltype || "shell").filter((l) => l !== "shell"))
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
                        {...getFloatingProps()}
                        className="rounded-lg py-1 z-50 max-h-[480px] overflow-y-auto"
                        style={{
                            ...floatingStyles,
                            background: "color-mix(in srgb, var(--main-bg-color) 97%, white)",
                            border: "1px solid var(--border-color)",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
                            width: 420,
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocusCapture={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {loading && (
                            <div className="py-8 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                Loading sessions...
                            </div>
                        )}

                        {isEmpty && (
                            <div className="py-8 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                No session history
                            </div>
                        )}

                        {/* THIS TERMINAL */}
                        {!loading && thisTerm.length > 0 && (
                            <div className="pb-1">
                                <SectionLabel>This Terminal</SectionLabel>
                                <ColumnHeader showBlockId={false} />
                                {thisTerm.map((s) => (
                                    <SessionRow
                                        key={`${s.blockId}-${s.lastUpdatedAt}`}
                                        session={s}
                                        showBlockId={false}
                                        isActive={true}
                                        blockNumber={blockNumberMap.get(s.blockId)}
                                        onLoadInBuffer={() => loadInBuffer(s)}
                                        onOpenViewer={() => openInViewer(s.blockId)}
                                        onNewTab={() => resumeInNewTab(s)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Divider */}
                        {!loading && thisTerm.length > 0 && allSameDir.length > 0 && (
                            <div className="mx-2 my-1" style={{ borderTop: "1px solid var(--border-color)" }} />
                        )}

                        {/* SAME DIRECTORY */}
                        {!loading && allSameDir.length > 0 && (
                            <div className="pb-1">
                                <SectionLabel>Same Directory</SectionLabel>
                                {sameDirShells.length > 0 && (
                                    <FilterPills available={sameDirShells} active={sameDirFilter} onSelect={setSameDirFilter} />
                                )}
                                <ColumnHeader showBlockId={true} />
                                {sameDir.map((s) => (
                                    <SessionRow
                                        key={`${s.blockId}-${s.lastUpdatedAt}`}
                                        session={s}
                                        showBlockId={true}
                                        isActive={activeBlockIds.has(s.blockId)}
                                        blockNumber={blockNumberMap.get(s.blockId)}
                                        onLoadInBuffer={() => loadInBuffer(s)}
                                        onOpenViewer={() => openInViewer(s.blockId)}
                                        onNewTab={() => resumeInNewTab(s)}
                                    />
                                ))}
                                {sameDir.length === 0 && sameDirFilter !== null && (
                                    <div className="py-4 text-center text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
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
