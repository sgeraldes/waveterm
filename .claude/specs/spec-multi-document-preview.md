# Spec: Multiple Documents in a Single Preview Block (Tabbed Document Viewer)

**Date:** 2026-03-25
**Status:** Draft
**Goal:** Allow a single preview block to hold multiple open documents navigable via an inline document tab bar, without creating new layout blocks.

---

## 1. Scope

This spec covers adding a document-level tab strip inside a preview block so a user can keep multiple files open simultaneously within the same block tile. The feature must not break single-document mode, must preserve all existing preview capabilities per tab, and must use the existing sub-block infrastructure already present in the data model.

Out of scope: drag-to-reorder tabs, tab tear-off into a new block, `wsh` CLI support for opening files in a named document tab.

---

## 2. Current Behavior

- `PreviewModel` reads a single `meta.file` key from its backing `Block` metadata to determine which file to display.
- Navigation history stored as `meta.history` and `meta["history:forward"]` (string arrays) on the same block.
- `Block` objects already have a `SubBlockIds []string` field (`pkg/waveobj/wtype.go:291`) that supports parent/child block relationships, but no preview feature currently uses it.
- A preview block's header displays the current file path as `viewText`.
- All preview view state (edit mode, file watch, specialized view type) belongs to the single active file.

---

## 3. Proposed Behavior

- A preview block can hold one or more **document tabs**. Each document tab is an independent sub-block with its own `meta.file`, `meta.history`, `meta.edit`, `meta.connection`, and editor settings.
- When two or more document tabs exist, a compact **document tab bar** (28px height) appears between the block frame header and the block content area.
- The tab bar displays: file icon (derived from mime type), the basename of the file path, and a hover-activated close button per tab. A "+" button at the right edge opens the file suggestion modal.
- Switching tabs is instantaneous (no network round-trip; WOS subscription drives the update).
- Closing the last remaining tab returns the block to single-document mode with no visible tab bar.
- Single-document mode is visually and functionally identical to the current behavior — no regression.

---

## 4. Technical Design

### 4.1 Data Model Changes

**New block metadata key:**

Add to `pkg/waveobj/wtypemeta.go` `MetaTSType`:
```go
PreviewActiveDocTab string `json:"preview:activedoctab,omitempty"`
```

Run `task generate` to propagate to `metaconsts.go` and `gotypes.d.ts`.

**Usage:** The container preview block's `meta["preview:activedoctab"]` stores the OID of the sub-block currently displayed. When absent or empty, the block is in single-doc mode.

**Sub-blocks as document tabs:** Each open document is a real `Block` object with `view: "preview"` and its own full metadata set. The container block's `SubBlockIds` array is the ordered list of all open document tabs. This uses the already-existing parent/child block infrastructure in `pkg/wcore/block.go`.

No database schema changes required.

### 4.2 Frontend Changes

**`frontend/app/view/preview/preview-model.tsx`**

New atoms:
- `subBlockIds: Atom<string[]>` — reads `blockAtom.subblockids ?? []`
- `activeDocTabId: Atom<string>` — reads `blockAtom.meta["preview:activedoctab"] ?? ""`
- `isMultiDocMode: Atom<boolean>` — `subBlockIds.length > 0`
- `subModelMap: Map<string, PreviewModel>` — instance cache

New methods:
- `async addDocTab(filePath?: string): Promise<void>` — creates sub-block, promotes to multi-doc if first extra tab, sets `preview:activedoctab`
- `async closeDocTab(subBlockId: string): Promise<void>` — selects adjacent tab, calls `DeleteSubBlockCommand`, handles last-tab transition
- `async switchDocTab(subBlockId: string): Promise<void>` — writes `preview:activedoctab`, manages file watcher lifecycle

Delegation pattern: When `isMultiDocMode` is true, all reactive atoms (`metaFilePath`, `statFile`, `fileMimeType`, `fullFile`, `fileContent`, `editMode`, etc.) delegate to the active sub-block's `PreviewModel` instance. Methods (`goHistory`, `goHistoryBack`, `handleFileSave`, `setEditMode`, `giveFocus`, etc.) also delegate.

When `isMultiDocMode` is true, `viewText` returns empty array (filename display moves to doc tab bar).

**New file: `frontend/app/view/preview/preview-doctab-bar.tsx`**

A React component that renders a horizontal scrollable tab strip. Per-tab reads `meta.file` from the sub-block. Active tab highlighted with accent-color bottom border.

