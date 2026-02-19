import { atom } from "jotai";
import { atoms } from "./global";
import { globalStore } from "./jotaiStore";
import { ObjectService, WorkspaceService } from "./services";
import * as WOS from "./wos";

export interface RecentlyClosedEntry {
    id: string;
    name: string;
    color: string;
    icon: string;
    closedAt: number;
}

const MAX_ENTRIES = 20;
const STORAGE_KEY = "waveterm:recently-closed";

function loadFromStorage(): RecentlyClosedEntry[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveToStorage(entries: RecentlyClosedEntry[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
        console.log("failed to save recently closed tabs", e);
    }
}

export const recentlyClosedTabsAtom = atom<RecentlyClosedEntry[]>(loadFromStorage());

export function addRecentlyClosed(tabData: Tab) {
    const entry: RecentlyClosedEntry = {
        id: crypto.randomUUID(),
        name: tabData?.name || "Tab",
        color: tabData?.meta?.["tab:color"] || "",
        icon: tabData?.meta?.["tab:icon"] || "",
        closedAt: Date.now(),
    };
    const current = globalStore.get(recentlyClosedTabsAtom);
    const updated = [entry, ...current].slice(0, MAX_ENTRIES);
    globalStore.set(recentlyClosedTabsAtom, updated);
    saveToStorage(updated);
}

export function removeRecentlyClosed(id: string) {
    const current = globalStore.get(recentlyClosedTabsAtom);
    const updated = current.filter((e) => e.id !== id);
    globalStore.set(recentlyClosedTabsAtom, updated);
    saveToStorage(updated);
}

export function clearRecentlyClosed() {
    globalStore.set(recentlyClosedTabsAtom, []);
    saveToStorage([]);
}

export async function reopenTab(entry: RecentlyClosedEntry): Promise<string> {
    const windowData = WOS.getObjectValue<WaveWindow>(
        WOS.makeORef("window", globalStore.get(atoms.uiContext).windowid)
    );
    if (!windowData?.workspaceid) {
        return null;
    }
    const newTabId = await WorkspaceService.CreateTab(windowData.workspaceid, entry.name, true);
    const meta: MetaType = {};
    if (entry.color) meta["tab:color"] = entry.color;
    if (entry.icon) meta["tab:icon"] = entry.icon;
    if (Object.keys(meta).length > 0) {
        await ObjectService.UpdateObjectMeta(WOS.makeORef("tab", newTabId), meta);
    }
    removeRecentlyClosed(entry.id);
    return newTabId;
}
