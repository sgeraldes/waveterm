# Spec: Widget Pop-Out into Standalone Electron Windows

**Date:** 2026-03-25
**Status:** Draft
**Goal:** Allow any Wave Terminal block to be detached from its tab layout into a standalone Electron window and re-attached to any tab's layout.

---

## 1. Scope

This spec covers the complete design for widget pop-out and pop-in. It supersedes `.claude/specs/spec-002-widget-popout.md`.

**In scope:**
- Pop-out via title bar button (Flow 1)
- Pop-out via drag outside window boundary (Flow 2)
- Pop-in via title bar button / close button (returns to origin tab)
- Pop-in via drag into layout (Flow 3)
- Pop-in via drag to different tab with hover-switch (Flow 4)
- Widget window lifecycle, IPC architecture, and drag session protocol
- Layout hidden-node system for position preservation
- Directory-bound widget handling for notes/todo
- Keyboard shortcuts
- Persistence model — no widget windows survive app restart
- Accessibility

**Out of scope:**
- Block creation from within widget windows
- Drag-and-drop directly between two widget windows
- Persisting widget window size/position across restarts

---

## 2. Current Behavior

Wave Terminal's layout is a tile-based system managed by `LayoutModel` (`frontend/layout/lib/layoutModel.ts`). Every block lives inside a `LayoutNode` in the tree stored as a `LayoutState` Wave object. `TileLayout` (`frontend/layout/lib/TileLayout.tsx`) renders the tree with react-dnd for intra-tab DnD.

The main window is `WaveBrowserWindow extends BaseWindow` (`emain/emain-window.ts:137`). Tabs are `WaveTabView extends WebContentsView` (`emain/emain-tabview.ts:115`) added as child views.

`LayoutNode` (`frontend/layout/lib/types.ts:302`) fields: `id`, `data` (holds `blockId`), `children`, `flexDirection`, `size`. No `hidden` field exists today.

There is currently no mechanism to move a block outside the tab layout.

---

## 3. Proposed Behavior

Any block in any tab can be "popped out" into a standalone Electron `BrowserWindow`. The popped-out window:
- Contains only that block in a minimal shell (no tab bar, no layout chrome)
- Stays live — block data is backend-owned and WOS subscriptions function normally
- Can be moved to any monitor; resizable down to 300x200
- Supports always-on-top toggle
- Can be dragged back over the main window to re-insert into any tab layout
- Closing or clicking Return returns the block to its original position — the block is **never deleted**

On app restart, all pop-out state is cleared. Every launch opens with a clean layout.

---

## 4. Technical Design

### 4.1 Data Model Changes

#### Widget Classification

| Widget type | Classification | Pop-out behavior | Warning shown |
|-------------|---------------|-----------------|---------------|
| `term` | Context-free | Block rendered standalone | No warning |
| `web` | Context-free | Block rendered standalone | No warning |
| `preview` | Context-free | Block rendered standalone | No warning |
| `notes` | Directory-bound | Absolute file path snapshotted | On cross-basedir drop |
| `todo` | Directory-bound | Absolute file path snapshotted | On cross-basedir drop |
| Multi-session `term` (MT) | Context-free | All sub-sessions rendered in widget window | No warning; all sub-tabs preserved |
| Multi-doc `preview` (MD) | Context-free | All document tabs rendered in widget window | No warning; all doc tabs preserved |

#### Block Metadata Extensions

New fields in `MetaTSType` (`pkg/waveobj/wtypemeta.go`):

```go
BlockPoppedOut     *bool  `json:"block:poppedout,omitempty"`
BlockOriginTab     string `json:"block:origintab,omitempty"`
BlockOriginTabName string `json:"block:origintabname,omitempty"`
BlockOriginBaseDir string `json:"block:originbasedir,omitempty"`
BlockLayoutNodeId  string `json:"block:layoutnodeid,omitempty"`
```

Run `task generate` after to regenerate `metaconsts.go` and `gotypes.d.ts`.

#### Settings Extensions

New fields in `SettingsType` (`pkg/wconfig/settingsconfig.go`):

```go
WidgetPopTabHoverMs     *int64 `json:"widget:poptabhoverms,omitempty"`
WidgetPopoutEnabled     *bool  `json:"widget:popoutenabled,omitempty"`
WidgetPopoutAlwaysOnTop *bool  `json:"widget:popoutalwaysontop,omitempty"`
```

Defaults in `settings.json`: `poptabhoverms: 800`, `popoutenabled: true`, `popoutalwaysontop: true`.

#### Layout Hidden Node System

`LayoutNode` gains `hidden?: boolean`. New action types `HideNode` and `UnhideNode`. `LayoutModel` gets `hideNodeByBlockId` and `unhideNodeByBlockId` methods. Hidden nodes are excluded from `leafs` but retained in the tree for position restoration.

