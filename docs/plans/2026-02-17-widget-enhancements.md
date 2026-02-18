# Widget Enhancements Implementation Plan

Created: 2026-02-17
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

**Goal:** Enhance Wave Terminal with 6 major features: mouse button 4/5 back/forward navigation, drag-and-drop to viewer, open-in-default-viewer, a slim tree view widget synced with tab base directory, project notes widget with image paste support, and a TODO widget with markdown checkboxes and image support.

**Architecture:**
- Mouse button navigation uses `auxclick` event listeners at the block frame level, delegating to view model's goHistoryBack/Forward
- Tree View is a new widget type (`treeview`) with its own view model, rendering a collapsible file tree synced to tab:basedir
- Notes and TODO widgets are specialized versions of the existing preview/codeedit view, with paste image support
- Image pasting saves to `.wave/images/` relative to tab:basedir and inserts markdown image references
- Drag-and-drop to viewer extends the existing useDrop infrastructure in preview components

**Tech Stack:**
- React + TypeScript (frontend)
- Jotai atoms (state management)
- react-dnd (drag and drop)
- Existing RPC infrastructure (FileReadCommand, FileWriteCommand)
- Monaco editor (for notes/todo editing)

## Scope

### In Scope

- Mouse button 4/5 (back/forward) navigation for preview, webview, and directory views
- Drag files from directory view to preview viewer to open them
- Context menu "Open in Default Viewer" option using existing `openNativePath` IPC
- New Tree View widget - slim hierarchical file tree synced with tab:basedir
- New Project Notes widget - markdown editor with image paste support
- New TODO widget - markdown checkbox list with image paste support
- Image paste handling - save to `.wave/images/` and insert markdown reference
- Terminal widget shell selector submenu (like settings menu, but for shells)
- Sidebar redesign: standalone Help, Tips, Settings buttons (no submenu)

### Out of Scope

- Complex TODO features (due dates, priorities, recurring tasks) - keeping it simple with markdown checkboxes
- Tree view editing operations (rename, delete, create) - read-only for now
- Git integration in tree view (status indicators)
- Remote file support for image paste (local connection only for now)
- Permanent sidebar panel for tree view - using standard widget block

## Prerequisites

- Familiarity with Wave Terminal's block/widget architecture
- Understanding of existing preview-model.tsx patterns
- Knowledge of Jotai atom-based state management

## Context for Implementer

> This section is critical for cross-session continuity. Write it for an implementer who has never seen the codebase.

- **Patterns to follow:**
  - View models in `frontend/app/view/*/` implement the `ViewModel` interface
  - Block registration in `frontend/app/block/block.tsx:43-54` (BlockRegistry)
  - Widget definitions in `pkg/wconfig/defaultconfig/widgets.json`
  - Tab base directory accessed via `atoms.activeTab?.meta?.["tab:basedir"]`
  - File operations use `RpcApi.FileReadCommand`, `RpcApi.FileWriteCommand`

- **Conventions:**
  - View components are in `frontend/app/view/<viewname>/`
  - Models end with `Model` or `ViewModel` suffix
  - SCSS co-located with components
  - Use `fireAndForget()` for async click handlers

- **Key files:**
  - `frontend/app/block/block.tsx` - BlockRegistry, view creation
  - `frontend/app/view/preview/preview-model.tsx` - Reference for file-based view model
  - `frontend/app/workspace/widgets.tsx` - Widget sidebar, tab:basedir inheritance
  - `frontend/types/custom.d.ts:117` - `openNativePath` API declaration
  - `emain/emain-ipc.ts:357` - `open-native-path` IPC handler

- **Gotchas:**
  - Promise atoms must use `loadable()` wrapper to avoid React suspense issues (just fixed in preview)
  - Mouse event `button` property: 3=back, 4=forward (browser standard)
  - Tab:basedir validation required before use (see `tab-basedir-validator.ts`)
  - `getApi().openNativePath(path)` only works for local files (no remote support)

