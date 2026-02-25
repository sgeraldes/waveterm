import { clearRecentlyClosed, recentlyClosedTabsAtom, reopenTab } from "@/app/store/recently-closed";
import { fireAndForget, formatRelativeTime } from "@/util/util";
import { useAtomValue } from "jotai";
import { memo, useCallback, useMemo } from "react";

interface RecentlyClosedSectionProps {
    searchQuery: string;
    onDismissPanel: () => void;
}

const RecentlyClosedSection = memo(({ searchQuery, onDismissPanel }: RecentlyClosedSectionProps) => {
    const entries = useAtomValue(recentlyClosedTabsAtom);
    const query = searchQuery.toLowerCase().trim();

    const filteredEntries = useMemo(() => {
        if (!query) return entries;
        return entries.filter((entry) => entry.name.toLowerCase().includes(query));
    }, [entries, query]);

    const handleReopen = useCallback(
        (entry: { id: string; name: string; color: string; icon: string; closedAt: number }) => {
            fireAndForget(async () => {
                await reopenTab(entry);
                onDismissPanel();
            });
        },
        [onDismissPanel]
    );

    const handleClearAll = useCallback(() => {
        clearRecentlyClosed();
    }, []);

    if (entries.length === 0) {
        return <div className="section-empty-message">No recently closed tabs</div>;
    }

    return (
        <div className="recently-closed-section">
            {entries.length > 0 && (
                <div className="section-action-bar">
                    <button className="section-action-btn" onClick={handleClearAll}>
                        Clear All
                    </button>
                </div>
            )}
            {filteredEntries.map((entry) => (
                <div key={entry.id} className="tab-management-item" role="button" tabIndex={0} onClick={() => handleReopen(entry)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleReopen(entry); } }}>
                    <div className="tab-item-left">
                        {entry.icon && <i className={`fa fa-${entry.icon} tab-item-icon`} />}
                        {entry.color && <div className="tab-color-dot" style={{ backgroundColor: entry.color }} />}
                        <span className="tab-item-name">{entry.name}</span>
                        <span className="tab-item-time">{formatRelativeTime(entry.closedAt)}</span>
                    </div>
                    <div className="tab-item-right">
                        <button
                            className="tab-item-action"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleReopen(entry);
                            }}
                            title="Reopen tab"
                        >
                            <i className="fa fa-rotate-right" />
                        </button>
                    </div>
                </div>
            ))}
            {filteredEntries.length === 0 && query && <div className="section-empty-message">No matches found</div>}
        </div>
    );
});
RecentlyClosedSection.displayName = "RecentlyClosedSection";

export { RecentlyClosedSection };
