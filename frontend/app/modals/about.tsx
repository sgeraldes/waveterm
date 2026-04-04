// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import Logo from "@/app/asset/logo.svg";
import { modalsModel } from "@/app/store/modalmodel";
import { Modal } from "./modal";

import { isDev } from "@/util/isdev";
import { useState } from "react";
import { getApi } from "../store/global";

interface AboutModalProps {}

const AboutModal = ({}: AboutModalProps) => {
    const currentDate = new Date();
    const [details] = useState(() => getApi().getAboutModalDetails());
    const [updaterChannel] = useState(() => getApi().getUpdaterChannel());

    return (
        <Modal className="pt-[34px] pb-[34px]" onClose={() => modalsModel.popModal()}>
            <div className="flex flex-col gap-[26px] w-full">
                <div className="flex flex-col items-center justify-center gap-4 self-stretch w-full text-center">
                    <Logo />
                    <div className="text-[25px]">SG Wave Terminal</div>
                    <div className="leading-5">
                        A heavily customized community fork of Wave Terminal
                        <br />
                        with major workflow, UI, and security upgrades.
                    </div>
                </div>
                <div className="items-center gap-4 self-stretch w-full text-center">
                    Client Version {details.version} ({isDev() ? "dev-" : ""}
                    {details.buildTime})
                    <br />
                    Update Channel: {updaterChannel}
                </div>
                <div className="flex items-start gap-[10px] self-stretch w-full text-center">
                    <a
                        href="https://github.com/sgeraldes/waveterm?ref=about"
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center px-4 py-2 rounded border border-border hover:bg-hoverbg transition-colors duration-200"
                    >
                        <i className="fa-brands fa-github mr-2"></i>Project Repo
                    </a>
                    <a
                        href="https://github.com/sgeraldes/waveterm/releases?ref=about"
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center px-4 py-2 rounded border border-border hover:bg-hoverbg transition-colors duration-200"
                    >
                        <i className="fa-sharp fa-light fa-box-archive mr-2"></i>Releases
                    </a>
                    <a
                        href="https://github.com/wavetermdev/waveterm?ref=about-upstream"
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center px-4 py-2 rounded border border-border hover:bg-hoverbg transition-colors duration-200"
                    >
                        <i className="fa-sharp fa-light fa-heart mr-2"></i>Upstream Credits
                    </a>
                </div>
                <div className="items-center gap-4 self-stretch w-full text-center">
                    Fork maintained by sgeraldes &middot; based on the original Wave Terminal project.
                </div>
            </div>
        </Modal>
    );
};

AboutModal.displayName = "AboutModal";

export { AboutModal };
