// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import * as React from "react";

interface MouseNavigableViewModel {
    goHistoryBack?: () => void;
    goHistoryForward?: () => void;
}

/**
 * Creates a mouse event handler for back/forward navigation.
 * Mouse button 3 = back, mouse button 4 = forward.
 * Gracefully no-ops for view models without navigation support.
 */
function createMouseNavigationHandler(viewModel: MouseNavigableViewModel | null) {
    return (e: React.MouseEvent | MouseEvent) => {
        if (!viewModel) return;
        if (e.button === 3) {
            e.preventDefault();
            e.stopPropagation();
            viewModel.goHistoryBack?.();
        } else if (e.button === 4) {
            e.preventDefault();
            e.stopPropagation();
            viewModel.goHistoryForward?.();
        }
    };
}

/**
 * Hook that attaches mouse button 4/5 (back/forward) navigation to a block element.
 * Uses mousedown event instead of auxclick because auxclick fires after the button is released
 * and some platforms may intercept the event before it reaches our handler.
 */
function useMouseNavigation(
    blockRef: React.RefObject<HTMLElement> | null | undefined,
    viewModel: MouseNavigableViewModel | null
): void {
    React.useEffect(() => {
        if (!blockRef) return;
        const el = blockRef.current;
        if (!el) return;

        const handler = createMouseNavigationHandler(viewModel);

        // Use mousedown for immediate response, before any platform or OS intercepts auxclick
        el.addEventListener("mousedown", handler as EventListener);
        return () => {
            el.removeEventListener("mousedown", handler as EventListener);
        };
    }, [blockRef, viewModel]);
}

export { createMouseNavigationHandler, useMouseNavigation };
export type { MouseNavigableViewModel };
