// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { modalsModel } from "@/app/store/modalmodel";
import { atoms, getAllBlockComponentModels, getBlockComponentModel, globalStore, WOS } from "@/store/global";
import { getBlockingCommand } from "@/app/view/term/shellblocking";

function isBlockCloseConfirmEnabled(): boolean {
    const settings = globalStore.get(atoms.settingsAtom);
    return !!settings["block:confirmclose"];
}

function blockHasRunningProcess(blockId: string): boolean {
    const blockAtom = WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", blockId));
    const blockData = globalStore.get(blockAtom);
    if (blockData?.meta?.view !== "term") {
        return false;
    }
    const bcm = getBlockComponentModel(blockId);
    if (!bcm || !bcm.viewModel) {
        return false;
    }
    const viewModel = bcm.viewModel as any;
    if (!viewModel.termRef?.current) {
        return false;
    }
    const termRef = viewModel.termRef.current;
    const lastCommand = (globalStore.get(termRef.lastCommandAtom) ?? null) as string | null;
    const inAltBuffer = termRef.terminal?.buffer?.active?.type === "alternate";
    return getBlockingCommand(lastCommand, inAltBuffer) !== null;
}

function tabHasRunningProcess(tabId: string): boolean {
    const tabAtom = WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", tabId));
    const tabData = globalStore.get(tabAtom);
    if (!tabData?.blockids) {
        return false;
    }
    for (const blockId of tabData.blockids) {
        if (blockHasRunningProcess(blockId)) {
            return true;
        }
    }
    return false;
}

function showBlockCloseConfirm(blockId: string, blockName: string, onConfirm: () => void): void {
    modalsModel.pushModal("BlockCloseConfirmModal", { blockName, onConfirm });
}

export { blockHasRunningProcess, isBlockCloseConfirmEnabled, showBlockCloseConfirm, tabHasRunningProcess };
