# Widget Pop-Out / Pop-In Specification

## Status: DRAFT (v2 — post-review)

Spec for detaching widgets (blocks) from the Wave Terminal layout into standalone Electron windows, and re-attaching them via drag-and-drop — including cross-tab placement.

---

## Problem Statement

Wave Terminal's current layout system requires all widgets to live within their parent tab's tile layout. Users cannot:

1. **Compare across tabs** — View a terminal from one project alongside a terminal from another
2. **Use multi-monitor setups** — Move a widget to a secondary display while keeping the main window on the primary
3. **Focus on a single widget** — Pop out a terminal or preview to work on it without the surrounding layout chrome
4. **Reorganize across tabs** — Move a widget from one tab to another without recreating it

This spec introduces widget pop-out (detach to standalone window) and pop-in (re-attach to any tab's layout) with full drag-and-drop support.

---

## Key Concepts

| Term                       | Definition                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Pop-out**                | Detach a widget from a tab's layout into a standalone Electron window                                |
| **Pop-in**                 | Re-attach a standalone widget window back into a tab's layout                                        |
| **Widget Window**          | A native Electron window containing a single popped-out widget. Each is a separate renderer process. |
| **Origin Tab**             | The tab from which a widget was originally popped out                                                |
| **Directory-bound widget** | A widget whose content is tied to a specific project directory (Notes, Todo)                         |
| **Context-free widget**    | A widget that can be placed in any tab (Terminal, Preview, Web, AI)                                  |

---

## User Stories

### US-1: Pop-out via title bar button

> As a user, I want to click a "pop-out" icon on a widget's title bar to detach it into its own window, so I can move it to another monitor.

### US-2: Pop-out via drag

> As a user, I want to drag a widget outside the Wave window boundary and release to pop it out into a standalone window — matching Chrome/VS Code tab tear-off behavior.

### US-3: Pop-in via drag to same tab

> As a user, I want to drag a standalone widget window back over the Wave window to snap it back into the layout.

### US-4: Pop-in via drag to different tab

> As a user, I want to drag a standalone widget window over a different tab header, wait for it to activate, then drop the widget into that tab's layout.

### US-5: Directory-bound widget awareness

> As a user, when I pop out a Notes or Todo widget, I want to see which project directory it belongs to, and I want a warning (not a block) if I try to drop it into a tab with a different base directory.

### US-6: Customizable hover timeout

> As a user, I want to configure how long I need to hover over a tab header before it switches during a drag operation.

### US-7: Keyboard workflows

> As a user, I want keyboard shortcuts for pop-out, pop-in, pop-all-back-in, and cycling focus between widget windows.

### US-8: Always-on-top toggle

> As a user, I want to pin a widget window above all other windows so I can reference it while working in other applications.

---

## Data Model

### Block Metadata Extensions

New metadata keys on the `Block` object:

| Key                   | Type      | Description                                                                                |
| --------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `block:poppedout`     | `boolean` | `true` when this block is currently in a standalone widget window                          |
| `block:origintab`     | `string`  | OID of the tab this block was popped out from                                              |
| `block:origintabname` | `string`  | Display name of the origin tab (snapshot at pop-out time, for display)                     |
| `block:originbasedir` | `string`  | `tab:basedir` of the origin tab (snapshot at pop-out time, for directory-bound validation) |
| `block:layoutnodeid`  | `string`  | Layout node ID this block occupied before pop-out (for position restoration)               |

**Note:** Widget window position and size are NOT stored in block metadata. The layout tree preserves the block's original position. See [Persistence Model](#persistence-model).

These keys are added to:

- `pkg/waveobj/wtypemeta.go` — `MetaTSType` struct
- `pkg/waveobj/metaconsts.go` — constant definitions
- Run `task generate` to update TypeScript types

### Ownership & Placement Model

The block system has two independent concepts that this spec must not conflate:

1. **Ownership**: Which tab owns the block (`ParentORef`, `BlockIds`)
2. **Placement**: Where the block is visually rendered (layout tree node vs. widget window)

**Invariant**: A block is always in exactly ONE of these placement states:

| State                  | `block:poppedout` | Layout tree             | Widget window | Owner                   |
| ---------------------- | ----------------- | ----------------------- | ------------- | ----------------------- |
| **Embedded**           | `false` / absent  | Has node                | No            | Origin tab              |
| **Popped-out**         | `true`            | Node preserved (hidden) | Yes           | Origin tab              |
| **Cross-tab embedded** | `false`           | Has node in target tab  | No            | Target tab (reparented) |

**Critical rule**: A block's layout node is **never deleted** during pop-out. The node is marked hidden/inactive in the layout tree but retains its position. This enables:

- Closing a widget window returns the block to its exact original position
- App restart renders the layout as if the widget was never popped out
- No "liminal state" where a block exists in neither layout nor widget window

**Cross-tab pop-in** (Flow 4) is the only operation that changes ownership: the block is reparented to the target tab, the old tab's hidden layout node is cleaned up, and a new layout node is inserted in the target tab.

### Widget Classification

Widgets are classified into two categories based on their relationship to project context:

| Widget Type | Class           | Behavior on Pop-out                                              | Pop-in to Different Tab                                                                |
| ----------- | --------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `term`      | Context-free    | Shell session continues; retains CWD                             | Allowed, no warning                                                                    |
| `preview`   | Context-free    | Retains current file/URL                                         | Allowed, no warning                                                                    |
| `web`       | Context-free    | Retains URL                                                      | Allowed, no warning                                                                    |
| `waveai`    | Context-free    | Retains conversation                                             | Allowed, no warning                                                                    |
| `sysinfo`   | Context-free    | Retains connection                                               | Allowed, no warning                                                                    |
| `notes`     | Directory-bound | Snapshots file path into `file` meta; shows origin project badge | Warning if target `tab:basedir` differs from `block:originbasedir`. User can override. |
| `todo`      | Directory-bound | Snapshots file path into `file` meta; shows origin project badge | Warning if target `tab:basedir` differs from `block:originbasedir`. User can override. |
| `treeview`  | Context-free    | Snapshots root path into `treeview:rootpath` meta                | Allowed, retains root folder                                                           |

**Directory-bound validation uses `tab:basedir`, NOT tab name.** Tab names are user labels and not stable identity. Two tabs with the same `tab:basedir` point to the same project — moving a Notes widget between them is always safe. Moving to a tab with a different `tab:basedir` shows a confirmation dialog:

> "This Notes widget is editing `/home/user/project-a/.wave/NOTES.md`. The target tab's project is `/home/user/project-b`. Move anyway? The widget will keep editing the original file."

The user can always override. The dialog is informational, not a gate.

### Settings

| Key                        | Type      | Default | Range    | Description                                                                 |
| -------------------------- | --------- | ------- | -------- | --------------------------------------------------------------------------- |
| `widget:poptabhoverms`     | `number`  | `800`   | 300–5000 | Milliseconds to hover over a tab header during drag before it auto-switches |
| `widget:popoutenabled`     | `boolean` | `true`  | —        | Master toggle to enable/disable pop-out functionality                       |
| `widget:popoutalwaysontop` | `boolean` | `true`  | —        | Default always-on-top state for new widget windows                          |

Added to:

- `frontend/app/store/settings-registry.ts` — Setting metadata
- `pkg/wconfig/settingsconfig.go` — Go type
- `pkg/wconfig/defaultconfig/settings.json` — Default value

**Note on hover timeout:** 800ms matches the Chrome/VS Code range for drag-hover interactions. 2000ms feels unresponsive during active drag operations.

---

## Transaction Model

**All pop-out and pop-in operations are atomic transactions owned by the Electron main process.** Renderers request transitions; main decides, persists, creates/destroys windows, and broadcasts the resulting state.

### Pop-Out Transaction

```
Renderer sends: widget:popout-request { blockId, originTabId, bounds }
Main process executes atomically:
  1. Validate block exists and is not already popped out
  2. Snapshot metadata (originbasedir, origintabname, file paths for directory-bound)
  3. Mark layout node as hidden (NOT deleted)
  4. Set block:poppedout = true + all origin metadata
  5. Persist all metadata changes to backend
  6. Create BrowserWindow for widget
  7. On success: broadcast widget:popout-complete { blockId, windowId }
  8. On failure at any step: rollback all metadata, unhide layout node, broadcast widget:popout-failed { blockId, reason }
```

### Pop-In Transaction

```
Main process receives: widget:popin-request { blockId, targetTabId, dropPosition }
Main process executes atomically:
  1. Validate block exists and is popped out
  2. Validate target tab exists
  3. If same tab as origin: unhide layout node (original position restored)
  4. If different tab: reparent block (update ParentORef, BlockIds), insert new layout node at dropPosition, remove hidden node from old tab
  5. Clear all pop-out metadata (block:poppedout, block:origintab, etc.)
  6. Persist all changes
  7. Destroy widget window BrowserWindow
  8. On success: broadcast widget:popin-complete { blockId, tabId }
  9. On failure: rollback, keep widget window open, broadcast widget:popin-failed { blockId, reason }
```

### Idempotency

- Pop-out requests for an already-popped-out block are no-ops (return existing window ID)
- Pop-in requests for a block that is not popped out are no-ops
- Duplicate requests during an in-flight transaction are queued (same action queue pattern as `WaveBrowserWindow`)
- Each transaction has a unique `transactionId` to prevent stale IPC messages from corrupting state

---

## UX Flows

### Flow 1: Pop-Out via Title Bar Button

```
User clicks [⧉] pop-out button on widget title bar
  │
  ├─ 1. Frontend sends widget:popout-request to main process
  │     • Includes blockId, originTabId, current block rendered bounds
  │
  ├─ 2. Main process executes Pop-Out Transaction (see above)
  │     • Snapshots all metadata atomically
  │     • Hides layout node (preserves position)
  │     • Creates widget window
  │
  ├─ 3. Widget window appears
  │     • Position: near the origin block's last screen position
  │     • Size: same as the block's last rendered size
  │     • Min size: 300×200
  │     • Always-on-top per widget:popoutalwaysontop setting
  │
  ├─ 4. Block renders inside widget window
  │     • Same Block + ViewModel pipeline
  │     • BlockId unchanged — WOS subscriptions work automatically
  │     • ViewModel recreated in new window context
  │
  └─ 5. Focus management
        • Widget window receives focus
        • Main window retains its state (no re-render of the layout gap — hidden node leaves space or layout reflows)
```

**Title Bar Button Placement:**

The pop-out button `[⧉]` (icon: `arrow-up-right-from-square`) is added to `HeaderEndIcons` in `blockframe-header.tsx`, positioned **before** the magnify/maximize buttons:

```
[custom buttons...] [⧉ pop-out] [□ magnify] [⊞ maximize] [✕ close]
```

When the block is popped out, the button changes to a **pop-in** button `[⤶]` (icon: `arrow-turn-down-left`) in the widget window's title bar.

### Flow 2: Pop-Out via Drag

```
User starts dragging widget by its title bar drag handle
  │
  ├─ 1. react-dnd drag begins (existing useDrag hook in TileLayout)
  │     • Drag preview generated (existing html-to-image)
  │     • Normal in-layout drag behavior active
  │
  ├─ 2. User drags cursor outside the Wave window boundary
  │     • Detection: main process monitors cursor position via screen.getCursorScreenPoint()
  │       relative to BrowserWindow bounds (NOT renderer-side detection)
  │     • Threshold: cursor exits window bounds by ≥20px (prevents accidental pop-out)
  │
  ├─ 3. Transition: in-layout drag → widget window creation
  │     • Main process sends signal to renderer to cancel react-dnd drag
  │     • Main process executes Pop-Out Transaction
  │     • Widget window created at current cursor position
  │     • Widget window enters native OS drag via BrowserWindow.startMoveOrResize('move')
  │     • User seamlessly continues the drag — the window moves under the cursor
  │
  ├─ 4. User continues dragging the widget window
  │     • If dragged back over main window: triggers Flow 3 (pop-in)
  │     • If released on desktop: widget window stays at final position
  │
  └─ 5. Fallback (if startMoveOrResize unavailable on platform)
        • On drag end (mouse up) outside window bounds:
        • Main process creates widget window at cursor position
        • Less fluid but functionally identical
```

**Platform behavior:**

- **macOS**: `startMoveOrResize('move')` works well. Seamless transition.
- **Windows**: `startMoveOrResize('move')` available since Electron 32. Falls back to create-on-release if unavailable.
- **Linux (X11)**: Works. **Linux (Wayland)**: `startMoveOrResize` may not work — falls back to create-on-release.

### Flow 3: Pop-In via Drag to Layout

```
User drags widget window toward the main Wave window
  │
  ├─ 1. Main process detects overlap
  │     • Polling: main monitors widget window bounds vs main window bounds
  │       (via BrowserWindow 'move' event + bounds comparison, NOT IPC cursor streaming)
  │     • When overlap detected: main sends widget:drag-enter to main window renderer
  │
  ├─ 2. Main window shows drop zone overlay
  │     • Semi-transparent overlay (10% dim) appears over layout
  │     • Widget window opacity reduces to 70%
  │     • Drop zones activate using existing OverlayNode system
  │
  ├─ 3. Drop position tracking
  │     • Main process samples screen.getCursorScreenPoint() on a 16ms interval
  │     • Converts to main window local coordinates
  │     • Sends widget:cursor-position to main renderer for drop zone highlighting
  │     • determineDropDirection() calculates target (same 9-zone system)
  │     • Placeholder shows where widget will land
  │
  ├─ 4. User releases mouse over the layout
  │     • Main process detects: widget window 'blur' event + cursor inside main window bounds
  │     • Triggers Pop-In Transaction (see Transaction Model)
  │     • If same tab: block returns to original position (hidden node unhidden)
  │     • If different tab (via Flow 4): block reparented and inserted at drop position
  │
  ├─ 5. Cleanup
  │     • Widget window destroyed
  │     • Block renders in layout
  │     • Focus returns to the main window, with the restored block focused
  │
  └─ 6. Drag cancel
        • Escape key during drag: widget:drag-cancel sent to both windows
        • Widget window returns to pre-drag position
        • Drop zone overlay removed
        • All hover timers cleared
```

**Cross-Window Detection (Jordan's recommendation — bounds + cursor, not IPC streaming):**

The spec does NOT use high-frequency renderer-to-renderer IPC for cursor tracking. Instead:

1. Main process monitors widget window position via `BrowserWindow` 'move' events
2. Main process polls `screen.getCursorScreenPoint()` when a drag session is active
3. Main converts screen coordinates to main-window-local coordinates
4. Main sends position updates to the main renderer at a throttled rate (60fps max)

This keeps IPC for **state transitions** (enter, leave, drop, cancel), not motion fidelity.

### Flow 4: Cross-Tab Pop-In

```
User drags widget window over a tab header in the main Wave window
  │
  ├─ 1. Main process detects cursor over tab header area
  │     • Tab header bounds calculated from tab positions
  │     • Specific tab identified by x-coordinate
  │
  ├─ 2. Tab enters "pending switch" state
  │     • Main sends widget:tab-hover { tabId, progress: 0 } to renderer
  │     • Visual: tab header shows progress bar fill (accent color, bottom border)
  │     • Hover timer starts: widget:poptabhoverms (default 800ms)
  │
  ├─ 3. During hover
  │     • Main sends progress updates to renderer (for fill animation)
  │     • Moving cursor off tab header: timer resets, progress clears
  │     • Moving to different tab: old timer resets, new timer starts
  │     • All stale timers from previous hovers are cancelled (no timer poisoning)
  │
  ├─ 4. Timer completes → Tab switches
  │     • Active tab changes to the hovered tab
  │     • Tab switch animation plays
  │     • New tab's layout becomes the drop target
  │     • Drop zone overlay appears on new tab's layout
  │
  ├─ 5. User positions widget in the new tab's layout
  │     • Same drop mechanics as Flow 3
  │
  ├─ 6. Directory-bound validation (Notes/Todo only)
  │     • Compare block:originbasedir with target tab's tab:basedir
  │     • If same basedir (or both empty): proceed silently
  │     • If different basedir: show confirmation dialog (see Widget Classification)
  │     • User confirms → proceed with pop-in
  │     • User cancels → cancel drop, widget window returns to position
  │
  └─ 7. On successful cross-tab drop
        • Pop-In Transaction executes with reparenting:
          - Block's ParentORef updated to target tab
          - Block removed from old tab's BlockIds, added to new tab's BlockIds
          - Hidden layout node in old tab cleaned up
          - New layout node inserted in target tab at drop position
        • All pop-out metadata cleared
        • Widget window destroyed
```

**Tab hover with hidden/overflow tabs:** If the target tab is not visible (tab overflow), the user must scroll the tab bar to reveal it first. The hover timer only works on visible tab headers.

---

## Keyboard Shortcuts

| Action                       | Shortcut (macOS)  | Shortcut (Windows/Linux) | Context                    |
| ---------------------------- | ----------------- | ------------------------ | -------------------------- |
| Pop out focused block        | `Cmd+Shift+O`     | `Ctrl+Shift+O`           | Main window, block focused |
| Pop in (return to tab)       | `Cmd+Shift+O`     | `Ctrl+Shift+O`           | Widget window              |
| Pop all back in              | `Cmd+Shift+Alt+O` | `Ctrl+Shift+Alt+O`       | Any window                 |
| Toggle always-on-top         | `Cmd+Shift+T`     | `Ctrl+Shift+T`           | Widget window              |
| Focus next widget window     | `Cmd+Shift+]`     | `Ctrl+Shift+]`           | Any window                 |
| Focus previous widget window | `Cmd+Shift+[`     | `Ctrl+Shift+[`           | Any window                 |
| Focus main window            | `Cmd+Shift+M`     | `Ctrl+Shift+M`           | Widget window              |

All shortcuts are registered via the existing `registerGlobalWebviewKeys` system.

---

## Widget-Specific Behavior

### Terminal (`term`) — Context-free

- **Pop-out**: Shell session continues running. Terminal remains connected via existing WebSocket/wsh client.
- **Tab context**: The terminal's `cmd:cwd` is already set (it's the running shell's CWD). No data loss.
- **Pop-in to different tab**: Terminal continues with its current CWD. Does NOT adopt new tab's `tab:basedir`.
- **No special handling required.**

### Notes (`notes`) — Directory-bound

- **Pop-out**:
  1. Compute current file path from `tab:basedir` + default (`${basedir}/.wave/NOTES.md`)
  2. Store the computed absolute path in block meta `file` (as explicit override)
  3. Store `block:originbasedir` (the `tab:basedir` value)
  4. Store `block:origintabname` (for display only)
  5. Widget window title shows: `"Notes — {basedir basename}"` (e.g., "Notes — my-project")

- **While popped out**: The `file` meta override ensures the Notes widget continues reading/writing the correct project file regardless of having no tab context.

- **Pop-in**:
  - **Same-basedir tab**: Clear `file` override (reverts to dynamic path resolution). Silent.
  - **Different-basedir tab**: Show confirmation dialog. If user accepts, `file` override is retained (widget keeps editing the original file). If user declines, cancel.
  - **Back to origin tab**: Always succeeds. Clear all pop-out metadata and `file` override.

### Todo (`todo`) — Directory-bound

- **Identical behavior to Notes** (same file path pattern: `${basedir}/.wave/TODO.md`)
- Title shows: `"Todo — {basedir basename}"`

### Tree View (`treeview`) — Context-free

- **Pop-out**: Snapshot current root path:
  1. Read current `rootPath` from the TreeViewModel (derived from `tab:basedir`)
  2. Store in block meta key `treeview:rootpath`
  3. TreeView model modified to prefer `treeview:rootpath` over `tab:basedir` when present

- **Pop-in**:
  - Allowed on any tab, no warnings
  - `treeview:rootpath` override is **retained** (does not change to new tab's basedir)
  - Only a fresh widget creation or manual refresh resets to the current tab's basedir

### Preview, Web, WaveAI, Sysinfo — Context-free

- **Pop-out**: No special handling. All context is in block metadata (`file`, `url`, `connection`).
- **Pop-in**: Allowed on any tab. No restrictions.

### WaveAI note

When popped out, WaveAI retains its conversation but loses the ability to read terminal context from the main window's blocks. The AI can still read its own conversation history and any explicitly attached files. This is a known limitation — the widget window is a separate renderer with separate block visibility.

---

## Widget Window Architecture

### Electron Implementation

Widget windows are `BrowserWindow` instances (not `BaseWindow` + `WebContentsView` like the main window).

```typescript
class WaveWidgetWindow {
  win: BrowserWindow;
  blockId: string;
  originTabId: string;
  originWindowId: string;
  dragSession: DragSession | null; // Active drag tracking

  constructor(blockId: string, originTabId: string, originWindowId: string, bounds: Rectangle) {
    this.win = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      minWidth: 300,
      minHeight: 200,
      frame: false,
      transparent: platform === "darwin", // macOS only for transparency
      titleBarStyle: "hidden",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        webviewTag: true,
      },
    });
  }
}
```

**Platform-specific window configuration:**

| Platform | `frame` | `transparent` | `titleBarStyle` | Blur/Vibrancy                   | Notes                                                 |
| -------- | ------- | ------------- | --------------- | ------------------------------- | ----------------------------------------------------- |
| macOS    | `false` | `true`        | `hiddenInset`   | `vibrancy: "fullscreen-ui"`     | Best experience. Native feel.                         |
| Windows  | `false` | `false`       | `hidden`        | `backgroundMaterial: "acrylic"` | No transparency (DWM quirks). Acrylic when available. |
| Linux    | `false` | `false`       | `hidden`        | None                            | Conservative defaults. Compositor-dependent.          |

### Lean Renderer Entrypoint

Widget windows load a **dedicated entrypoint** that only bootstraps what a single block needs:

```
widget.html?blockId={blockId}&originTabId={tabId}
```

This entrypoint:

- Initializes Jotai store with only the atoms needed for one block
- Connects to WOS for block data subscriptions
- Does NOT load workspace, tab bar, breadcrumbs, layout system, or multi-block infrastructure
- Renders: `WidgetWindowFrame` → `BlockFrame` → `Block`
- Reduces memory footprint and startup time compared to loading the full app shell

### Window Management

- Widget windows tracked in a global `Map<string, WaveWidgetWindow>` (keyed by blockId)
- Always-on-top per `widget:popoutalwaysontop` setting (toggle in title bar)
- On app quit / main window close: see [Persistence Model](#persistence-model)

### Drag Session Protocol

Cross-window drag uses a **session-based protocol** managed by main process:

```typescript
interface DragSession {
  sessionId: string; // Unique per drag operation
  blockId: string; // Block being dragged
  sourceWindowId: string; // Widget window ID
  state: "active" | "over-main" | "over-tab" | "dropped" | "cancelled";
  hoverTabId: string | null; // Tab being hovered (for timer)
  hoverStartTime: number; // Timer start timestamp
  cursorPollingInterval: NodeJS.Timer; // 16ms cursor sampling
}
```

- Only ONE drag session can be active at a time
- Session starts when widget window title bar drag begins
- Session ends on drop, cancel, or widget window blur without overlap
- Stale IPC messages with wrong `sessionId` are discarded (prevents timer poisoning, ghost drops)

### IPC Messages

| Channel                   | Direction       | Payload                                  | Purpose                                     |
| ------------------------- | --------------- | ---------------------------------------- | ------------------------------------------- |
| `widget:popout-request`   | Renderer → Main | `{ blockId, originTabId, bounds }`       | Request pop-out                             |
| `widget:popout-complete`  | Main → Renderer | `{ blockId, windowId }`                  | Pop-out succeeded                           |
| `widget:popout-failed`    | Main → Renderer | `{ blockId, reason }`                    | Pop-out failed (rollback done)              |
| `widget:popin-request`    | Main (internal) | `{ blockId, targetTabId, dropPosition }` | Request pop-in                              |
| `widget:popin-complete`   | Main → Renderer | `{ blockId, tabId }`                     | Pop-in succeeded                            |
| `widget:popin-failed`     | Main → Renderer | `{ blockId, reason }`                    | Pop-in failed                               |
| `widget:drag-enter`       | Main → Renderer | `{ sessionId, blockId }`                 | Widget drag entered main window             |
| `widget:drag-leave`       | Main → Renderer | `{ sessionId, blockId }`                 | Widget drag left main window                |
| `widget:cursor-position`  | Main → Renderer | `{ sessionId, x, y }`                    | Cursor position for drop zone highlighting  |
| `widget:tab-hover`        | Main → Renderer | `{ sessionId, tabId, progress }`         | Tab hover progress (0-1) for fill animation |
| `widget:drag-cancel`      | Main → Both     | `{ sessionId, blockId }`                 | Drag cancelled (Escape or abandon)          |
| `widget:drop`             | Main → Renderer | `{ sessionId, blockId, x, y }`           | Widget dropped on main window               |
| `widget:confirm-move`     | Main → Renderer | `{ blockId, sourceDir, targetDir }`      | Directory-bound confirmation dialog         |
| `widget:confirm-response` | Renderer → Main | `{ blockId, confirmed }`                 | User's response to confirmation             |

---

## Persistence Model

**Layout position is always preserved. Pop-out state does NOT persist across app restart.**

When a widget is popped out:

- The layout tree node is **hidden** (not deleted). The layout renders as if the block is gone, but the node retains its position data.
- On app quit (expected or crash): all `block:poppedout` flags are cleared during startup hydration. The layout tree unhides all hidden nodes. The app opens as if no widgets were ever popped out.

This means:

- **No widget windows on startup** — every restart is clean
- **No "window explosion"** after launching the app
- **No race conditions** between main window startup and widget window restoration
- **No stale monitor geometry** problems
- Terminal sessions that were in popped-out widgets reconnect to their blocks normally (the block was never deleted)

Widget window **size** is not persisted. Position is not persisted. Each pop-out is a fresh window at the block's current rendered size.

---

## Edge Cases & Error Handling

### 1. App Quit with Popped-Out Widgets

- On `before-quit`: destroy all widget windows. No pop-in transaction needed.
- On next startup: `block:poppedout` flags cleared during hydration, layout nodes unhidden.
- Blocks render in their original positions as if nothing happened.

### 2. App Crash with Popped-Out Widgets

- Same as app quit. On next startup, metadata cleanup restores clean state.
- The hidden layout node system means no data is lost — the block and its position survive.

### 3. Origin Tab Closed While Widget is Popped Out

- Widget window stays open. Block still has `block:poppedout = true`.
- Block's `ParentORef` points to a now-deleted tab.
- **Recovery**: On close (X button or pop-in button), the block is adopted by the current active tab. A new layout node is inserted at a default position. The user sees the block appear in their current tab.
- The origin tab badge in the widget title bar shows "({tab name} — closed)".
- Block is NOT silently deleted. Closing a widget window NEVER deletes a block.

### 4. Main Window Closed While Widget is Popped Out

- If the main window is the last window: app quit flow applies (see #1).
- If other main windows exist: widget windows stay open; pop-in targets the remaining windows.

### 5. Directory-Bound Widget Dropped on Different-Basedir Tab

- Confirmation dialog appears (see Widget Classification section).
- User can accept (widget keeps its original file path) or cancel (return to widget window).
- Accessible: dialog is keyboard-navigable, screen-reader announced.

### 6. Multiple Monitors

- Widget windows can be on any monitor.
- Position is NOT persisted (see Persistence Model). Each pop-out appears near the origin block.
- If the origin block is on a monitor that has since been disconnected, widget window appears on the primary display.

### 7. Widget Window Resize

- User can resize widget windows.
- Minimum: 300×200.
- ViewModel receives resize events and adapts (terminal reflows, preview scales).

### 8. Drag Cancel

- **Escape key** during any drag phase: cancels the operation immediately.
  - Drop zone overlay removed from main window
  - Widget window returns to pre-drag position
  - All hover timers cleared
  - Drag session marked "cancelled" — stale IPC messages ignored
- **Dragging away from main window** (was hovering, moved away): drop zone overlay removed, hover timers reset.

### 9. Double-Click / Rapid Operations

- Pop-out button is disabled (visually and functionally) while a pop-out transaction is in flight.
- If a pop-in request arrives while a pop-out is processing for the same block: queued via action queue.
- Drag initiation is debounced — rapid title bar clicks do not trigger multiple drag sessions.

### 10. Widget Window Focus

- Pop-out: widget window receives focus, main window does not blur its state.
- Pop-in (close/return): focus returns to main window, with the restored block focused.
- Widget window keyboard shortcuts work only when the widget window is focused.
- `Cmd+Shift+M` from widget window focuses the main window.

### 11. Concurrent Pop-Out Limit

- No hard limit. Each widget window is a separate renderer process.
- A soft recommendation of 3-5 concurrent widget windows should be documented for users (performance note in settings UI).
- The lean renderer entrypoint keeps per-window overhead manageable.

### 12. Renderer Crash in Widget Window

- If a widget window's renderer crashes, the main process detects it via `webContents` 'crashed' event.
- Widget window is destroyed. `block:poppedout` is cleared, layout node unhidden.
- Block reappears in its original tab position. User sees the block "return" to the tab.
- No data loss — block data lives in the backend, not the renderer.

---

## Accessibility

### Keyboard Navigation

- All pop-out/pop-in operations available via keyboard shortcuts (see Keyboard Shortcuts section)
- Widget window title bar buttons are keyboard-focusable and operable via Enter/Space
- Tab order in widget window: title bar buttons → block content

### Screen Readers

- Pop-out button announces: "Pop out {widget name} to separate window"
- Pop-in button announces: "Return {widget name} to tab"
- Directory-bound confirmation dialog is a proper ARIA dialog with role, label, and description
- Drop rejection announces the reason (not just visual feedback)

### Reduced Motion

- Users with `prefers-reduced-motion`: tab hover progress bar uses instant fill instead of animation
- No shake animation on drop rejection — use border color change instead
- Widget window opacity transition during drag is instantaneous

---

## Visual Design Notes

### Widget Window Chrome

```
┌──────────────────────────────────────────────────────────────┐
│ [icon] Widget Title  [project badge]  [📌][⤶ Return][✕]     │ ← Custom title bar
├──────────────────────────────────────────────────────────────┤
│                                                               │
│                    Widget Content                              │
│              (Block renders here)                              │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

- **Title bar height**: Same as block frame header (~30px)
- **Draggable area**: Entire title bar (`-webkit-app-region: drag`)
- **Project badge**: Shown for directory-bound widgets. Pill-shaped with tab color. Shows basename of `block:originbasedir`.
- **📌 pin button**: Toggles always-on-top. Highlighted when active.
- **⤶ Return button**: Triggers pop-in to origin tab (or current active tab if origin closed).
- **✕ Close button**: Same as Return — closes widget window, returns block to tab. Does NOT delete the block.
- **Background**: Matches Wave theme. Platform-specific transparency/blur.
- **Border**: 1px border matching the block frame border color
- **Drop shadow**: Subtle shadow for floating appearance

### Drop Zone Overlay (during pop-in drag)

- Main window dims slightly (10% overlay)
- Active drop zones highlight in accent color
- Placeholder appears at drop position (same as existing DnD placeholder)
- For directory-bound widget on different-basedir tab: drop zones show in amber/warning state (not red — it's a warning, not a block)

### Tab Header Hover Indicator (during cross-tab drag)

- Tab header gets a progress bar fill (accent color, bottom border)
- Fill animates from 0% to 100% over `widget:poptabhoverms` duration (instant if reduced motion)
- Moving off the tab resets the fill
- On completion: tab switches with a brief highlight animation

---

## Implementation Dependencies

Implementation order follows the dependency graph. Items that depend on nothing are independent and can be parallelized.

```
                    ┌─────────────────────┐
                    │  Block Metadata      │
                    │  Extensions          │
                    │  (Go + TS types)     │
                    └──────┬──────────────┘
                           │
              ┌────────────┼────────────────┐
              │            │                │
              ▼            ▼                ▼
   ┌──────────────┐ ┌───────────┐  ┌──────────────────┐
   │ Settings     │ │ Layout    │  │ WaveWidgetWindow  │
   │ Registration │ │ Hidden    │  │ (emain class)     │
   │              │ │ Node      │  │                   │
   └──────┬───────┘ │ Support   │  └──────┬────────────┘
          │         └─────┬─────┘         │
          │               │               │
          │         ┌─────┴─────┐         │
          │         │           │         │
          ▼         ▼           ▼         ▼
   ┌────────────────────────────────────────┐
   │  Pop-Out Transaction                    │
   │  (main process, atomic)                 │
   │  Depends on: metadata, layout hiding,   │
   │  widget window creation                 │
   └──────────────┬─────────────────────────┘
                  │
       ┌──────────┼──────────┬──────────────┐
       │          │          │              │
       ▼          ▼          ▼              ▼
┌───────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐
│ Title Bar │ │ Keybd  │ │ Lean     │ │ Widget-      │
│ Button    │ │ Short- │ │ Renderer │ │ Specific     │
│ (header)  │ │ cuts   │ │ Entry-   │ │ Snapshots    │
│           │ │        │ │ point    │ │ (notes,todo, │
└─────┬─────┘ └────┬───┘ └─────┬────┘ │ treeview)    │
      │            │           │       └──────┬───────┘
      │            │           │              │
      ▼            ▼           ▼              ▼
┌──────────────────────────────────────────────┐
│  Pop-In Transaction                           │
│  (main process, atomic)                       │
│  Depends on: pop-out working end-to-end       │
└──────────────┬───────────────────────────────┘
               │
    ┌──────────┼───────────┐
    │          │           │
    ▼          ▼           ▼
┌────────┐ ┌─────────┐ ┌──────────────────┐
│ Drag   │ │ Cross-  │ │ Directory-bound  │
│ Pop-   │ │ Window  │ │ Confirmation     │
│ Out    │ │ Drop    │ │ Dialog           │
│ (Fl.2) │ │ Detect  │ │                  │
└────┬───┘ │ (Fl.3)  │ └──────────────────┘
     │     └────┬────┘
     │          │
     ▼          ▼
┌────────────────────┐
│ Cross-Tab Pop-In   │
│ (Flow 4)           │
│ Depends on: drag   │
│ pop-out + cross-   │
│ window detection   │
└────────────────────┘
```

**Independent work (can be parallelized):**

- Block metadata extensions (Go types + codegen)
- Settings registration (frontend + Go)
- Layout hidden node support (layout system)
- WaveWidgetWindow class (emain)
- Lean renderer entrypoint (frontend)
- Keyboard shortcut registration

**Sequential dependencies:**

- Pop-Out Transaction requires: metadata, layout hiding, widget window class
- Title bar button requires: pop-out transaction
- Pop-In Transaction requires: pop-out working end-to-end
- Drag pop-out (Flow 2) requires: pop-out transaction + main-process cursor monitoring
- Cross-window drop (Flow 3) requires: pop-in transaction + drag session protocol
- Cross-tab pop-in (Flow 4) requires: cross-window drop + tab hover timer

---

## Files to Modify

| File                                           | Changes                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pkg/waveobj/wtypemeta.go`                     | Add `block:poppedout`, `block:origintab`, `block:origintabname`, `block:originbasedir`, `block:layoutnodeid` fields |
| `pkg/waveobj/metaconsts.go`                    | Add constant definitions for new meta keys                                                                          |
| `pkg/wconfig/settingsconfig.go`                | Add `WidgetPopTabHoverMs`, `WidgetPopoutEnabled`, `WidgetPopoutAlwaysOnTop`                                         |
| `pkg/wconfig/defaultconfig/settings.json`      | Add default values                                                                                                  |
| `frontend/app/store/settings-registry.ts`      | Register new settings with metadata                                                                                 |
| `frontend/app/block/blockframe-header.tsx`     | Add pop-out/pop-in button to `HeaderEndIcons`                                                                       |
| `frontend/layout/lib/layoutModel.ts`           | Add hidden node support: `hideNodeByBlockId()`, `unhideNodeByBlockId()`                                             |
| `frontend/layout/lib/layoutNode.ts`            | Add `hidden` property to `LayoutNode`                                                                               |
| `frontend/layout/lib/TileLayout.tsx`           | Skip hidden nodes in render; drop zone overlay for incoming widget windows                                          |
| `emain/emain-widget.ts`                        | **NEW** — `WaveWidgetWindow` class, drag session protocol, widget window lifecycle                                  |
| `emain/emain.ts`                               | Register widget IPC handlers, startup metadata cleanup                                                              |
| `emain/emain-ipc.ts`                           | New IPC channels for widget pop-out/pop-in                                                                          |
| `emain/preload.ts`                             | Expose widget IPC to renderer                                                                                       |
| `frontend/types/custom.d.ts`                   | Widget window API types                                                                                             |
| `frontend/app/block/block.tsx`                 | Widget window rendering mode                                                                                        |
| `frontend/app/view/notes/notes-model.ts`       | Pop-out file path snapshot logic                                                                                    |
| `frontend/app/view/todo/todo-model.ts`         | Pop-out file path snapshot logic                                                                                    |
| `frontend/app/view/treeview/treeview-model.ts` | Support `treeview:rootpath` meta override                                                                           |
| `frontend/app/tab/tab.tsx`                     | Tab header hover detection for cross-tab drag                                                                       |
| `frontend/widget-window/`                      | **NEW** — Lean renderer entrypoint, WidgetWindowFrame component and styles                                          |
| `frontend/widget-window/widget.html`           | **NEW** — Dedicated HTML entrypoint for widget windows                                                              |

---

## Review Panel Findings (Incorporated)

This spec incorporates findings from a 4-person review panel. Key changes from v1:

| Finding                                                      | Source                          | Resolution                                                                                |
| ------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------- |
| Tab-name matching is wrong for Notes/Todo                    | All 4 reviewers                 | Changed to `tab:basedir` matching with confirmation dialog (not rejection)                |
| Missing keyboard workflows                                   | All 4 reviewers                 | Added full keyboard shortcut table                                                        |
| Quit/restart semantics contradictory                         | Jordan (Architect), Morgan (QA) | Resolved: no persistence across restart. Layout preserves position. Clean startup always. |
| Close should never delete blocks                             | Alex (User), Jordan, Morgan     | All close paths return block to tab. Never delete.                                        |
| Pop-out/pop-in must be atomic transactions                   | Jordan, Morgan                  | Added Transaction Model section with rollback semantics                                   |
| IPC should use state transitions, not cursor streaming       | Jordan                          | Changed to main-process bounds monitoring + cursor sampling. IPC for state only.          |
| Need drag session tokens to prevent stale events             | Morgan                          | Added DragSession protocol with sessionId                                                 |
| Widget renderer should be lean                               | Jordan                          | Added lean renderer entrypoint (don't boot full app shell)                                |
| Focus management underspecified                              | Alex, Riley                     | Added focus rules for every flow                                                          |
| 2000ms hover too slow                                        | Riley (competitive analysis)    | Changed default to 800ms (matches Chrome/VS Code range)                                   |
| Always-on-top is a primary use case                          | Alex                            | Added as default-on setting with toggle button                                            |
| Accessibility gaps (keyboard, screen reader, reduced motion) | Morgan                          | Added Accessibility section                                                               |
| Platform differences for frameless windows                   | Jordan                          | Added platform-specific window configuration table                                        |
| Renderer crash recovery                                      | Morgan                          | Added edge case #12                                                                       |
| Double-click/rapid operations race conditions                | Morgan                          | Added edge case #9 with debouncing                                                        |
