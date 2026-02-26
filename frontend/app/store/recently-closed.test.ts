
import { createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

const { mockStore } = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createStore } = require("jotai");
    return { mockStore: createStore() };
});

vi.mock("./jotaiStore", () => ({
    globalStore: mockStore,
}));

vi.mock("./services", () => ({
    WorkspaceService: { CreateTab: vi.fn() },
    ObjectService: { UpdateObjectMeta: vi.fn() },
}));

vi.mock("./wos", () => ({
    getObjectValue: vi.fn(),
    makeORef: vi.fn((otype: string, oid: string) => `${otype}:${oid}`),
}));

vi.mock("./global", () => ({
    atoms: {
        uiContext: null,
    },
}));

import {
    addRecentlyClosed,
    clearRecentlyClosed,
    recentlyClosedTabsAtom,
    removeRecentlyClosed,
} from "./recently-closed";

function makeTabData(name: string, color: string, icon: string): Tab {
    return {
        otype: "tab",
        oid: "test-tab-id",
        version: 1,
        name,
        layoutstate: "",
        blockids: [],
        meta: { "tab:color": color, "tab:icon": icon },
    } as Tab;
}

describe("recentlyClosedTabsAtom", () => {
    beforeEach(() => {
        localStorageMock.clear();
        mockStore.set(recentlyClosedTabsAtom, []);
    });

    it("should initialize with empty array when localStorage is empty", () => {
        const entries = mockStore.get(recentlyClosedTabsAtom);
        expect(entries).toEqual([]);
    });
});

describe("addRecentlyClosed", () => {
    beforeEach(() => {
        localStorageMock.clear();
        mockStore.set(recentlyClosedTabsAtom, []);
    });

    it("should add a tab entry with name, color, and icon", () => {
        const tab = makeTabData("My Tab", "green", "rocket");
        addRecentlyClosed(tab);

        const entries = mockStore.get(recentlyClosedTabsAtom);
        expect(entries).toHaveLength(1);
        expect(entries[0].name).toBe("My Tab");
        expect(entries[0].color).toBe("green");
        expect(entries[0].icon).toBe("rocket");
        expect(entries[0].id).toBeTruthy();
        expect(entries[0].closedAt).toBeGreaterThan(0);
    });

    it("should prepend new entries (most recent first)", () => {
        addRecentlyClosed(makeTabData("First", "", ""));
        addRecentlyClosed(makeTabData("Second", "", ""));

        const entries = mockStore.get(recentlyClosedTabsAtom);
        expect(entries).toHaveLength(2);
        expect(entries[0].name).toBe("Second");
        expect(entries[1].name).toBe("First");
    });

    it("should limit to 20 entries", () => {
        for (let i = 0; i < 25; i++) {
            addRecentlyClosed(makeTabData(`Tab ${i}`, "", ""));
        }

        const entries = mockStore.get(recentlyClosedTabsAtom);
        expect(entries).toHaveLength(20);
        expect(entries[0].name).toBe("Tab 24");
    });

    it("should persist to localStorage", () => {
        addRecentlyClosed(makeTabData("Persisted", "blue", "star"));
        expect(localStorageMock.setItem).toHaveBeenCalledWith("waveterm:recently-closed", expect.any(String));
        const stored = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)[1]);
        expect(stored[0].name).toBe("Persisted");
    });

    it("should default name to 'Tab' when tab name is empty", () => {
        const tab = makeTabData("", "", "");
        addRecentlyClosed(tab);

        const entries = mockStore.get(recentlyClosedTabsAtom);
        expect(entries[0].name).toBe("Tab");
    });
});

describe("removeRecentlyClosed", () => {
    beforeEach(() => {
        localStorageMock.clear();
        mockStore.set(recentlyClosedTabsAtom, []);
    });

    it("should remove an entry by id", () => {
        addRecentlyClosed(makeTabData("Tab A", "", ""));
        addRecentlyClosed(makeTabData("Tab B", "", ""));

        const entries = mockStore.get(recentlyClosedTabsAtom);
        const idToRemove = entries[0].id;
        removeRecentlyClosed(idToRemove);

        const updated = mockStore.get(recentlyClosedTabsAtom);
        expect(updated).toHaveLength(1);
        expect(updated[0].name).toBe("Tab A");
    });

    it("should do nothing when id not found", () => {
        addRecentlyClosed(makeTabData("Tab A", "", ""));
        removeRecentlyClosed("nonexistent-id");

        const entries = mockStore.get(recentlyClosedTabsAtom);
        expect(entries).toHaveLength(1);
    });
});

describe("clearRecentlyClosed", () => {
    beforeEach(() => {
        localStorageMock.clear();
        mockStore.set(recentlyClosedTabsAtom, []);
    });

    it("should remove all entries", () => {
        addRecentlyClosed(makeTabData("Tab A", "", ""));
        addRecentlyClosed(makeTabData("Tab B", "", ""));
        clearRecentlyClosed();

        const entries = mockStore.get(recentlyClosedTabsAtom);
        expect(entries).toHaveLength(0);
    });

    it("should persist empty array to localStorage", () => {
        addRecentlyClosed(makeTabData("Tab A", "", ""));
        clearRecentlyClosed();

        const lastCall = localStorageMock.setItem.mock.calls.at(-1);
        expect(lastCall[0]).toBe("waveterm:recently-closed");
        expect(JSON.parse(lastCall[1])).toEqual([]);
    });
});
