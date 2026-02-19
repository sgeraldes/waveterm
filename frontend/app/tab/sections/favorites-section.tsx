import { atoms, globalStore, setActiveTab } from "@/app/store/global";
import { ObjectService } from "@/app/store/services";
import { makeORef, useWaveObjectValue } from "@/app/store/wos";
import { fireAndForget } from "@/util/util";
import { memo, useCallback } from "react";

interface FavoritesSectionProps {
    tabIds: string[];
    searchQuery: string;
    onDismissPanel: () => void;
}

/** Renders a single favorite tab row. */
const FavoriteTabItem = memo(
    ({ tabId, searchQuery, onDismissPanel }: { tabId: string; searchQuery: string; onDismissPanel: () => void }) => {
        const [tabData] = useWaveObjectValue<Tab>(makeORef("tab", tabId));
        const isFavorite = tabData?.meta?.["tab:favorite"] === true;
        const tabName = tabData?.name || "Untitled";
        const tabIcon = tabData?.meta?.["tab:icon"];

        const handleClick = useCallback(() => {
            setActiveTab(tabId);
            onDismissPanel();
        }, [tabId, onDismissPanel]);

        const handleRemove = useCallback(
            (e: React.MouseEvent) => {
                e.stopPropagation();
                fireAndForget(() =>
                    ObjectService.UpdateObjectMeta(makeORef("tab", tabId), {
                        "tab:favorite": null,
                    })
                );
            },
            [tabId]
        );

        if (!isFavorite) return null;
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            if (!tabName.toLowerCase().includes(lowerQuery)) return null;
        }

        return (
            <div className="favorite-item" onClick={handleClick}>
                {tabIcon && <i className={`fa fa-${tabIcon} favorite-icon`} />}
                <span className="favorite-name">{tabName}</span>
                <button className="favorite-remove-btn" title="Remove from favorites" onClick={handleRemove}>
                    <i className="fa fa-times" />
                </button>
            </div>
        );
    }
);
FavoriteTabItem.displayName = "FavoriteTabItem";

export const FavoritesSection = memo(({ tabIds, searchQuery, onDismissPanel }: FavoritesSectionProps) => {
    const handleAddCurrentTab = useCallback(() => {
        const activeTabId = globalStore.get(atoms.staticTabId);
        if (!activeTabId) return;
        fireAndForget(() =>
            ObjectService.UpdateObjectMeta(makeORef("tab", activeTabId), {
                "tab:favorite": true,
            })
        );
    }, []);

    return (
        <div className="favorites-section">
            {tabIds.map((tabId) => (
                <FavoriteTabItem key={tabId} tabId={tabId} searchQuery={searchQuery} onDismissPanel={onDismissPanel} />
            ))}
            <button className="add-favorite-btn" onClick={handleAddCurrentTab}>
                <i className="fa fa-star" /> Add Current Tab
            </button>
        </div>
    );
});
FavoritesSection.displayName = "FavoritesSection";
