# Tab Paging/Pagination Implementation Plan

Created: 2026-02-16
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No

> **Status Lifecycle:** PENDING → COMPLETE → VERIFIED
> **Iterations:** Tracks implement→verify cycles (incremented by verify phase)
>
> - PENDING: Initial state, awaiting implementation
> - COMPLETE: All tasks implemented
> - VERIFIED: All checks passed
>
> **Approval Gate:** Implementation CANNOT proceed until `Approved: Yes`
> **Worktree:** Set at plan creation (from dispatcher). `Yes` uses git worktree isolation; `No` works directly on current branch (default)

## Summary

**Goal:** Add tab paging controls to Wave Terminal's tab bar - scroll buttons (left/right chevrons) that appear when tabs overflow, plus a dropdown menu to see and switch to all tabs at once.

**Architecture:** Extend the existing `TabBar` component in `frontend/app/tab/tabbar.tsx` with:
1. Left/right scroll buttons that conditionally render when tabs overflow
2. A tab list dropdown (popover) showing all tabs with active tab highlighted
3. Auto-scroll behavior to keep the active tab visible when switching

**Tech Stack:** React, Jotai (state), OverlayScrollbars (already in use), Popover component (existing), IconButton (existing), SCSS for styling

## Scope

### In Scope

- Scroll left/right buttons that appear only when tabs overflow
- Tab overflow dropdown menu listing all tabs with click-to-switch
- Auto-scroll active tab into view on tab switch
- Keyboard shortcut integration (existing Cmd+]/[ already works, dropdown provides visual feedback)
- Styling consistent with existing tab bar and VS Code-like appearance

### Out of Scope

- Tab pinning (different feature)
- Tab grouping/collapsing
- Drag-and-drop reordering from dropdown (already supported in tab bar itself)
- Settings to configure scroll behavior
- Tab previews/thumbnails in dropdown (deferred to avoid rendering performance overhead and UI complexity in v1; tab names and colors provide sufficient identification)

## Prerequisites

- None - builds on existing tab bar infrastructure

## Context for Implementer

> This section is critical for cross-session continuity. Write it for an implementer who has never seen the codebase.

- **Patterns to follow:**
  - Scroll buttons: Follow `IconButton` usage pattern in `tabbar.tsx:630-635` for the add-tab button
  - Dropdown: Follow `WorkspaceSwitcher` pattern in `workspaceswitcher.tsx` (see the `<Popover>` component usage) using `Popover`, `PopoverButton`, `PopoverContent`
  - State management: Use local React state for scroll position tracking, Jotai atoms only if needed for cross-component state

- **Conventions:**
  - Icons use Font Awesome: `fa-chevron-left`, `fa-chevron-right`, `fa-bars` (or `fa-caret-down`)
  - Buttons use `IconButton` component with `IconButtonDecl` type
  - Conditional rendering based on `scrollableRef.current` which already tracks overflow state
  - SCSS files named same as component (e.g., `tabbar.scss`)

- **Key files the implementer must read first:**
  - `frontend/app/tab/tabbar.tsx` - Main tab bar component (683 lines), contains OverlayScrollbars integration
  - `frontend/app/tab/tabbar.scss` - Tab bar styles (67 lines)
  - `frontend/app/tab/workspaceswitcher.tsx` - Example of dropdown in tab bar area
  - `frontend/app/element/popover.tsx` - Popover component for dropdowns
  - `frontend/app/element/iconbutton.tsx` - Icon button component

- **Gotchas:**
  - `osInstanceRef.current` is the OverlayScrollbars instance - use it for programmatic scrolling
  - `scrollableRef.current` boolean tracks if tab bar is currently scrollable (overflow detected)
  - Tab bar has `-webkit-app-region: no-drag` to prevent window dragging on tabs
  - The tab width calculation in `setSizeAndPosition()` already handles overflow detection at line 266
  - `tabWidthRef.current` contains the calculated tab width - use for scroll amount calculation

