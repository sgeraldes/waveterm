// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { TermViewModel } from "@/app/view/term/term-model";
import { computeTheme } from "@/app/view/term/termutil";
import { TermWrap } from "@/app/view/term/termwrap";
import { atoms } from "@/store/global";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useRef } from "react";

interface TermThemeProps {
    blockId: string;
    termRef: React.RefObject<TermWrap>;
    model: TermViewModel;
}

const TermThemeUpdater = ({ blockId, model, termRef }: TermThemeProps) => {
    const fullConfig = useAtomValue(atoms.fullConfigAtom);
    const blockTermTheme = useAtomValue(model.termThemeNameAtom);
    const transparency = useAtomValue(model.termTransparencyAtom);

    const [theme, _] = computeTheme(fullConfig, blockTermTheme, transparency);

    // Memoize theme by serialized value to prevent unnecessary re-application.
    // computeTheme returns a new object reference each call, but if the actual
    // color values haven't changed we must not re-set terminal.options.theme,
    // because xterm.js fires onChangeColors which (with DECSET 2031) sends an
    // unsolicited CSI ?997 color-scheme report to the shell.
    const themeJson = useMemo(() => JSON.stringify(theme), [theme]);
    const prevThemeJsonRef = useRef<string | null>(null);

    useEffect(() => {
        if (themeJson === prevThemeJsonRef.current) {
            return;
        }
        prevThemeJsonRef.current = themeJson;
        if (termRef.current?.terminal) {
            termRef.current.terminal.options.theme = theme;
            // Force refresh to repaint with new colors (required for WebGL addon)
            const terminal = termRef.current.terminal;
            terminal.refresh(0, terminal.rows - 1);
        }
    }, [themeJson]);
    return null;
};

export { TermThemeUpdater };