#### Hidden Node Impact on Layout Actions

The following `LayoutTreeActionType` handlers (14 total in `types.ts:74-96`) must handle hidden nodes correctly:

| Action | Hidden Node Behavior |
|--------|---------------------|
| `Move` | Skip hidden nodes as drop targets; moving a visible node adjacent to a hidden one is valid |
| `Swap` | Cannot swap with a hidden node; reject silently |
| `InsertNode` | May insert adjacent to a hidden node; hidden node does not affect geometry |
| `DeleteNode` | Can delete a hidden node (cleans up orphans) |
| `ResizeNode` | Hidden nodes have no resize handles; skip in resize calculations |
| `FocusNode` | Cannot focus a hidden node; `FocusNode` on a hidden blockId is a no-op |
| `MagnifyNodeToggle` | Cannot magnify a hidden node; reject silently |
| `ClearTree` | Clears ALL nodes including hidden ones |
| `SetLeafOrder` | Hidden nodes are excluded from leaf ordering |
| `HideNode` | Sets `hidden: true` on target node |
| `UnhideNode` | Clears `hidden` on target node, triggers geometry recalculation |

**Implementation approach:** The `leafs` atom computation in `LayoutModel` already filters nodes. Most actions operate on `leafs` or `leafOrder`, so hidden nodes are naturally excluded. Only `Move`, `Swap`, `InsertNode`, `DeleteNode`, and `ClearTree` operate on the raw tree and need explicit hidden-node guards.

**Alternative considered:** Removing the node entirely on pop-out and restoring from saved coordinates on pop-in. Rejected because: (a) it loses the exact tree position, making same-position restoration unreliable after layout changes by other nodes; (b) `SubBlockIds` cleanup on parent deletion wouldn't cascade correctly if the node is detached from the tree.

#### Ownership Invariant

| State | `block:poppedout` | Layout node | Widget window |
|---|---|---|---|
| Embedded | false/absent | Present, visible | No |
| Popped-out | true | Present, **hidden** | Yes |
| Cross-tab embedded | false | Present in target tab | No |

The layout node is **never deleted** during pop-out.

### 4.2 Frontend Changes

#### Title Bar Pop-Out Button

`frontend/app/block/blockframe-header.tsx` — Add pop-out button between custom end-icons and magnify. Shows pop-in icon in widget windows.

Main window: `[custom] [pop-out] [magnify] [maximize] [close]`
Widget window: `[pin] [return] [close]`

#### Widget Window Renderer

New directory: `frontend/widget-window/`
- `widget.html` — Minimal template
- `widget.ts` — Lean entrypoint (single-block WOS, no workspace/tab/layout init)
- `widget-app.tsx` — Root React component
- `widget-frame.tsx` — Custom title bar + `BlockFrame` reuse
- `widget.scss` — Window styles

Vite config needs new entry point for `widget.html`.

#### Layout Hidden Node Rendering

`TileLayout.tsx` — `leafs` excludes hidden nodes. New `WidgetDropOverlay` component for drag-to-layout targeting.

#### Tab Header Hover Indicator

`tabbar.tsx` — Progress fill along bottom border during drag-over, animated over `widget:poptabhoverms` ms. Respects `prefers-reduced-motion`.

### 4.3 Backend Changes

#### Startup Cleanup

`emain/emain.ts` — `cleanupPoppedOutState()` called before window creation:
- Clear all `block:poppedout` flags
- Unhide all hidden layout nodes
- Clear origin metadata and file overrides

#### `WaveWidgetWindow` Class

New file: `emain/emain-widget.ts`

Uses `BrowserWindow` (not `BaseWindow`). Platform-specific options:
- macOS: `frame: false`, `transparent: true`, `vibrancy: "fullscreen-ui"`
- Windows: `frame: false`, `backgroundMaterial: "acrylic"`
- Linux: `frame: false`

Min size 300x200. Loads `widget.html?blockId=...&originTabId=...`.

#### Pop-Out Transaction

1. Validate block exists and not already popped out
2. Snapshot origin metadata (tab basedir, tab name, layout node id)
3. For notes/todo: compute absolute file path
4. Write metadata via ObjectService
5. Hide layout node
6. Create WaveWidgetWindow
7. On failure: rollback all changes

#### Pop-In Transaction

Same-tab: unhide node, clear metadata, destroy window.
Cross-tab: reparent block (update ParentORef, BlockIds on both tabs), remove old layout node, insert new one, clear metadata, destroy window.

### 4.4 RPC/API Changes

#### IPC Channels

