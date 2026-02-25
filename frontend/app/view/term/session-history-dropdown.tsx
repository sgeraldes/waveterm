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

interface SessionEntryProps {
    session: SessionInfo;
    onOpen: () => void;
}

function SessionEntry({ session, onOpen }: SessionEntryProps) {
    const label = session.cwd || session.blockId.substring(0, 8);
    const time = formatRelativeTime(session.lastUpdatedAt);
    const size = formatBytes(session.totalBytes);
    return (
        <button
            className="w-full text-left px-3 py-2 rounded hover:bg-zinc-700 transition-colors cursor-pointer flex flex-col gap-0.5"
            onClick={onOpen}
        >
            <div className="text-xs text-foreground truncate max-w-[220px]">{label}</div>
            <div className="text-[11px] text-muted flex gap-2">
                <span>{time}</span>
                <span>·</span>
                <span>{size}</span>
                <span>·</span>
                <span>
                    {session.segmentCount} segment{session.segmentCount !== 1 ? "s" : ""}
                </span>
            </div>
        </button>
    );
}

interface SessionHistoryFlyoverProps {
    blockId: string;
    tabId?: string;
}

export function SessionHistoryFlyover({ blockId, tabId }: SessionHistoryFlyoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
    const [loading, setLoading] = useState(false);

    const [tabData] = WOS.useWaveObjectValue<Tab>(WOS.makeORef("tab", tabId ?? ""));
    const tabBaseDir = (tabData?.meta?.["tab:basedir"] as string) ?? "";

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

    function openSession(sourceBlockId: string) {
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

    const thisTerm = sessions?.filter((s) => s.blockId === blockId) ?? [];
    const sameDir = sessions?.filter((s) => s.blockId !== blockId && tabBaseDir && s.tabBaseDir === tabBaseDir) ?? [];

    return (
        <>
            <div
                ref={refs.setReference}
                {...getReferenceProps()}
                className="iconbutton disabled text-[13px]"
                title="Session History"
                style={{ cursor: "pointer" }}
            >
                <i className="fa-sharp fa-regular fa-clock-rotate-left" />
            </div>
            {isOpen && (
                <FloatingPortal>
                    <div
                        ref={refs.setFloating}
                        style={floatingStyles}
                        {...getFloatingProps()}
                        className="bg-zinc-800 border border-border rounded-md py-2 text-xs text-foreground shadow-xl z-50 min-w-[260px] max-w-[300px]"
                        onMouseDown={(e) => e.stopPropagation()}
                        onFocusCapture={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 pb-2 font-semibold text-secondary border-b border-border mb-1">
                            Session History
                        </div>
                        {loading && <div className="px-3 py-3 text-muted text-center text-[11px]">Loading...</div>}
                        {!loading && sessions != null && thisTerm.length === 0 && sameDir.length === 0 && (
                            <div className="px-3 py-3 text-muted text-center text-[11px]">No session history yet</div>
                        )}
                        {!loading && thisTerm.length > 0 && (
                            <div className="mb-1">
                                <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wide">
                                    This Terminal
                                </div>
                                {thisTerm.map((s) => (
                                    <SessionEntry key={s.blockId} session={s} onOpen={() => openSession(s.blockId)} />
                                ))}
                            </div>
                        )}
                        {!loading && sameDir.length > 0 && (
                            <div>
                                <div className="px-3 py-1 text-[10px] text-muted uppercase tracking-wide">
                                    Same Directory
                                </div>
                                {sameDir.map((s) => (
                                    <SessionEntry key={s.blockId} session={s} onOpen={() => openSession(s.blockId)} />
                                ))}
                            </div>
                        )}
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}