- **Domain context:**
  - Tab bar sits at the top of the Wave Terminal window, between the window drag region and workspace content
  - Tabs can be dragged to reorder (existing feature)
  - `setActiveTab(tabId)` from `global.ts` switches the active tab
  - `atoms.staticTabId` contains the current active tab ID
  - `workspace.tabids` array contains all tab IDs in order

## Runtime Environment

- **Start command:** `task dev` (Vite + Electron)
- **Port:** 9222 (dev tools), 5173 (Vite)
- **Health check:** Window renders with tab bar visible
- **Restart procedure:** Ctrl+C and re-run `task dev`, or Cmd+Shift+R for hard reload in app

## Progress Tracking

**MANDATORY: Update this checklist as tasks complete. Change `[ ]` to `[x]`.**

- [x] Task 1: Add scroll state tracking and scroll buttons
- [x] Task 2: Implement scroll button functionality
- [x] Task 3: Add tab list dropdown component
- [x] Task 4: Implement auto-scroll on active tab change
- [x] Task 5: Style and polish

**Total Tasks:** 5 | **Completed:** 5 | **Remaining:** 0

## Implementation Tasks

### Task 1: Add scroll state tracking and scroll buttons

**Objective:** Add left and right scroll buttons to the tab bar that conditionally render when tabs overflow. Track scroll position to determine which buttons should be enabled.

**Dependencies:** None

**Files:**
- Modify: `frontend/app/tab/tabbar.tsx`
- Modify: `frontend/app/tab/tabbar.scss`

**Key Decisions / Notes:**
- Add state atoms for `canScrollLeft` and `canScrollRight` (local useState, not Jotai - no cross-component need)
- Buttons should be visually disabled when at scroll boundary, not hidden entirely (prevents layout shift)
- Use `osInstanceRef.current.elements().viewport` to check scroll position
- Place scroll buttons adjacent to the tab bar: left button before tabs, right button after tabs (but before add-tab button)
- Use existing `IconButton` component with `fa-chevron-left` and `fa-chevron-right` icons
- **CRITICAL: Add scroll button refs to `nonTabElementsWidth` calculation** in `setSizeAndPosition()` BEFORE computing `spaceForTabs`. Without this, scroll buttons consuming space will cause incorrect overflow detection and potential flickering (buttons appear → reduce space → no overflow → buttons disappear → more space → overflow → repeat)
- Add a scroll event listener on `osInstanceRef.current.elements().viewport` to update `canScrollLeft`/`canScrollRight` when user scrolls via trackpad, mouse wheel, or scrollbar drag

**Definition of Done:**
- [ ] Left and right scroll buttons render when `scrollableRef.current` is true
- [ ] Buttons have disabled styling when at scroll boundaries (opacity 0.3, pointer-events none)
- [ ] Buttons are hidden (display: none) when tabs don't overflow; minor layout shift is acceptable
- [ ] Visual layout matches existing tab bar styling
- [ ] Scroll button widths are included in `nonTabElementsWidth` calculation (verify in code)
- [ ] Verify `osInstanceRef.current.elements().viewport` returns expected element in dev console before implementing scroll logic

**Verify:**
- `npm run check:ts` — TypeScript passes
- Visual inspection: Open 8+ tabs, see scroll buttons appear
- Verify no flickering when at the exact threshold of overflow

---

### Task 2: Implement scroll button functionality

**Objective:** Make the scroll buttons actually scroll the tab bar left/right by one tab width when clicked.

**Dependencies:** Task 1

**Files:**
- Modify: `frontend/app/tab/tabbar.tsx`

**Key Decisions / Notes:**
- Scroll amount should be `tabWidthRef.current` (one tab width)
- **Use `viewport.scrollTo({ left: newPosition, behavior: 'smooth' })` instead of direct `scrollLeft` assignment** - direct assignment is instant, not smooth
- Add `scroll-behavior: smooth` to `.tab-bar` in CSS as a fallback
- Implement `handleScrollLeft()` and `handleScrollRight()` handlers
- **Add scroll event listener** in a useEffect to update `canScrollLeft`/`canScrollRight` when user manually scrolls (trackpad, mouse wheel, scrollbar drag). Compute from `viewport.scrollLeft`, `viewport.scrollWidth`, and `viewport.clientWidth`. Debounce to avoid excessive re-renders.
- Handle edge case: partial tab at edge should scroll to fully reveal it
- Clean up scroll listener on component unmount and when OverlayScrollbars is destroyed