- **Domain context:**
  - Tab base directory (`tab:basedir`) is an optional per-tab setting that sets the "project root"
  - Widgets inherit tab:basedir when launched from sidebar
  - Preview view supports multiple specialized views: directory, codeedit, markdown, streaming

## Progress Tracking

**MANDATORY: Update this checklist as tasks complete. Change `[ ]` to `[x]`.**

- [x] Task 1: Mouse Button 4/5 Navigation Handler
- [x] Task 2: Drag-and-Drop File to Preview Viewer
- [x] Task 3: Open in Default Viewer Context Menu
- [x] Task 4: Tree View Widget Core
- [x] Task 5: Tree View File System Integration
- [x] Task 6: Image Paste Handler Utility
- [x] Task 7: Project Notes Widget
- [x] Task 8: TODO Widget
- [x] Task 9: Terminal Shell Selector Submenu
- [x] Task 10: Sidebar Widget Layout Redesign

**Total Tasks:** 10 | **Completed:** 10 | **Remaining:** 0

## Implementation Tasks

### Task 1: Mouse Button 4/5 Navigation Handler

**Objective:** Add mouse back/forward button support to navigate history in all widgets that support navigation (preview, webview, directory view, and any future widgets implementing the history interface).

**Dependencies:** None

**Files:**
- Create: `frontend/app/block/useMouseNavigation.ts`
- Modify: `frontend/app/block/blockframe.tsx` - Add hook usage
- Modify: `frontend/app/view/webview/webview.tsx` - Add goHistoryBack/goHistoryForward wrapper methods to WebViewModel

**Key Decisions / Notes:**
- Use `auxclick` event (fires for non-primary mouse buttons)
- `event.button === 3` = back button, `event.button === 4` = forward button
- Check if view model has `goHistoryBack`/`goHistoryForward` methods before calling
- Apply to BlockFrame component so ALL blocks automatically get the behavior
- **WebViewModel fix:** WebViewModel currently uses `webviewRef.current.goBack()/goForward()` directly. Add wrapper methods `goHistoryBack()` and `goHistoryForward()` to WebViewModel that delegate to webviewRef
- Any widget implementing goHistoryBack/goHistoryForward will work automatically
- Only trigger when the block is focused to avoid conflicts
- Fallback to `mousedown` event with button check for platforms where auxclick may not fire reliably

**Definition of Done:**
- [ ] All tests pass (unit, integration if applicable)
- [ ] No diagnostics errors (linting, type checking)
- [ ] Mouse button 4 triggers back navigation in all widgets with history support
- [ ] Mouse button 5 triggers forward navigation in all widgets with history support
- [ ] WebViewModel has goHistoryBack/goHistoryForward wrapper methods
- [ ] Navigation only works when block is focused
- [ ] No-op gracefully for widgets without history support (terminals, sysinfo, etc.)

**Verify:**
- `npx tsc --noEmit` - TypeScript passes
- Manual test: Open file preview, navigate into folder, press mouse back button

---

### Task 2: Drag-and-Drop File to Preview Viewer

**Objective:** Allow dragging files from directory view and dropping them onto the preview/codeedit content area to OPEN them (distinct from the existing COPY drop behavior in directory lists).

**Dependencies:** Task 1 (for testing flow)

**Files:**
- Modify: `frontend/app/view/preview/preview.tsx` - Add useDrop to content area (SpecializedView wrapper)
- Modify: `frontend/app/view/preview/preview-edit.tsx` - Add drop zone overlay
- Modify: `frontend/app/view/preview/preview-streaming.tsx` - Add drop zone overlay

**Key Decisions / Notes:**
- **Distinction from copy:** Existing `useDrop` in preview-directory.tsx (line 765) handles FILE_ITEM for COPYING files into directories. This task adds a NEW drop zone on the content area for OPENING files
- Create drop zone wrapper around the `SpecializedView` component (not the directory list)
- Use existing `FILE_ITEM` drag type (defined in preview-directory.tsx:515)
- On drop, call `model.goHistory(droppedFile.uri)` to OPEN the file (not copy)
- Show visual drop overlay ("Open {filename}") when dragging over content area
- Drop zone is only active when NOT in directory view (directory view already has copy behavior)
- Reject drops when source file is from a different connection than the block

