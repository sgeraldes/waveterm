// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Modal } from "@/app/modals/modal";
import { modalsModel } from "@/app/store/modalmodel";

interface BlockCloseConfirmModalProps {
    blockName: string;
    onConfirm: () => void;
}

const BlockCloseConfirmModal = ({ blockName, onConfirm }: BlockCloseConfirmModalProps) => {
    const handleConfirm = () => {
        modalsModel.popModal();
        onConfirm();
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
            okLabel="Close Terminal"
            cancelLabel="Cancel"
        >
            <div className="flex flex-col gap-2">
                <div className="font-bold text-lg">Close Terminal?</div>
                <div className="text-secondary text-sm leading-relaxed">
                    This terminal has a running process. Closing will terminate it.
                </div>
            </div>
        </Modal>
    );
};

BlockCloseConfirmModal.displayName = "BlockCloseConfirmModal";

export { BlockCloseConfirmModal };