**Definition of Done:**
- [ ] Clicking left scroll button scrolls tab bar left by one tab width
- [ ] Clicking right scroll button scrolls tab bar right by one tab width
- [ ] Scroll animation is smooth (uses `scrollTo({ behavior: 'smooth' })`)
- [ ] Buttons correctly enable/disable at scroll boundaries
- [ ] Buttons update correctly when user manually scrolls via trackpad/wheel (not just button clicks)
- [ ] Scroll listener is cleaned up on unmount

**Verify:**
- `npm run check:ts` — TypeScript passes
- Manual test: Click buttons, observe smooth scrolling and button state changes
- Manual test: Scroll via trackpad, verify button states update correctly

---

### Task 3: Add tab list dropdown component

**Objective:** Add a dropdown button that shows a list of all open tabs, allowing quick switching to any tab.

**Dependencies:** Task 1

**Files:**
- Create: `frontend/app/tab/tablistdropdown.tsx`
- Create: `frontend/app/tab/tablistdropdown.scss`
- Modify: `frontend/app/tab/tabbar.tsx`

**Key Decisions / Notes:**
- Use `Popover`, `PopoverButton`, `PopoverContent` from `@/element/popover`
- Follow WorkspaceSwitcher pattern for the dropdown structure
- Show tab name (from `tabData.name`) and indicate active tab with checkmark or highlight
- Use `OverlayScrollbarsComponent` if list is long (more than ~10 tabs)
- Dropdown button icon: `fa-caret-down` or `fa-ellipsis` (vertical dots)
- Place dropdown button after right scroll button, before add-tab button
- **Use `placement='bottom-end'`** on Popover to anchor it to the right edge of the button, avoiding overlap with center tab/scroll area
- On item click: call `setActiveTab(tabId)` and close popover (dispatch Escape key event as WorkspaceSwitcher does)

**Definition of Done:**
- [ ] Dropdown button renders in tab bar (always visible when 2+ tabs exist, for quick navigation)
- [ ] Clicking dropdown shows popover with all tabs listed
- [ ] Active tab is visually highlighted in the list (checkmark icon or background color)
- [ ] Clicking a tab in dropdown switches to that tab and closes dropdown
- [ ] Dropdown is scrollable when many tabs exist (uses OverlayScrollbarsComponent)

**Verify:**
- `npm run check:ts` — TypeScript passes
- Manual test: Click dropdown, see all tabs, click to switch

---

### Task 4: Implement auto-scroll on active tab change

**Objective:** When the active tab changes (via keyboard, dropdown, or click), automatically scroll the tab bar to ensure the active tab is visible.

**Dependencies:** Task 2

**Files:**
- Modify: `frontend/app/tab/tabbar.tsx`

**Key Decisions / Notes:**
- Add useEffect that watches `activeTabId` changes
- **Use `tabRefs.current[tabIndex].current.getBoundingClientRect()` to get actual rendered tab position** - do NOT calculate from `tabIndex * tabWidthRef.current` as tab widths can change dynamically during resize/overflow transitions and the DOM position is the source of truth
- Compare tab's left/right edges against `viewport.scrollLeft` and `viewport.scrollLeft + viewport.clientWidth` to determine if tab is fully visible
- If tab is outside visible region, scroll to make it fully visible (scroll minimum distance, or center it)
- Use `viewport.scrollTo({ left: targetPosition, behavior: 'smooth' })`
- **DO NOT debounce auto-scroll** - execute immediately on activeTabId change. Debouncing causes the UI to skip intermediate tabs during rapid Cmd+]/[ presses, which is disorienting. Use requestAnimationFrame to batch updates within the same frame if needed, but don't delay across frames.

**Definition of Done:**
- [ ] Switching tabs via Cmd+]/[ scrolls the hidden tab into view
- [ ] Switching tabs via dropdown scrolls the target tab into view
- [ ] Switching tabs via Cmd+1-9 scrolls the target tab into view
- [ ] Active tab is fully visible within viewport (not cut off at edges) after scroll completes
- [ ] Wrapping from last tab to first (Cmd+]) scrolls to beginning
- [ ] Wrapping from first tab to last (Cmd+[) scrolls to end
- [ ] No-op when active tab is already fully visible (no unnecessary scroll animation)

**Verify:**
- `npm run check:ts` — TypeScript passes
- Manual test: Have 10 tabs, scroll to far right, press Cmd+1, observe scroll to first tab
- Manual test: Rapid Cmd+] presses show each tab briefly (no skipping)

