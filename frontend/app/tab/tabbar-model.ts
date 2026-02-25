// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { globalStore } from "@/app/store/jotaiStore";
import { atom, type PrimitiveAtom } from "jotai";

export class TabBarModel {
    private static instance: TabBarModel | null = null;

    jigglePinAtom: PrimitiveAtom<number> = atom(0);

    private constructor() {
        // Empty for now
    }

    static getInstance(): TabBarModel {
        if (!TabBarModel.instance) {
            TabBarModel.instance = new TabBarModel();
        }
        return TabBarModel.instance;
    }

    jiggleActivePinnedTab() {
        globalStore.set(this.jigglePinAtom, (prev) => prev + 1);
    }
}
