# Spec: Kanban Board (TODO Evolution)

**Date:** 2026-03-25
**Status:** Draft
**Goal:** Evolve the existing `todo` view into a full Kanban board with configurable columns, cross-column drag-and-drop, and inline editing — persisted to the same markdown file via structured YAML front-matter, with zero new backend RPC commands.

---

## 1. Scope

This spec covers evolving the existing `todo` Wave block/view into a Trello-style Kanban board:

- A new `kanban` widget entry in the launcher (same `"view": "todo"` block type, `"kanban:enabled": true` meta flag)
- Three default columns: Todo, In Progress, Done
- Drag-and-drop cards between and within columns (HTML5 native drag, matching current todo.tsx pattern)
- Inline card creation and editing
- Column add/rename/delete
- Toggle between flat-list TODO mode and Kanban mode via the block header
- Automatic migration of legacy `.wave/TODO.md` flat lists into Kanban format
- Full persistence via the existing `FileReadCommand` / `FileWriteCommand` RPC — no new backend commands

Out of scope: Card labels/tags, due dates, assignees, multi-board aggregation, external sync (GitHub Issues, Linear, etc.)

---

## 2. Current Behavior

The `todo` block (`frontend/app/view/todo/`) stores tasks as GFM checkbox markdown in a file (default: `<tab:basedir>/.wave/TODO.md`). Tasks exist in one of two states: unchecked (`- [ ]`) or checked (`- [x]`). The view mode renders a flat list grouped by checked/unchecked status. Tasks can be reordered within the flat list via HTML5 drag-and-drop.

Key files:
- `frontend/app/view/todo/todo-util.ts` — `TodoItem` type, `parseTodoItems()`, `toggleTodoItem()`, `serializeTodoItems()`
- `frontend/app/view/todo/todo-model.ts` — `TodoViewModel` class, file I/O, all mutation methods
- `frontend/app/view/todo/todo.tsx` — `TodoComponent`, `TodoViewMode`, `TodoEditMode`
- Block registry: `frontend/app/block/block.tsx:58` — `BlockRegistry.set("todo", TodoViewModel)`
- Widget def: `pkg/wconfig/defaultconfig/widgets.json` — `defwidget@todo`

---

## 3. Proposed Behavior

When a block is opened with `meta["kanban:enabled"] = true`, the same `todo` view renders as a horizontal Kanban board:

- Columns scroll horizontally; each column has a scrollable card list
- Cards can be dragged to any column or reordered within a column
- "+ Add a card..." input at the bottom of each column
- Double-click a card to edit inline
- Right-click a card for context menu (Edit, Move to column, Delete)
- Double-click a column header to rename
- "+" ghost column at far right to add new columns
- Block header gains a "Switch to Kanban / Switch to List" toggle button
- Switching to Kanban migrates existing flat list (unchecked -> "Todo", checked -> "Done")
- Switching back to list converts Kanban data back to GFM checkbox markdown
- Raw edit mode (Monaco) remains accessible and shows the full file including front-matter

---

## 4. Technical Design

### 4.1 Data Model Changes

**File format:** The `.wave/TODO.md` file gains an optional YAML front-matter block encoding the Kanban state. The markdown body below the front-matter is preserved.

```yaml
---
kanban:columns:
  - id: todo
    name: Todo
    order: 0
  - id: inprogress
    name: In Progress
    order: 1
  - id: done
    name: Done
    order: 2
kanban:cards:
  - id: 4a3b2c1d-...
    col: todo
    text: "Implement login page"
    order: 1.0
  - id: 9f8e7d6c-...
    col: done
    text: "Design mockups"
    order: 1.0
---
```

**YAML parsing:** A lightweight hand-rolled parser in `kanban-util.ts`. No external YAML library.

**Parser risk mitigation:** The hand-rolled parser supports only the exact YAML subset used by the Kanban front-matter format (flat key-value pairs, arrays of objects with string/number values). It does NOT support:
- YAML anchors/aliases (`&` / `*`)
- Multi-line strings (`|` / `>`)
- Complex nested structures
- Comments within data values

If the front-matter contains unsupported YAML constructs (e.g., from manual editing in raw mode), the parser falls back gracefully: it treats the entire file as a legacy flat-list TODO and presents a non-destructive migration prompt. No data is lost.

**Alternative considered:** Using a lightweight YAML library (e.g., js-yaml, ~40KB). Rejected to avoid adding a new dependency per project conventions. If the hand-rolled parser proves insufficient during implementation, switching to JSON front-matter (trivially parseable with `JSON.parse`) is the recommended fallback — this is a spec-level decision that can be made during implementation.

**New TypeScript types** in `kanban-util.ts`:
```typescript
interface KanbanColumn { id: string; name: string; order: number; }
interface KanbanCard   { id: string; col: string; text: string; order: number; }
interface KanbanData   { columns: KanbanColumn[]; cards: KanbanCard[]; }
```

**New block meta key:** `kanban:enabled` (boolean). Added to `pkg/waveobj/wtypemeta.go`:
```go
KanbanEnabled bool `json:"kanban:enabled,omitempty"`
```
After this, `task generate` regenerates `metaconsts.go` and `gotypes.d.ts`.

