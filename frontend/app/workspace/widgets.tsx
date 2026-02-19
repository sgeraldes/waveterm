import { Tooltip } from "@/app/element/tooltip";
import { ContextMenuModel } from "@/app/store/contextmenu";
import { ShellSelectorFloatingWindow } from "@/app/workspace/shell-selector";
import { atoms, createBlock, globalStore, isDev } from "@/store/global";
import { fireAndForget, isBlank, makeIconClass } from "@/util/util";
import clsx from "clsx";
import { useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useRef, useState } from "react";

function sortByDisplayOrder(wmap: { [key: string]: WidgetConfigType }): WidgetConfigType[] {
    if (wmap == null) {
        return [];
    }
    const wlist = Object.values(wmap);
    wlist.sort((a, b) => {
        return (a["display:order"] ?? 0) - (b["display:order"] ?? 0);
    });
    return wlist;
}

async function handleWidgetSelect(widget: WidgetConfigType) {
    const blockDef: BlockDef = {
        ...widget.blockdef,
        meta: { ...widget.blockdef?.meta },
    };

    const tabData = globalStore.get(atoms.activeTab);
    let tabBaseDir = tabData?.meta?.["tab:basedir"];

    if (tabBaseDir && tabBaseDir.trim() !== "") {
        try {
            const { validateTabBasedir } = await import("@/store/tab-basedir-validator");
            const validationResult = await validateTabBasedir(tabData.oid, tabBaseDir);
            if (!validationResult.valid) {
                console.warn(
                    `[widgets] Tab basedir validation failed at use-time: ${tabBaseDir} (${validationResult.reason}). Not using for widget.`
                );
                tabBaseDir = null;
            }
        } catch (error) {
            console.error("[widgets] Failed to validate tab basedir:", error);
            tabBaseDir = null;
        }
    }

    if (tabBaseDir) {
        if (blockDef?.meta?.view === "term" && !blockDef.meta["cmd:cwd"]) {
            blockDef.meta["cmd:cwd"] = tabBaseDir;
        }
        if (blockDef?.meta?.view === "preview" && blockDef.meta.file === "~") {
            blockDef.meta.file = tabBaseDir;
        }
    }

    createBlock(blockDef, widget.magnified);
}

const Widget = memo(({ widget, mode }: { widget: WidgetConfigType; mode: "normal" | "compact" | "supercompact" }) => {
    const [isTruncated, setIsTruncated] = useState(false);
    const [isShellSelectorOpen, setIsShellSelectorOpen] = useState(false);
    const labelRef = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<HTMLDivElement>(null);

    const isTerminalWidget = widget.blockdef?.meta?.view === "term";

    useEffect(() => {
        if (mode === "normal" && labelRef.current) {
            const element = labelRef.current;
            setIsTruncated(element.scrollWidth > element.clientWidth);
        }
    }, [mode, widget.label]);

    const shouldDisableTooltip = (mode !== "normal" ? false : !isTruncated) || isShellSelectorOpen;

    const handleClick = () => {
        if (isTerminalWidget) {
            setIsShellSelectorOpen((prev) => !prev);
        } else {
            handleWidgetSelect(widget);
        }
    };

    return (
        <>
            <div ref={widgetRef}>
                <Tooltip
                    content={widget.description || widget.label}
                    placement="left"
                    disable={shouldDisableTooltip}
                    divClassName={clsx(
                        "flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-secondary overflow-hidden rounded-sm hover:bg-hoverbg hover:text-white cursor-pointer",
                        mode === "supercompact" ? "text-sm" : "text-lg",
                        widget["display:hidden"] && "hidden"
                    )}
                    divOnClick={handleClick}
                >
                    <div style={{ color: widget.color }}>
                        <i className={makeIconClass(widget.icon, true, { defaultIcon: "browser" })}></i>
                    </div>
                    {mode === "normal" && !isBlank(widget.label) ? (
                        <div
                            ref={labelRef}
                            className="text-xxs mt-0.5 w-full px-0.5 text-center whitespace-nowrap overflow-hidden text-ellipsis"
                        >
                            {widget.label}
                        </div>
                    ) : null}
                </Tooltip>
            </div>
            {isTerminalWidget && widgetRef.current && (
                <ShellSelectorFloatingWindow
                    isOpen={isShellSelectorOpen}
                    onClose={() => setIsShellSelectorOpen(false)}
                    referenceElement={widgetRef.current}
                />
            )}
        </>
    );
});

