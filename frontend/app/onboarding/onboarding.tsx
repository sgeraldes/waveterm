// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import Logo from "@/app/asset/logo.svg";
import { Button } from "@/app/element/button";
import { FlexiModal } from "@/app/modals/modal";
import { OnboardingFeatures } from "@/app/onboarding/onboarding-features";
import { ClientModel } from "@/app/store/client-model";
import { disableGlobalKeybindings, enableGlobalKeybindings, globalRefocus } from "@/app/store/keymodel";
import { modalsModel } from "@/app/store/modalmodel";
import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import * as services from "@/store/services";
import { fireAndForget } from "@/util/util";
import { atom, PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { useEffect, useRef, useState } from "react";
import { debounce } from "throttle-debounce";

// Page flow:
//   init -> features
// Telemetry removed - simplified onboarding flow

type PageName = "init" | "features";

const pageNameAtom: PrimitiveAtom<PageName> = atom<PageName>("init");

const InitPage = ({ isCompact }: { isCompact: boolean }) => {
    const clientData = useAtomValue(ClientModel.getInstance().clientAtom);
    const setPageName = useSetAtom(pageNameAtom);

    const acceptTos = () => {
        if (!clientData.tosagreed) {
            fireAndForget(services.ClientService.AgreeTos);
        }
        WorkspaceLayoutModel.getInstance().setAIPanelVisible(true);
        setPageName("features");
    };

    return (
        <div className="flex flex-col h-full">
            <header
                className={`flex flex-col gap-2 border-b-0 p-0 ${isCompact ? "mt-1 mb-4" : "mb-9"} w-full unselectable flex-shrink-0`}
            >
                <div className={`${isCompact ? "" : "mb-2.5"} flex justify-center`}>
                    <Logo />
                </div>
                <div className="text-center text-[25px] font-normal text-foreground">Welcome to SG Wave Terminal</div>
                <div className="text-center text-sm text-secondary">
                    A major community fork with new workflows, stronger validation, and a refreshed UI.
                </div>
            </header>
            <OverlayScrollbarsComponent
                className="flex-1 overflow-y-auto min-h-0"
                options={{ scrollbars: { autoHide: "never" } }}
            >
                <div className="flex flex-col items-start gap-8 w-full mb-5 unselectable">
                    <div className="flex w-full items-start gap-[18px] rounded-xl border border-white/10 bg-black/20 p-4">
                        <div>
                            <a target="_blank" href="https://github.com/sgeraldes/waveterm?ref=install" rel={"noopener"}>
                                <i className="text-[32px] text-accent fa-brands fa-github"></i>
                            </a>
                        </div>
                        <div className="flex flex-col items-start gap-1 flex-1">
                            <div className="text-foreground text-base leading-[18px]">Project home</div>
                            <div className="text-secondary leading-5">
                                This build is the <i>sgeraldes</i> fork of Wave Terminal, with major additions across
                                tabs, settings, validation, terminal behavior, and visuals.
                                <br />
                                <a target="_blank" href="https://github.com/sgeraldes/waveterm?ref=install" rel={"noopener"}>
                                    github.com/sgeraldes/waveterm
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="flex w-full items-start gap-[18px] rounded-xl border border-white/10 bg-black/20 p-4">
                        <div>
                            <a target="_blank" href="https://github.com/wavetermdev/waveterm?ref=install-upstream" rel={"noopener"}>
                                <i className="text-[25px] text-white/60 fa-solid fa-code-branch"></i>
                            </a>
                        </div>
                        <div className="flex flex-col items-start gap-1 flex-1">
                            <div className="text-foreground text-base leading-[18px]">Credits to upstream</div>
                            <div className="text-secondary leading-5">
                                Originally built on top of the upstream Wave Terminal project. We keep the original repo
                                linked here for reference, comparison, and proper credit.
                                <br />
                                <a target="_blank" href="https://github.com/wavetermdev/waveterm?ref=install-upstream" rel={"noopener"}>
                                    github.com/wavetermdev/waveterm
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </OverlayScrollbarsComponent>
            <footer className={`unselectable flex-shrink-0 ${isCompact ? "mt-2" : "mt-5"}`}>
                <div className="flex flex-row items-center justify-center [&>button]:!px-5 [&>button]:!py-2 [&>button]:text-sm [&>button:not(:first-child)]:ml-2.5">
                    <Button className="font-[600]" onClick={acceptTos}>
                        Continue
                    </Button>
                </div>
            </footer>
        </div>
    );
};

const FeaturesPage = () => {
    const [newInstallOnboardingOpen, setNewInstallOnboardingOpen] = useAtom(modalsModel.newInstallOnboardingOpen);

    const handleComplete = () => {
        setNewInstallOnboardingOpen(false);
        setTimeout(() => {
            globalRefocus();
        }, 10);
    };

    return <OnboardingFeatures onComplete={handleComplete} />;
};

const NewInstallOnboardingModal = () => {
    const modalRef = useRef<HTMLDivElement | null>(null);
    const [pageName, setPageName] = useAtom(pageNameAtom);
    const clientData = useAtomValue(ClientModel.getInstance().clientAtom);
    const [isCompact, setIsCompact] = useState<boolean>(window.innerHeight < 800);

    const updateModalHeight = () => {
        const windowHeight = window.innerHeight;
        setIsCompact(windowHeight < 800);
        if (modalRef.current) {
            const modalHeight = modalRef.current.offsetHeight;
            const maxHeight = windowHeight * 0.9;
            if (maxHeight < modalHeight) {
                modalRef.current.style.height = `${maxHeight}px`;
            } else {
                modalRef.current.style.height = "auto";
            }
        }
    };

    useEffect(() => {
        if (clientData.tosagreed) {
            setPageName("features");
        }
        return () => {
            setPageName("init");
        };
    }, []);

    useEffect(() => {
        updateModalHeight();
        const debouncedUpdateModalHeight = debounce(150, updateModalHeight);
        window.addEventListener("resize", debouncedUpdateModalHeight);
        return () => {
            window.removeEventListener("resize", debouncedUpdateModalHeight);
        };
    }, []);

    useEffect(() => {
        disableGlobalKeybindings();
        return () => {
            enableGlobalKeybindings();
        };
    }, []);

    let pageComp: React.JSX.Element = null;
    switch (pageName) {
        case "init":
            pageComp = <InitPage isCompact={isCompact} />;
            break;
        case "features":
            pageComp = <FeaturesPage />;
            break;
    }
    if (pageComp == null) {
        return null;
    }

    const paddingClass = isCompact ? "!py-3 !px-[30px]" : "!p-[30px]";
    const widthClass = pageName === "features" ? "w-[800px]" : "w-[560px]";

    return (
        <FlexiModal className={`${widthClass} rounded-[10px] ${paddingClass} relative overflow-hidden`} ref={modalRef}>
            <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.25] via-transparent to-accent/[0.05] pointer-events-none rounded-[10px]" />
            <div className="flex flex-col w-full h-full relative z-10">{pageComp}</div>
        </FlexiModal>
    );
};

NewInstallOnboardingModal.displayName = "NewInstallOnboardingModal";

export { NewInstallOnboardingModal };