### 4.2 Frontend Changes

**New files:**

| File | Purpose |
|---|---|
| `frontend/app/view/todo/kanban-util.ts` | Pure data functions: parse/serialize front-matter, migrate, reorder, CRUD |
| `frontend/app/view/todo/kanban-util.test.ts` | Unit tests for all pure functions |
| `frontend/app/view/todo/kanban-model.ts` | `KanbanViewModel` — Jotai atoms, load/save wiring |
| `frontend/app/view/todo/kanban.tsx` | React components: `KanbanBoard`, `KanbanColumn`, `KanbanCard`, `KanbanAddCard` |
| `frontend/app/view/todo/kanban.scss` | Board/column/card layout styles |

**Modified files:**

`frontend/app/view/todo/todo-model.ts`:
- Add `kanbanEnabled` atom derived from `block.meta["kanban:enabled"]`
- Update `endIconButtons` to add "Switch to Kanban / Switch to List" toggle

`frontend/app/view/todo/todo.tsx`:
- `TodoComponent` reads `kanbanEnabled`; when true, renders `<KanbanComponent>`
- Loading/error/status-bar shell is shared

`pkg/wconfig/defaultconfig/widgets.json`:
- Add `defwidget@kanban` entry with icon `table-columns`

### 4.3 Backend Changes

**`pkg/waveobj/wtypemeta.go`:** Add `KanbanEnabled bool` field.

No database migrations. No new service endpoints. No new wsh commands.

### 4.4 RPC/API Changes

None. All file I/O uses existing `FileReadCommand` and `FileWriteCommand`. Block metadata updated via existing `SetMetaCommand`.

---

## 5. UI/UX Design

**Board layout:**
```
[ Todo (3)          ] [ In Progress (1)    ] [ Done (2)           ] [ +  ]
 +------------------+  +------------------+  +------------------+
 | :: Implement     |  | :: Code review   |  | :: Design mockups|
 |    login page    |  |    PR #42        |  |                  |
 +------------------+  +------------------+  +------------------+
 +------------------+                        +------------------+
 | :: Write tests   |                        | :: Set up CI     |
 +------------------+                        +------------------+
 + Add a card...                              + Add a card...
```

**Drag-and-drop:** Native HTML5 drag events. 2px accent-color drop indicator between cards. Dragged card at 40% opacity.

**Card:** Background with 4px border-radius, drag handle on left (visible on hover), double-click to edit inline, right-click context menu.

**Column header:** Bold name + card count badge. Double-click to rename. "..." menu: Rename, Clear All Cards, Delete Column.

**Mode toggle:** Icon button in `endIconButtons`: `table-columns` (switch to Kanban) / `list-check` (switch to list).

**Status bar:** Unchanged — file path and save status.

---

## 6. Dependency Order

1. `pkg/waveobj/wtypemeta.go` change + `task generate`
2. `kanban-util.ts` + `kanban-util.test.ts` — pure logic, no React deps
3. `kanban.scss` — no code deps
4. `kanban-model.ts` — depends on step 2 and generated types
5. `kanban.tsx` — depends on steps 2, 3, 4
6. `todo-model.ts` modification — depends on generated meta key
7. `todo.tsx` modification — depends on step 5 and updated model
8. `widgets.json` addition — independent, logically last

---

## 7. Acceptance Criteria

- [ ] A "kanban" widget appears in the launcher bar with `table-columns` icon
- [ ] Opening the kanban widget creates a `todo` block with `kanban:enabled: true`
- [ ] Board renders three default columns: Todo, In Progress, Done
- [ ] Cards can be added to any column via "+ Add a card..." input
- [ ] Cards can be dragged between columns with drop indicator
- [ ] Cards can be reordered within a column via drag-and-drop
- [ ] Double-clicking card text enters inline edit mode
- [ ] Right-click on a card shows context menu: Edit, Move to [columns], Delete
- [ ] Double-clicking column header enables inline rename
- [ ] Column "..." menu provides: Rename, Clear All Cards, Delete Column
- [ ] "+" ghost column creates new columns
- [ ] "Switch to List view" button toggles back to flat TODO mode, preserving all tasks
- [ ] "Switch to Kanban view" migrates flat list into Todo/Done columns
- [ ] File content persisted with 1.5s debounce; save status indicators appear
- [ ] Raw edit mode shows full file including front-matter; round-trips correctly
- [ ] Legacy `.wave/TODO.md` without front-matter auto-migrates on first Kanban open
- [ ] Works on remote connections (file I/O via connection meta key)
- [ ] `kanban-util.test.ts` covers all pure functions
- [ ] `go build ./...` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes with zero failures

### Accessibility
- [ ] Cards can be moved between columns via keyboard (context menu "Move to" actions) without requiring drag-and-drop
- [ ] Column headers and cards are focusable via Tab key
- [ ] Drag-and-drop has `aria-live` announcements for drop position
- [ ] Inline edit inputs (card text, column name) are keyboard-accessible: Enter commits, Escape cancels
- [ ] Board is navigable with screen readers: columns announced as groups, cards as list items
