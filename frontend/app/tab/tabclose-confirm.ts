// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { modalsModel } from "@/app/store/modalmodel";
import { atoms, globalStore, WOS } from "@/store/global";
import { fireAndForget } from "@/util/util";

function isTabCloseConfirmEnabled(): boolean {
    const settings = globalStore.get(atoms.settingsAtom);
    return !!settings["tab:confirmclose"];
}

function isTabCloseConfirmEnabledForTab(tabId: string): boolean {
    if (!isTabCloseConfirmEnabled()) return false;
    const tabAtom = WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", tabId));
    const tabData = globalStore.get(tabAtom);
    return !tabData?.meta?.["tab:skipcloseconfirm"];
}

function showTabCloseConfirm(tabName: string, hasRunningProcess: boolean, onConfirm: () => void): void {
    modalsModel.pushModal("TabCloseConfirmModal", {
        tabName,
        hasRunningProcess,
        onConfirm: (dontAskAgain: boolean) => {
            if (dontAskAgain) {
                fireAndForget(() => RpcApi.SetConfigCommand(TabRpcClient, { "tab:confirmclose": false }));
            }
            onConfirm();
        },
    });
}

export { isTabCloseConfirmEnabled, isTabCloseConfirmEnabledForTab, showTabCloseConfirm };
