// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Display Settings
 *
 * Visual/display settings for the Appearance panel's "Display Settings" collapsible section.
 * Reuses the same SettingControl component as the General tab for consistent UI
 * (modified indicator, reset button, same row layout).
 */

import { ColorControl } from "@/app/element/settings/color-control";
import { FontControl } from "@/app/element/settings/font-control";
import { SettingControl } from "@/app/element/settings/setting-control";
import { SliderControl } from "@/app/element/settings/slider-control";
import { ToggleControl } from "@/app/element/settings/toggle-control";
import { getSettingAtom } from "@/app/store/settings-atoms";
import { getDefaultValue } from "@/app/store/settings-registry";
import { settingsService } from "@/app/store/settings-service";
import { useAtomValue } from "jotai";
import { memo, useCallback } from "react";

import "./display-settings.scss";

interface SubSectionProps {
    title: string;
    children: React.ReactNode;
}

const SubSection = memo(({ title, children }: SubSectionProps) => (
    <div className="display-subsection">
        <div className="display-subsection-title">{title}</div>
        <div className="display-subsection-content">{children}</div>
    </div>
));

SubSection.displayName = "SubSection";

export const DisplaySettings = memo(() => {
    // Window settings
    const windowTransparent = useAtomValue(getSettingAtom("window:transparent")) ?? false;
    const windowBlur = useAtomValue(getSettingAtom("window:blur")) ?? false;
    const windowOpacity = useAtomValue(getSettingAtom("window:opacity")) ?? 1;
    const windowBgcolor = useAtomValue(getSettingAtom("window:bgcolor")) ?? "";
    const windowZoom = useAtomValue(getSettingAtom("window:zoom")) ?? 1;

    // Terminal settings
    const termFontsize = useAtomValue(getSettingAtom("term:fontsize")) ?? 12;
    const termFontfamily = useAtomValue(getSettingAtom("term:fontfamily")) ?? "";
    const termLigatures = useAtomValue(getSettingAtom("term:ligatures")) ?? false;
    const termTransparency = useAtomValue(getSettingAtom("term:transparency")) ?? 0;

    // Editor settings
    const editorFontsize = useAtomValue(getSettingAtom("editor:fontsize")) ?? 12;
    const editorMinimap = useAtomValue(getSettingAtom("editor:minimapenabled")) ?? false;

    // AI settings
    const aiFontsize = useAtomValue(getSettingAtom("ai:fontsize")) ?? 14;
    const aiFixedFontsize = useAtomValue(getSettingAtom("ai:fixedfontsize")) ?? 12;

    const makeSetter = useCallback(
        (key: string) => (value: unknown) => {
            settingsService.setSetting(key, value);
        },
        []
    );

    // Cast makeSetter result for SettingControl's onChange prop type
    const makeOnChange = useCallback(
        (key: string) =>
            makeSetter(key) as (value: boolean | number | string | string[] | Record<string, unknown> | null) => void,
        [makeSetter]
    );

    return (
        <div className="display-settings">
            <SubSection title="Window">
                <SettingControl
                    settingKey="window:transparent"
                    label="Transparent Window"
                    description="Make the window background see-through. Requires a restart to take effect. Enable this before adjusting opacity or blur."
                    value={windowTransparent as boolean}
                    defaultValue={getDefaultValue("window:transparent")}
                    onChange={makeOnChange("window:transparent")}
                    isModified={settingsService.isModified("window:transparent")}
                    requiresRestart
                >
                    <ToggleControl
                        value={Boolean(windowTransparent)}
                        onChange={makeSetter("window:transparent") as (v: boolean) => void}
                    />
                </SettingControl>
                <SettingControl
                    settingKey="window:blur"
                    label="Background Blur"
                    description="Apply a frosted-glass blur effect behind the transparent window. Only visible when Transparent Window is enabled."
                    value={windowBlur as boolean}
                    defaultValue={getDefaultValue("window:blur")}
                    onChange={makeOnChange("window:blur")}
                    isModified={settingsService.isModified("window:blur")}
                >
                    <ToggleControl
                        value={Boolean(windowBlur)}
                        onChange={makeSetter("window:blur") as (v: boolean) => void}
                    />
                </SettingControl>
                <SettingControl
                    settingKey="window:opacity"
                    label="Window Opacity"
                    description="How opaque the window is, from nearly invisible (0.1) to fully solid (1.0). Only has effect when Transparent Window is enabled."
                    value={windowOpacity as number}
                    defaultValue={getDefaultValue("window:opacity")}
                    onChange={makeOnChange("window:opacity")}
                    isModified={settingsService.isModified("window:opacity")}
                >
                    <SliderControl
                        value={Number(windowOpacity)}
                        onChange={makeSetter("window:opacity") as (v: number) => void}
                        min={0.1}
                        max={1}
                        step={0.05}
                    />
                </SettingControl>
                <SettingControl
                    settingKey="window:bgcolor"
                    label="Background Color"
                    description="Override the window background with a custom color. Leave empty to use the current theme's background."
                    value={windowBgcolor as string}
                    defaultValue={getDefaultValue("window:bgcolor")}
                    onChange={makeOnChange("window:bgcolor")}
                    isModified={settingsService.isModified("window:bgcolor")}
                >
                    <ColorControl
                        value={String(windowBgcolor)}
                        onChange={makeSetter("window:bgcolor") as (v: string) => void}
                    />
                </SettingControl>
                <SettingControl
                    settingKey="window:zoom"
                    label="Interface Zoom"
                    description="Scale the entire UI up or down. Useful for high-DPI displays or if you prefer larger/smaller controls and text."
                    value={windowZoom as number}
                    defaultValue={getDefaultValue("window:zoom")}
                    onChange={makeOnChange("window:zoom")}
                    isModified={settingsService.isModified("window:zoom")}
                >
                    <SliderControl
                        value={Number(windowZoom)}
                        onChange={makeSetter("window:zoom") as (v: number) => void}
                        min={0.5}
                        max={2}
                        step={0.1}
                    />
                </SettingControl>
            </SubSection>

            <SubSection title="Terminal">
                <SettingControl
                    settingKey="term:fontsize"
                    label="Font Size"
                    description="The size of text in terminal blocks, in pixels. Affects all terminal instances."
                    value={termFontsize as number}
                    defaultValue={getDefaultValue("term:fontsize")}
                    onChange={makeOnChange("term:fontsize")}
                    isModified={settingsService.isModified("term:fontsize")}
                >
                    <SliderControl
                        value={Number(termFontsize)}
                        onChange={makeSetter("term:fontsize") as (v: number) => void}
                        min={8}
                        max={24}
                        step={1}
                    />
                </SettingControl>
                <SettingControl
                    settingKey="term:fontfamily"
                    label="Font Family"
                    description="The monospace font used for terminal text. Nerd Fonts are recommended for icon support in prompts. Leave empty for the system default."
                    value={termFontfamily as string}
                    defaultValue={getDefaultValue("term:fontfamily")}
                    onChange={makeOnChange("term:fontfamily")}
                    isModified={settingsService.isModified("term:fontfamily")}
                >
                    <FontControl
                        value={String(termFontfamily)}
                        onChange={makeSetter("term:fontfamily") as (v: string) => void}
                        showPreview={false}
                    />
                </SettingControl>
                <SettingControl
                    settingKey="term:ligatures"
                    label="Font Ligatures"
                    description="Combine multi-character sequences like => and != into single glyphs. Requires a ligature-capable font (Fira Code, JetBrains Mono, Cascadia Code)."
                    value={termLigatures as boolean}
                    defaultValue={getDefaultValue("term:ligatures")}
                    onChange={makeOnChange("term:ligatures")}
                    isModified={settingsService.isModified("term:ligatures")}
                >
                    <ToggleControl
                        value={Boolean(termLigatures)}
                        onChange={makeSetter("term:ligatures") as (v: boolean) => void}
                    />
                </SettingControl>
                <SettingControl
                    settingKey="term:transparency"
                    label="Transparency"
                    description="Make the terminal background semi-transparent so your desktop shows through. Requires Transparent Window to be enabled."
                    value={termTransparency as number}
                    defaultValue={getDefaultValue("term:transparency")}
                    onChange={makeOnChange("term:transparency")}
                    isModified={settingsService.isModified("term:transparency")}
                >
                    <SliderControl
                        value={Number(termTransparency)}
                        onChange={makeSetter("term:transparency") as (v: number) => void}
                        min={0}
                        max={1}
                        step={0.1}
                    />
                </SettingControl>
            </SubSection>

            <SubSection title="Editor">
                <SettingControl
                    settingKey="editor:fontsize"
                    label="Font Size"
                    description="The size of text in the code editor and file previews, in pixels."
                    value={editorFontsize as number}
                    defaultValue={getDefaultValue("editor:fontsize")}
                    onChange={makeOnChange("editor:fontsize")}
                    isModified={settingsService.isModified("editor:fontsize")}
                >
                    <SliderControl
                        value={Number(editorFontsize)}
                        onChange={makeSetter("editor:fontsize") as (v: number) => void}
                        min={8}
                        max={24}
                        step={1}
                    />
                </SettingControl>
                <SettingControl
                    settingKey="editor:minimapenabled"
                    label="Show Minimap"
                    description="Display a scrollable miniature overview of the file on the right side of the editor."
                    value={editorMinimap as boolean}
                    defaultValue={getDefaultValue("editor:minimapenabled")}
                    onChange={makeOnChange("editor:minimapenabled")}
                    isModified={settingsService.isModified("editor:minimapenabled")}
                >
                    <ToggleControl
                        value={Boolean(editorMinimap)}
                        onChange={makeSetter("editor:minimapenabled") as (v: boolean) => void}
                    />
                </SettingControl>
            </SubSection>

            <SubSection title="AI Panel">
                <SettingControl
                    settingKey="ai:fontsize"
                    label="Text Font Size"
                    description="The size of regular text in AI chat responses, in pixels."
                    value={aiFontsize as number}
                    defaultValue={getDefaultValue("ai:fontsize")}
                    onChange={makeOnChange("ai:fontsize")}
                    isModified={settingsService.isModified("ai:fontsize")}
                >
                    <SliderControl
                        value={Number(aiFontsize)}
                        onChange={makeSetter("ai:fontsize") as (v: number) => void}
                        min={10}
                        max={24}
                        step={1}
                    />
                </SettingControl>
                <SettingControl
                    settingKey="ai:fixedfontsize"
                    label="Code Font Size"
                    description="The size of code blocks and inline code in AI chat responses, in pixels."
                    value={aiFixedFontsize as number}
                    defaultValue={getDefaultValue("ai:fixedfontsize")}
                    onChange={makeOnChange("ai:fixedfontsize")}
                    isModified={settingsService.isModified("ai:fixedfontsize")}
                >
                    <SliderControl
                        value={Number(aiFixedFontsize)}
                        onChange={makeSetter("ai:fixedfontsize") as (v: number) => void}
                        min={8}
                        max={20}
                        step={1}
                    />
                </SettingControl>
            </SubSection>
        </div>
    );
});

DisplaySettings.displayName = "DisplaySettings";