| Channel | Direction | Payload |
|---|---|---|
| `widget:popout-request` | Renderer -> Main | `{ blockId, originTabId, bounds }` |
| `widget:popout-complete` | Main -> Renderer | `{ blockId, windowId }` |
| `widget:popout-failed` | Main -> Renderer | `{ blockId, reason }` |
| `widget:popin-request` | Widget -> Main | `{ blockId }` |
| `widget:popin-complete` | Main -> Renderer | `{ blockId, tabId }` |
| `widget:drag-enter/leave` | Main -> Renderer | `{ sessionId, blockId }` |
| `widget:cursor-position` | Main -> Renderer | `{ sessionId, x, y }` |
| `widget:tab-hover` | Main -> Renderer | `{ sessionId, tabId, progress }` |
| `widget:drop` | Main -> Renderer | `{ sessionId, blockId, x, y }` |
| `widget:confirm-move` | Main -> Renderer | `{ blockId, sourceDir, targetDir }` |
| `widget:confirm-response` | Renderer -> Main | `{ blockId, confirmed }` |
| `widget:always-on-top` | Widget -> Main | `{ blockId, value }` |
| `widget:update-tab-bounds` | Renderer -> Main | `{ tabBounds[] }` |

All exposed via `ElectronApi` in `custom.d.ts` and `preload.ts`.

---

## 5. UI/UX Design

### Widget Window Chrome

```
+--------------------------------------------------------------+
| [icon] Widget Title  [project badge]  [pin] [return] [close] |  ~30px
+--------------------------------------------------------------+
|                                                               |
|                    Block Content                               |
|                                                               |
+--------------------------------------------------------------+
```

- Project badge: pill with tab color, shows `basename(block:originbasedir)`. Only for notes/todo.
- Pin: toggles always-on-top, highlighted when active.
- Return/Close: both return block to tab, never delete.
- Title bar: `-webkit-app-region: drag`, buttons `no-drag`.

### Drag Pop-Out (Flow 2)

Cursor exits main window by >=20px -> cancel react-dnd -> pop-out transaction -> `startMoveOrResize('move')` for seamless drag continuation.

### Drop Zone Overlay (Flow 3)

Widget over main window: dim overlay + existing `OverlayNode` drop zones. Widget opacity 70%. Amber zones for directory-bound widgets on different-basedir tabs.

### Cross-Tab Hover (Flow 4)

Tab border fills with accent color over 800ms. Tab switches on timer completion. Moving off resets.

### Directory-Bound Confirmation

Dialog when notes/todo dropped on different-basedir tab. Informational, not blocking. ARIA-compliant.

### Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|---|---|---|
| Pop out/in focused block | `Cmd+Shift+O` | `Ctrl+Shift+O` |
| Pop all back in | `Cmd+Shift+Alt+O` | `Ctrl+Shift+Alt+O` |
| Toggle always-on-top (pin) | `Cmd+Shift+P` | `Ctrl+Shift+P` |
| Focus next/prev widget | `Cmd+Shift+]`/`[` | `Ctrl+Shift+]`/`[` |
| Focus main window | `Cmd+Shift+M` | `Ctrl+Shift+M` |

---

## 6. Dependency Order

```
[A] Block Metadata (Go types + codegen)
[B] Settings Extensions
[C] LayoutNode hidden field + actions
[D] WaveWidgetWindow class shell
[E] Widget renderer entrypoint + Vite

A+B+C+D -> [F] Pop-Out Transaction + IPC handlers + startup cleanup
F -> [G] Title Bar Button
F -> [H] Keyboard Shortcuts
F+E -> [I] Widget-specific snapshots (notes, todo, treeview)
F -> [J] Pop-In Transaction
G+J -> working end-to-end via buttons
J -> [K] Drag Pop-Out (Flow 2)
J -> [L] Drop Detection (Flow 3) + WidgetDropOverlay
J -> [M] Directory-Bound Confirmation
K+L -> [N] Cross-Tab Pop-In (Flow 4)
```

Independent (parallelizable): A, B, C, D, E

---

## 7. Acceptance Criteria

### Pop-Out (Flow 1)
- [ ] Pop-out button creates `WaveWidgetWindow` within 500ms
- [ ] Widget window appears at block's screen position and size
- [ ] Widget renders correct block view via existing ViewModel pipeline
- [ ] Block disappears from main layout (hidden node)
- [ ] `block:poppedout = true` persisted in block metadata
- [ ] Pop-out button disabled during in-flight transaction

### Pop-In
- [ ] Return and Close both return block to original position in origin tab
- [ ] All origin metadata cleared after pop-in
- [ ] Widget window destroyed; main window focused; restored block focused
- [ ] Block is **never deleted** by any close path