**New file: `frontend/app/view/preview/preview-doctab-bar.scss`**

**`frontend/app/view/preview/preview.tsx`**

Conditionally renders `<PreviewDocTabBar>` above `<SpecializedView>` when `isMultiDocMode` is true.

**Keyboard navigation** in `PreviewModel.keyDownHandler`:
- `Ctrl+Tab` -> next doc tab
- `Ctrl+Shift+Tab` -> previous doc tab

**Shortcut priority:** `Ctrl+Tab` / `Ctrl+Shift+Tab` are used for cycling document tabs when focus is inside a multi-doc preview block. When focus is elsewhere, the global maximize-mode cycling handler takes precedence. The block-level handler in `PreviewModel.keyDownHandler` checks `isMultiDocMode` before intercepting.

### 4.3 Backend Changes

**Existing RPC command: `CreateSubBlockCommand`**

```go
type CommandCreateSubBlockData struct {
    BlockId  string            `json:"blockid"`
    BlockDef *waveobj.BlockDef `json:"blockdef"`
}
```

Wraps `wcore.CreateSubBlock`. The existing `DeleteSubBlockCommand` handles deletion.

No new RPC commands need to be added; run `task generate` only if new metadata keys are added.

### 4.4 RPC/API Changes

- Existing: `CreateSubBlockCommand` (create sub-block for document tab)
- Existing: `DeleteSubBlockCommand` (close/delete sub-block)
- Existing: `SetMetaCommand` (switch active tab, update metadata)

---

## 5. UI/UX Design

```
+--------------------------------------------------------------------------+
| [Preview]  [connection]                              [refresh] [edit] [x] |  <- block header
+--------------------------------------------------------------------------+
| [file main.go x]  [file README.md x]  [file config.json x]          [+] |  <- doc tab bar (28px)
+--------------------------------------------------------------------------+
|                                                                          |
|  (content of the active document tab)                                    |
|                                                                          |
+--------------------------------------------------------------------------+
```

**Tab bar design:**
- 28px height, hidden in single-doc mode
- Active tab: lighter background, accent-color bottom border, bold text
- Inactive tab: transparent background, secondary text color
- File icon: 12px, derived from mime type
- Filename: basename only, truncated with ellipsis
- Close button: appears on hover
- "+" button: right-aligned, always visible
- Overflow: horizontal scroll

**Entry points for adding tabs:**
1. Click "+" in doc tab bar
2. Drag file from directory preview onto multi-doc preview block
3. Block header context menu: "Open in New Document Tab"

---

## 6. Dependency Order

1. Add `PreviewActiveDocTab` meta key to `wtypemeta.go` + `task generate` (no new RPC command needed; use existing `CreateSubBlockCommand`)
2. Add multi-doc atoms and methods to `PreviewModel` (no UI yet)
3. Implement delegation pattern in `PreviewModel`
4. Build `PreviewDocTabBar` component + SCSS
5. Modify `PreviewView` to render tab bar, update drop handler
6. Implement single-doc -> multi-doc promotion flow
7. Add tests

---

## 7. Acceptance Criteria

- [ ] Preview block with no doc tabs renders identically to current behavior — no regression
- [ ] Clicking "+" opens file suggestion modal; selecting a file creates new document tab
- [ ] Each document tab maintains independent navigation history
- [ ] Each document tab maintains its own edit mode state
- [ ] Each document tab maintains its own editor settings
- [ ] Switching tabs is instantaneous (WOS subscription, no network round-trip)
- [ ] File watchers stop on deactivated tab and start on activated tab
- [ ] Closing a document tab deletes the sub-block and updates the tab bar
- [ ] Closing the last document tab returns to single-doc mode with file path and history preserved
- [ ] Dragging a file onto a multi-doc preview opens a new tab (not replacing current)
- [ ] `Ctrl+Tab` / `Ctrl+Shift+Tab` cycles document tabs
- [ ] Deleting container block cascades and deletes all document tab sub-blocks
- [ ] `go build ./...` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes with zero failures

### Accessibility
- [ ] Document tab strip items are focusable via keyboard and announce their name to screen readers
- [ ] Active tab is indicated via `aria-selected="true"`
- [ ] Close button on each tab has `aria-label="Close {filename}"`
- [ ] `Ctrl+Tab` / `Ctrl+Shift+Tab` keyboard navigation works without mouse
