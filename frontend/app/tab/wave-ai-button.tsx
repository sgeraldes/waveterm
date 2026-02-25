import { WorkspaceLayoutModel } from "@/app/workspace/workspace-layout-model";
import { useAtomValue } from "jotai";
import { memo } from "react";

export const WaveAIButton = memo(() => {
    const aiPanelOpen = useAtomValue(WorkspaceLayoutModel.getInstance().panelVisibleAtom);

    const onClick = () => {
        const currentVisible = WorkspaceLayoutModel.getInstance().getAIPanelVisible();
        WorkspaceLayoutModel.getInstance().setAIPanelVisible(!currentVisible);
    };

    return (
        <button
            type="button"
            className={`flex h-[24px] px-1.5 justify-end items-center rounded-md mr-1 mb-0.5 box-border cursor-pointer hover:bg-white/5 transition-colors text-[12px] border-0 bg-transparent ${aiPanelOpen ? "text-accent" : "text-secondary"}`}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            onClick={onClick}
            aria-label="Toggle AI panel"
        >
            <i className="fa fa-sparkles" />
            <span className="font-bold ml-1 -top-px font-mono">AI</span>
        </button>
    );
});
WaveAIButton.displayName = "WaveAIButton";