### Persistence
- [ ] On restart, all `block:poppedout` flags cleared
- [ ] All hidden layout nodes unhidden on startup
- [ ] No widget windows appear on startup

### Origin Tab Closed
- [ ] Widget window stays open
- [ ] Badge shows "(tab name — closed)"
- [ ] Return/Close adopts block into current active tab

### Drag Pop-Out (Flow 2)
- [ ] Cursor >=20px outside window initiates pop-out
- [ ] React-dnd cancelled cleanly before pop-out
- [ ] `startMoveOrResize('move')` on macOS/Windows for seamless drag

### Drag Pop-In (Flow 3)
- [ ] Widget over main window shows drop overlay
- [ ] Widget opacity 70% during overlap
- [ ] Drop zones highlight; placeholder preview shown
- [ ] Releasing over zone inserts block

### Cross-Tab Pop-In (Flow 4)
- [ ] Tab hover shows progress fill
- [ ] Tab switches after `widget:poptabhoverms` continuous hover
- [ ] Stale sessionIds discarded (no timer poisoning)
- [ ] Cross-tab drop updates ParentORef and BlockIds correctly

### Directory-Bound Widgets
- [ ] Pop-out snapshots absolute file path
- [ ] Same-basedir drop: no dialog, file override cleared
- [ ] Different-basedir drop: confirmation dialog, ARIA-compliant
- [ ] User confirms: pop-in succeeds, file override retained
- [ ] User cancels: block returns to widget window

### Error Handling
- [ ] Pop-out failure: metadata unchanged, node not left hidden
- [ ] Pop-in failure: widget window stays open
- [ ] Renderer crash: block:poppedout cleared, node unhidden, block reappears
- [ ] Duplicate pop-out: no-op, returns existing window
- [ ] Escape during drag: session cancelled, overlays removed

### Accessibility
- [ ] Pop-out button announces purpose
- [ ] Dialog has role="dialog", aria-labelledby, keyboard-navigable
- [ ] Tab hover fill respects prefers-reduced-motion
- [ ] Drop rejection uses color AND aria-live announcement

### Sub-Block Pop-Out (MT/MD interaction)
- [ ] Popping out a multi-session terminal block renders all sub-session tabs in the widget window
- [ ] Popping out a multi-doc preview block renders all document tabs in the widget window
- [ ] Sub-session/document tab switching works correctly inside the widget window
- [ ] Popping in a multi-session/multi-doc block restores all sub-elements to the layout

### Build and Tests
- [ ] `go build ./...` — zero errors
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm test` — zero failures

---

## Files to Create or Modify

| File | Action | Description |
|---|---|---|
| `pkg/waveobj/wtypemeta.go` | Modify | Add 5 `block:*` fields |
| `pkg/waveobj/metaconsts.go` | Regenerate | 5 new constants |
| `pkg/wconfig/settingsconfig.go` | Modify | Add 3 `widget:*` fields |
| `pkg/wconfig/defaultconfig/settings.json` | Modify | Add defaults |
| `frontend/app/store/settings-registry.ts` | Modify | Register 3 settings |
| `frontend/layout/lib/types.ts` | Modify | `hidden?` field, HideNode/UnhideNode actions |
| `frontend/layout/lib/layoutTree.ts` | Modify | hideNode/unhideNode operations |
| `frontend/layout/lib/layoutModel.ts` | Modify | hideNodeByBlockId/unhideNodeByBlockId, filter leafs |
| `frontend/layout/lib/TileLayout.tsx` | Modify | Skip hidden nodes, WidgetDropOverlay |
| `emain/emain-widget.ts` | **Create** | WaveWidgetWindow, DragSession, transactions |
| `emain/emain.ts` | Modify | IPC handlers, startup cleanup |
| `emain/preload.ts` | Modify | Expose widget IPC |
| `frontend/types/custom.d.ts` | Modify | ElectronApi widget methods |
| `frontend/app/block/blockframe-header.tsx` | Modify | Pop-out/pop-in button |
| `frontend/app/tab/tabbar.tsx` | Modify | Tab hover progress |
| `frontend/widget-window/widget.html` | **Create** | HTML template |
| `frontend/widget-window/widget.ts` | **Create** | Lean entrypoint |
| `frontend/widget-window/widget-app.tsx` | **Create** | Root React component |
| `frontend/widget-window/widget-frame.tsx` | **Create** | WidgetWindowFrame |
| `frontend/widget-window/widget.scss` | **Create** | Widget styles |
| `frontend/app/view/notes/notes-model.ts` | Modify | File path snapshot |
| `frontend/app/view/todo/todo-model.ts` | Modify | File path snapshot |
| `frontend/app/view/treeview/treeview-model.ts` | Modify | rootpath override |
| `electron.vite.config.ts` | Modify | widget.html entry point |
