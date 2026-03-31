// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Modal } from "@/app/modals/modal";
import { modalsModel } from "@/app/store/modalmodel";
import { useState } from "react";

interface TabCloseConfirmModalProps {
    tabName: string;
    hasRunningProcess: boolean;
    onConfirm: (dontAskAgain: boolean) => void;
}

const TabCloseConfirmModal = ({ tabName, hasRunningProcess, onConfirm }: TabCloseConfirmModalProps) => {
    const displayName = tabName || "this tab";
    const [dontAskAgain, setDontAskAgain] = useState(false);

    const handleConfirm = () => {
        modalsModel.popModal();
        onConfirm(dontAskAgain);
    };

    const handleCancel = () => {
        modalsModel.popModal();
    };

    return (
        <Modal
            className="pt-6 pb-4 px-5"
            onOk={handleConfirm}
            onCancel={handleCancel}
            onClose={handleCancel}
            onClickBackdrop={handleCancel}
            okLabel="Close Tab"
            cancelLabel="Cancel"
        >
            <div className="flex flex-col gap-2">
                <div className="font-bold text-lg">Close Tab?</div>
                <div className="text-secondary text-sm leading-relaxed">
                    {hasRunningProcess ? (
                        <>
                            Are you sure you want to close <strong>{displayName}</strong>? This tab has a running
                            process that will be terminated.
                        </>
                    ) : (
                        <>
                            Are you sure you want to close <strong>{displayName}</strong>?
                        </>
                    )}
                </div>
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none mt-1">
                    <input
                        type="checkbox"
                        checked={dontAskAgain}
                        onChange={(e) => setDontAskAgain(e.target.checked)}
                        className="cursor-pointer"
                    />
                    Don't ask again
                </label>
            </div>
        </Modal>
    );
};

TabCloseConfirmModal.displayName = "TabCloseConfirmModal";

export { TabCloseConfirmModal };