const Widgets = memo(() => {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);
    const hasCustomAIPresets = useAtomValue(atoms.hasCustomAIPresetsAtom);
    const [mode, setMode] = useState<"normal" | "compact" | "supercompact">("normal");
    const containerRef = useRef<HTMLDivElement>(null);
    const measurementRef = useRef<HTMLDivElement>(null);

    const widgetsMap = fullConfig?.widgets ?? {};
    const filteredWidgets = hasCustomAIPresets
        ? widgetsMap
        : Object.fromEntries(Object.entries(widgetsMap).filter(([key]) => key !== "defwidget@ai"));
    const widgets = sortByDisplayOrder(filteredWidgets);

    const checkModeNeeded = useCallback(() => {
        if (!containerRef.current || !measurementRef.current) return;

        const containerHeight = containerRef.current.clientHeight;
        const normalHeight = measurementRef.current.scrollHeight;
        const gracePeriod = 10;

        let newMode: "normal" | "compact" | "supercompact" = "normal";

        if (normalHeight > containerHeight - gracePeriod) {
            newMode = "compact";

            const totalWidgets = (widgets?.length || 0) + 1;
            const minHeightPerWidget = 32;
            const requiredHeight = totalWidgets * minHeightPerWidget;

            if (requiredHeight > containerHeight) {
                newMode = "supercompact";
            }
        }

        if (newMode !== mode) {
            setMode(newMode);
        }
    }, [mode, widgets]);

    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            checkModeNeeded();
        });

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, [checkModeNeeded]);

    useEffect(() => {
        checkModeNeeded();
    }, [widgets, checkModeNeeded]);

    const handleWidgetsBarContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const menu: ContextMenuItem[] = [
            {
                label: "Edit widgets.json",
                click: () => {
                    fireAndForget(async () => {
                        const blockDef: BlockDef = {
                            meta: {
                                view: "waveconfig",
                                file: "widgets.json",
                            },
                        };
                        await createBlock(blockDef, false, true);
                    });
                },
            },
        ];
        ContextMenuModel.showContextMenu(menu, e);
    };

    const openHelp = () => fireAndForget(async () => createBlock({ meta: { view: "help" } }));
    const openTips = () => fireAndForget(async () => createBlock({ meta: { view: "tips" } }, true, true));
    const openSettings = () => fireAndForget(async () => createBlock({ meta: { view: "waveconfig" } }, false, true));

    const bottomButtonClass = clsx(
        "flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-secondary overflow-hidden rounded-sm hover:bg-hoverbg hover:text-white cursor-pointer",
        mode === "supercompact" ? "text-sm" : "text-lg"
    );

    const bottomButtons = (
        <>
            <div className="border-t border-border mx-1 my-1 opacity-40" />
            <Tooltip content="Help" placement="left">
                <div className={bottomButtonClass} onClick={openHelp}>
                    <i className={makeIconClass("circle-question", true)}></i>
                </div>
            </Tooltip>
            <Tooltip content="Tips" placement="left">
                <div className={bottomButtonClass} onClick={openTips}>
                    <i className={makeIconClass("lightbulb", true)}></i>
                </div>
            </Tooltip>
            <Tooltip content="Settings" placement="left">
                <div className={bottomButtonClass} onClick={openSettings}>
                    <i className={makeIconClass("gear", true)}></i>
                </div>
            </Tooltip>
        </>
    );

    return (
        <>
            <div
                ref={containerRef}
                className="flex flex-col w-12 overflow-hidden py-1 -ml-1 select-none"
                onContextMenu={handleWidgetsBarContextMenu}
            >
                {mode === "supercompact" ? (
                    <>
                        <div className="grid grid-cols-2 gap-0 w-full">
                            {widgets?.map((data, idx) => (
                                <Widget key={`widget-${idx}`} widget={data} mode={mode} />
                            ))}
                        </div>
                        <div className="flex-grow" />
                        {bottomButtons}
                    </>
                ) : (
                    <>
                        {widgets?.map((data, idx) => (
                            <Widget key={`widget-${idx}`} widget={data} mode={mode} />
                        ))}
                        <div className="flex-grow" />
                        {bottomButtons}
                    </>
                )}
                {isDev() ? (
                    <div
                        className="flex justify-center items-center w-full py-1 text-accent text-[30px]"
                        title="Running Wave Dev Build"
                    >
                        <i className="fa fa-brands fa-dev fa-fw" />
                    </div>
                ) : null}
            </div>

            <div
                ref={measurementRef}
                className="flex flex-col w-12 py-1 -ml-1 select-none absolute -z-10 opacity-0 pointer-events-none"
            >
                {widgets?.map((data, idx) => (
                    <Widget key={`measurement-widget-${idx}`} widget={data} mode="normal" />
                ))}
                <div className="flex-grow" />
                <div className="border-t border-border mx-1 my-1" />
                <div className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-lg">
                    <i className={makeIconClass("circle-question", true)}></i>
                </div>
                <div className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-lg">
                    <i className={makeIconClass("lightbulb", true)}></i>
                </div>
                <div className="flex flex-col justify-center items-center w-full py-1.5 pr-0.5 text-lg">
                    <i className={makeIconClass("gear", true)}></i>
                </div>
                {isDev() ? (
                    <div
                        className="flex justify-center items-center w-full py-1 text-accent text-[30px]"
                        title="Running Wave Dev Build"
                    >
                        <i className="fa fa-brands fa-dev fa-fw" />
                    </div>
                ) : null}
            </div>
        </>
    );
});

export { Widgets };