---

### Task 5: Style and polish

**Objective:** Finalize visual styling to match Wave Terminal's design language and VS Code-inspired appearance.

**Dependencies:** Task 1, Task 2, Task 3, Task 4

**Files:**
- Modify: `frontend/app/tab/tabbar.scss`
- Modify: `frontend/app/tab/tablistdropdown.scss`

**Key Decisions / Notes:**
- Scroll buttons should have subtle hover states (follow existing IconButton styling)
- Dropdown should have consistent padding, hover states, and selected state styling
- Consider adding a subtle gradient/fade at tab bar edges to indicate more content
- Ensure scroll buttons don't interfere with window drag region
- Test at different zoom levels (zoomFactor is already accounted for in tab bar)
- Test with tab colors enabled (tab:color metadata)

**Definition of Done:**
- [ ] Scroll buttons have hover/active/disabled states
- [ ] Dropdown matches Wave Terminal design language
- [ ] No layout shift when scroll buttons appear/disappear
- [ ] Works correctly at different zoom levels
- [ ] Tab colors display correctly in dropdown

**Verify:**
- `npm run check:ts` — TypeScript passes
- Visual review: Check hover states, colors, disabled states
- Test with zoom: Cmd+=/- to change zoom, verify layout

## Testing Strategy

- **Unit tests:** Not required for this UI feature - complexity doesn't warrant it
- **Integration tests:** None required
- **Automated UI verification (Electron MCP):**
  1. Start `task dev` to run the app with remote debugging enabled (port 9222)
  2. Use Electron MCP `take_screenshot` to capture tab bar with 8+ tabs
  3. Verify scroll buttons visible in DOM via `send_command_to_electron(command="get_page_structure")`
  4. Check console for errors via `read_electron_logs(logType="console")` during scroll operations
  5. Verify dropdown renders with correct tab count via DOM inspection
- **Manual verification:**
  1. Create 8+ tabs to trigger overflow
  2. Verify scroll buttons appear
  3. Click scroll buttons, verify smooth scrolling
  4. Click dropdown, verify all tabs listed
  5. Select tab from dropdown, verify switch and auto-scroll
  6. Use Cmd+]/[ to switch tabs, verify auto-scroll
  7. Use Cmd+1-9 to jump to tabs, verify auto-scroll
  8. Test with tab colors enabled
  9. Test at different zoom levels

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OverlayScrollbars API incompatibility | Low | High | Verify API usage against OverlayScrollbars v2 docs (https://kingsora.github.io/OverlayScrollbars/); existing code already uses this API successfully at lines 395, 560 of tabbar.tsx |
| Circular dependency: scroll buttons affect overflow detection | High | High | Add scroll button width refs to `nonTabElementsWidth` calculation in `setSizeAndPosition()` BEFORE computing `spaceForTabs`. This ensures overflow threshold accounts for button space. |
| Layout shift when buttons appear | Medium | Low | Accept minor layout shift; buttons only show when overflow occurs, which is an intentional state change |
| Performance with many tabs in dropdown | Low | Low | Use OverlayScrollbarsComponent for native scrolling; if tab count exceeds 30, consider virtualization in future iteration |
| Stale scroll button states after manual scroll | Medium | Medium | Add scroll event listener on viewport element that updates `canScrollLeft`/`canScrollRight`; debounce handler; clean up on unmount |
| Tab position race condition during resize | Medium | Medium | Use `getBoundingClientRect()` on actual tab element for auto-scroll position, not calculated `index * tabWidth` which may be stale |

## Open Questions

None - requirements are clear.