**Definition of Done:**
- [ ] All tests pass (unit, integration if applicable)
- [ ] No diagnostics errors (linting, type checking)
- [ ] Can drag file from directory view to preview view to open it
- [ ] Visual feedback shows when hovering over valid drop zone
- [ ] Directory drops work in directory view mode
- [ ] Drop zone correctly rejects invalid drops

**Verify:**
- `npx tsc --noEmit` - TypeScript passes
- Manual test: Open directory in preview, drag file to another preview block

---

### Task 3: Open in Default Viewer Context Menu

**Objective:** Add "Open in Default Viewer" option to file context menus that opens files with the OS default application.

**Dependencies:** None

**Files:**
- Modify: `frontend/app/view/preview/preview-directory.tsx` - Add context menu item
- Modify: `frontend/app/view/preview/preview-model.tsx` - Add to settings menu
- Modify: `frontend/util/previewutil.ts` - Add helper for open in default

**Key Decisions / Notes:**
- Use existing `getApi().openNativePath(filePath)` which calls `electron.shell.openPath`
- Add to directory view right-click context menu for files
- Add to preview header settings menu for current file
- Only available for local files (not remote connections)
- Check connection before showing option
- **Error handling:** `electron.shell.openPath` returns a promise with error message if no default app is set. Show toast notification with the error message (e.g., "No application associated with this file type")

**Definition of Done:**
- [ ] All tests pass (unit, integration if applicable)
- [ ] No diagnostics errors (linting, type checking)
- [ ] Right-click file in directory shows "Open in Default Viewer"
- [ ] Clicking opens file in OS default application (e.g., VS Code for .ts)
- [ ] Option hidden for remote connections
- [ ] Preview header menu includes "Open in Default Viewer" option
- [ ] Error toast shown when no default app is available

**Verify:**
- `npx tsc --noEmit` - TypeScript passes
- Manual test: Right-click .txt file, select "Open in Default Viewer"

---

### Task 4: Tree View Widget Core

**Objective:** Create a new tree view widget that displays a collapsible hierarchical file tree.

**Dependencies:** None

**Files:**
- Create: `frontend/app/view/treeview/treeview.tsx` - Main component
- Create: `frontend/app/view/treeview/treeview-model.ts` - View model
- Create: `frontend/app/view/treeview/treeview.scss` - Styles
- Modify: `frontend/app/block/block.tsx` - Register TreeViewModel
- Modify: `pkg/wconfig/defaultconfig/widgets.json` - Add defwidget@treeview

**Key Decisions / Notes:**
- Follow existing view model pattern from PreviewModel
- Use recursive TreeNode component for rendering
- Track expanded/collapsed state in atom (persist per-tree instance)
- Support keyboard navigation (up/down arrows, enter to expand)
- Single-click to select, double-click to open in preview
- Slim design: icon + filename only, no file size/date columns

**Definition of Done:**
- [ ] All tests pass (unit, integration if applicable)
- [ ] No diagnostics errors (linting, type checking)
- [ ] Tree view widget appears in widget list
- [ ] Clicking widget launches tree view block
- [ ] Folders display with expand/collapse arrows
- [ ] Files display with appropriate icons
- [ ] Keyboard navigation works (up/down/enter)

**Verify:**
- `npx tsc --noEmit` - TypeScript passes
- Manual test: Add treeview widget, see tree structure render

---

### Task 5: Tree View File System Integration

**Objective:** Connect tree view to file system and sync with tab:basedir.

**Dependencies:** Task 4

**Files:**
- Modify: `frontend/app/view/treeview/treeview-model.ts` - Add file loading logic
- Modify: `frontend/app/view/treeview/treeview.tsx` - Handle loading states

