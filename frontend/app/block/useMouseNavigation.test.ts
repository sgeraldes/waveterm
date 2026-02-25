// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from "vitest";
import { createMouseNavigationHandler } from "./useMouseNavigation";

describe("createMouseNavigationHandler", () => {
    it("should call goHistoryBack when button 3 is pressed", () => {
        const viewModel = {
            goHistoryBack: vi.fn(),
            goHistoryForward: vi.fn(),
        };
        const handler = createMouseNavigationHandler(viewModel as any);
        const event = { button: 3, preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
        handler(event);
        expect(viewModel.goHistoryBack).toHaveBeenCalledTimes(1);
        expect(viewModel.goHistoryForward).not.toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it("should call goHistoryForward when button 4 is pressed", () => {
        const viewModel = {
            goHistoryBack: vi.fn(),
            goHistoryForward: vi.fn(),
        };
        const handler = createMouseNavigationHandler(viewModel as any);
        const event = { button: 4, preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
        handler(event);
        expect(viewModel.goHistoryForward).toHaveBeenCalledTimes(1);
        expect(viewModel.goHistoryBack).not.toHaveBeenCalled();
    });

    it("should not call any method for other buttons", () => {
        const viewModel = {
            goHistoryBack: vi.fn(),
            goHistoryForward: vi.fn(),
        };
        const handler = createMouseNavigationHandler(viewModel as any);
        const event = { button: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
        handler(event);
        expect(viewModel.goHistoryBack).not.toHaveBeenCalled();
        expect(viewModel.goHistoryForward).not.toHaveBeenCalled();
    });

    it("should handle missing goHistoryBack gracefully", () => {
        const viewModel = {
            goHistoryForward: vi.fn(),
        };
        const handler = createMouseNavigationHandler(viewModel as any);
        const event = { button: 3, preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
        expect(() => handler(event)).not.toThrow();
    });

    it("should handle null viewModel gracefully", () => {
        const handler = createMouseNavigationHandler(null);
        const event = { button: 3, preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
        expect(() => handler(event)).not.toThrow();
    });
});