**Key Decisions / Notes:**
- Use `RpcApi.FileReadCommand` with directory mimetype to list files
- Lazy-load child directories on expand (don't load entire tree at once)
- Subscribe to tab:basedir changes via atom
- When tab:basedir changes, reset tree root and reload
- **Tab basedir fallback:** If tab:basedir is empty or "~", show home directory as root. Display info message: "Set tab base directory to focus on a project"
- **Symlink handling:** Track visited directory paths to detect circular references; mark symlinks with special icon; limit expansion depth to 20 levels
- Handle errors gracefully (show error state, retry button)
- Respect showHiddenFiles setting (reuse from preview)
- **Remote connections:** Tree view works with remote connections; uses same connection as the tab

**Definition of Done:**
- [ ] All tests pass (unit, integration if applicable)
- [ ] No diagnostics errors (linting, type checking)
- [ ] Tree view shows files from tab:basedir (or home if empty)
- [ ] Expanding folder loads its contents
- [ ] Changing tab:basedir updates tree root
- [ ] Loading states display while fetching
- [ ] Errors show with retry option
- [ ] Circular symlink references are detected and handled

**Verify:**
- `npx tsc --noEmit` - TypeScript passes
- Manual test: Set tab base dir, open tree view, expand folders

---

### Task 6: Image Paste Handler Utility

**Objective:** Create reusable utility for pasting images from clipboard, saving to `.wave/images/`, and returning markdown reference.

**Dependencies:** None

**Files:**
- Create: `frontend/app/util/image-paste.ts` - Image paste handler utility
- Modify: `frontend/types/custom.d.ts` - Add type declarations if needed

**Key Decisions / Notes:**
- Check clipboard for image data (`clipboardData.items` with type `image/*`)
- Generate filename: `YYYY-MM-DD-{random8chars}.png` (8 chars for lower collision probability)
- **Directory creation:** Use `RpcApi.FileMkdirCommand` to create `.wave/images/` directory before saving
- Save to `{tab:basedir}/.wave/images/{filename}` using FileWriteCommand
- Return relative markdown reference: `![](.wave/images/{filename})`
- **Tab basedir fallback:** If tab:basedir is empty or "~", use user home directory (`~/.wave/images/`)
- Handle errors (no clipboard access, write failure, mkdir failure)
- Only works for local connections (check connection before paste)
- Show toast notification on success/failure

**Definition of Done:**
- [ ] All tests pass (unit, integration if applicable)
- [ ] No diagnostics errors (linting, type checking)
- [ ] Utility can detect image in clipboard
- [ ] Utility creates .wave/images/ directory using FileMkdirCommand if not exists
- [ ] Utility saves image to .wave/images/ folder
- [ ] Utility returns markdown image reference
- [ ] Falls back to home directory when tab:basedir is empty
- [ ] Handles errors gracefully with clear messages

**Verify:**
- `npx tsc --noEmit` - TypeScript passes
- Unit test for filename generation and markdown reference format

---

### Task 7: Project Notes Widget

**Objective:** Create a notes widget that edits markdown files with image paste support.

**Dependencies:** Task 6

**Files:**
- Create: `frontend/app/view/notes/notes.tsx` - Notes component
- Create: `frontend/app/view/notes/notes-model.ts` - Notes view model
- Create: `frontend/app/view/notes/notes.scss` - Styles
- Modify: `frontend/app/block/block.tsx` - Register NotesViewModel
- Modify: `pkg/wconfig/defaultconfig/widgets.json` - Add defwidget@notes

**Key Decisions / Notes:**
- Extend/compose with existing codeedit (Monaco editor) functionality
- Default file: `{tab:basedir}/.wave/NOTES.md` if no file specified
- **Tab basedir fallback:** If tab:basedir is empty or "~", use `~/.wave/NOTES.md` (user home)
- Support multiple notes via meta.file property
- **Monaco paste handling:** Use `editor.onDidPaste()` event; check if clipboard contains image vs text; if image, prevent default and insert markdown reference; if text, let Monaco handle normally
- Show "New Note" button when file doesn't exist (creates file on first save)
- Auto-save on blur or 1500ms after last keystroke (debounced)
- Show "Saved" indicator briefly after save completes
- **Remote connections:** Notes widget works with remote connections; image paste disabled for remote (shows tooltip explaining local-only)

**Definition of Done:**
- [ ] All tests pass (unit, integration if applicable)
- [ ] No diagnostics errors (linting, type checking)
- [ ] Notes widget appears in widget list
- [ ] Opening creates/opens .wave/NOTES.md (or ~/.wave/NOTES.md if no basedir)
- [ ] Markdown editing works with syntax highlighting
- [ ] Pasting image inserts markdown reference (local connections only)
- [ ] Changes auto-save with visual indicator
- [ ] Can specify different note file via metadata
- [ ] Works with remote connections (image paste disabled)

**Verify:**
- `npx tsc --noEmit` - TypeScript passes
- Manual test: Open notes, type content, paste image from clipboard

---

### Task 8: TODO Widget

**Objective:** Create a TODO widget with markdown checkbox list and image support.

**Dependencies:** Task 6

**Files:**
- Create: `frontend/app/view/todo/todo.tsx` - TODO component
- Create: `frontend/app/view/todo/todo-model.ts` - TODO view model
- Create: `frontend/app/view/todo/todo.scss` - Styles
- Modify: `frontend/app/block/block.tsx` - Register TodoViewModel
- Modify: `pkg/wconfig/defaultconfig/widgets.json` - Add defwidget@todo

**Key Decisions / Notes:**
- Use markdown checkbox format: `- [ ] Task` / `- [x] Done`
- Default file: `{tab:basedir}/.wave/TODO.md`
- **Tab basedir fallback:** If tab:basedir is empty or "~", use `~/.wave/TODO.md` (user home)
- Render as interactive checklist (clickable checkboxes)
- **View/Edit toggle:** Double-click on non-checkbox area to enter edit mode; header toggle button to switch modes; auto-save and return to view mode on blur
- View mode: show rendered checkboxes using custom React component (not Monaco), click to toggle checkbox state
- Edit mode: raw markdown editing with Monaco and image paste support
- Include "Add Task" quick input at bottom (visible in view mode)
- **Checkbox toggle:** View mode uses direct DOM manipulation to toggle [ ]/[x] and saves immediately; preserves scroll position
- **Remote connections:** TODO widget works with remote connections; image paste disabled for remote

**Definition of Done:**
- [ ] All tests pass (unit, integration if applicable)
- [ ] No diagnostics errors (linting, type checking)
- [ ] TODO widget appears in widget list
- [ ] View mode shows checkboxes that can be clicked to toggle
- [ ] Edit mode allows markdown editing with Monaco
- [ ] Toggle between view/edit modes (double-click or header button)
- [ ] Pasting image works in edit mode (local connections only)
- [ ] File syncs to .wave/TODO.md (or ~/.wave/TODO.md if no basedir)
- [ ] Scroll position preserved when toggling checkboxes

**Verify:**
- `npx tsc --noEmit` - TypeScript passes
- Manual test: Open TODO, add task, check it off, paste image

---

---

### Task 9: Terminal Shell Selector Submenu

**Objective:** Add a shell selector submenu to the terminal widget (like the settings floating menu) that shows all available shells to launch.

**Dependencies:** None

**Files:**
- Modify: `frontend/app/workspace/widgets.tsx` - Add shell selector floating menu to terminal widget
- Create: `frontend/app/workspace/shell-selector.tsx` - Shell selector floating menu component
- Create: `frontend/app/workspace/shell-selector.scss` - Styles

**Key Decisions / Notes:**
- Terminal widget gets a similar floating menu to the current settings menu
- On click, show floating menu with list of all available shells
- Get shells from existing shell profile system (see `pkg/wconfig/defaultconfig/shellprofiles/`)
- Each shell option shows: icon, shell name (e.g., "bash", "zsh", "PowerShell")
- Clicking a shell opens new terminal with that shell
- Reuse existing `createBlock` with appropriate shell configuration
- Menu positioned to the left of the terminal widget button (same as current settings menu)

**Definition of Done:**
- [ ] All tests pass (unit, integration if applicable)
- [ ] No diagnostics errors (linting, type checking)
- [ ] Clicking terminal widget shows shell selector menu
- [ ] All available shells displayed in menu
- [ ] Clicking a shell opens new terminal with that shell
- [ ] Menu positioning matches settings menu style

**Verify:**
- `npx tsc --noEmit` - TypeScript passes
- Manual test: Click terminal widget, see shell options, click one to open terminal

---

### Task 10: Sidebar Widget Layout Redesign

**Objective:** Redesign the sidebar widget bar: add standalone Help and Tips buttons above Settings, and simplify the Settings button to open settings directly (no submenu).

**Dependencies:** Task 9 (to not conflict with shell selector changes)

**Files:**
- Modify: `frontend/app/workspace/widgets.tsx` - Restructure bottom section of widget bar

**Key Decisions / Notes:**
- Remove the SettingsFloatingWindow submenu (Settings, Tips, Secrets, Help)
- Add three standalone buttons at bottom of widget bar (above dev indicator):
  1. **Help** button - opens Help block directly on click
  2. **Tips** button - opens Tips block directly on click (magnified)
  3. **Settings** button - opens Settings block directly on click (no submenu)
- Secrets access moves to Settings panel (already accessible there)
- Each button has tooltip on hover
- Buttons use same styling as existing widget icons
- Order from bottom: Settings, Tips, Help, then separator, then regular widgets above

**Definition of Done:**
- [ ] All tests pass (unit, integration if applicable)
- [ ] No diagnostics errors (linting, type checking)
- [ ] Help button visible at bottom of sidebar, opens Help on click
- [ ] Tips button visible at bottom of sidebar, opens Tips on click
- [ ] Settings button opens settings directly (no submenu)
- [ ] Secrets submenu removed (accessible via Settings panel)
- [ ] Tooltips work on all buttons

**Verify:**
- `npx tsc --noEmit` - TypeScript passes
- Manual test: Click each button, verify correct block opens

---

## Testing Strategy

- **Unit tests:** Image paste utility filename generation, markdown reference format
- **Integration tests:** Tree view file loading, widget block creation
- **Manual verification:**
  - Mouse button 4/5 navigation in preview and webview
  - Drag-and-drop file from directory to preview
  - Open in Default Viewer for various file types
  - Tree view expand/collapse and navigation
  - Notes and TODO image paste workflow
  - Tab:basedir synchronization across widgets
  - Terminal shell selector menu functionality
  - Sidebar Help/Tips/Settings button redesign

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Image paste fails on WSL/remote | Medium | Medium | Check for local connection before enabling paste; show "local only" tooltip |
| Tree view performance with large directories | Medium | Low | Lazy-load children on expand; limit visible items; virtual scrolling if needed |
| Monaco editor paste event conflicts | Low | Medium | Use Monaco's built-in paste handling; attach listener at correct layer |
| Checkbox toggle causes cursor jump | Low | Low | Preserve cursor position after checkbox state update |
| .wave folder permissions on Windows | Low | Medium | Use existing FileWriteCommand which handles permissions; catch and display errors |

## Open Questions

- Should tree view support file operations (create, rename, delete) in a future iteration?
- Should TODO support task filtering (show completed/incomplete)?
- Should Notes have a split view (edit + preview)?

### Deferred Ideas

- Git status indicators in tree view (modified/untracked file highlighting)
- TODO due dates and priorities (would require JSON format)
- Global search across notes
- Note templates
- Recursive checkbox (parent checkbox state reflects children)
