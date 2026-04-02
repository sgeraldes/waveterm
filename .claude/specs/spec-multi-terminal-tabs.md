# Spec: Terminal Session Management — Multi-Session Tabs + History Navigation

**Date:** 2026-03-25
**Status:** Draft (merged from multi-terminal-tabs + session management feedback)
**Goal:** A single terminal block hosts multiple independent shell sessions navigable via an inline tab strip, with full session history browsing, buffer restoration, and transparent session switching.

---

## 1. Scope

This spec merges two related features into a unified terminal session management system:

**Feature A: Multi-Session Tabs** — Create new shell sessions within a single block, each with its own PTY, scrollback buffer, and shell type. Navigated via a compact tab strip.

**Feature B: Session History Navigation** — Browse, restore, and switch between current and historical sessions. Load past session scrollback into the current terminal. Resume dead sessions in new shells.

**In scope:**
- Inline tab strip for multiple live sessions (sub-blocks)
- Session history dropdown showing ALL sessions for this terminal (not truncated)
- Session entries labeled with shell type, connection, and terminal ID
- Load historical session scrollback into current terminal buffer (primary action)
- Open historical session in read-only viewer (secondary action)
- Live session switching: suspend current session, switch to another, switch back
- Shell-aware filtering: group/filter sessions by shell type
- Transparent shell switching when resuming sessions of different shell types

**Out of scope:**
- Multi-tab support for non-terminal views (covered by spec-multi-document-preview)
- Cross-block session transfer (moving a session from one block to another)
- tmux/screen integration (external multiplexer passthrough)

---

## 2. Current Behavior

### Terminal Architecture
- `Block` has `SubBlockIds []string` (`wtype.go:291`). Full CRUD exists: `CreateSubBlock`, `DeleteBlock`, `CreateSubBlockCommand`, `DeleteSubBlockCommand`.
- Each terminal block runs one `ShellController` (`shellcontroller.go:49`), keyed by `blockId` in `controllerRegistry`.
- `TermViewModel` (`term-model.ts:44`) owns one `termRef` and subscribes to one block's controller status.
- `TerminalView` renders a single `connectElemRef` div for xterm.js.

### Session History Architecture
- **Rolling segments**: `rolling.ansi` — overwritten every 30s with `SerializeAddon.serialize()` output. Provides instant terminal restoration on tab reload.
- **Snapshot segments**: `{timestamp}-{reason}.ansi` — immutable captures on clear/close events. Historical records.
- **Storage**: `~/.waveterm-dev/session-history/{blockId}/` with `meta.json` per session.
- **Metadata per session**: `BlockId`, `TabId`, `TabBaseDir`, `Connection`, `Cwd`, `CreatedAt`, `LastUpdatedAt`. **Missing**: shell type (pwsh, zsh, bash, etc.).
- **Session history UI**: Dropdown flyover showing "THIS TERMINAL" and "SAME DIRECTORY" sections. Clicking opens a read-only `SessionHistory` viewer block.
- **Problems**:
  - Not all sessions displayed — only recent/limited subset
  - "This Terminal" doesn't show ALL sessions for the block
  - "Same Directory" mixes sessions from different shells (WSL + PowerShell)
  - No shell type indicator on entries
  - No way to load scrollback into current terminal — only opens viewer

### xterm.js Buffer Capabilities
- `SerializeAddon.serialize()` produces ANSI-encoded text of terminal state
- `terminal.write(data)` can restore state by writing serialized ANSI back
- `terminal.buffer.normal` and `terminal.buffer.alternate` are accessible
- `terminal.reset()` clears the buffer and resets all terminal modes before writing new content
- Cannot hot-swap shell processes — must destroy controller and create new one

---

## 3. Proposed Behavior

### 3.1 Multi-Session Tabs (Live Sessions)

- A "New Terminal Tab" action creates a new sub-block with its own `ShellController`.
- A compact tab strip appears when 2+ sessions exist.

**First-tab transition:** When the first sub-session is created from a single-session terminal:
1. The existing terminal block becomes the **parent container** — it keeps its blockId, its shell process, and its scrollback buffer. It is effectively "sub-session #0" (the primary session).
2. A new sub-block is created as "sub-session #1" with its own shell and buffer.
3. The tab strip appears showing both sessions: the primary (original) and the new sub-block.
4. The primary session is NOT moved into a sub-block — it stays as the parent block. This avoids any data migration and keeps the block's existing session history, file subscriptions, and metadata intact.
- Each tab shows: shell icon, display name, shell integration status dot, close button.
- Switching tabs is instant — all `TermWrap` instances stay mounted (inactive ones use `visibility: hidden; position: absolute; overflow: hidden` with explicit dimensions).
- Closing the last sub-session closes the entire block.

### 3.2 Session History Integration

The session history dropdown is redesigned:

**"THIS TERMINAL" section:**
- Shows ALL sessions ever run in this block — no truncation, paginated if many
- Each entry shows: shell type icon + name (`pwsh`, `zsh`, `bash`, `wsl:Ubuntu`), timestamp, segment count, size
- Entries grouped by live (green dot) vs dead (gray dot)

**"SAME DIRECTORY" section:**
- Filtered by default to same shell type as current terminal
- Toggle to show all shells (with shell type labels)
- Each entry shows: terminal widget ID, shell type, connection info, timestamp

**Actions on a session entry:**

| Action | Behavior |
|--------|----------|
| Click (primary) | Load session scrollback into current terminal buffer |
| `Ctrl+Click` or "Open in Viewer" | Open in separate read-only viewer block (current behavior) |
| "Resume in New Tab" | Create new sub-block tab, load scrollback, start same shell type |

**Migration from old behavior:** The first time a user clicks a session entry after this feature is deployed, a one-time tooltip appears: "Session history now loads into your terminal. Use the eye icon to open in a separate viewer instead." The tooltip auto-dismisses after 5 seconds or on any click. Tracked via a `term:sessionhistorymigrated` local storage flag.

**Confirmation:** When the current terminal has unsaved scrollback content (buffer length > 100 lines), clicking a session entry shows a brief confirmation: "Replace current buffer with historical session? Current buffer will be saved." with [Load] and [Cancel]. Terminals with ≤100 lines of content skip the confirmation (assumed to be a fresh prompt).

### 3.3 Loading Scrollback into Current Terminal

When the user clicks a historical session:

1. **Snapshot current state**: Save current terminal scrollback as a snapshot segment (`{timestamp}-switch.ansi`) so the user can return to it
2. **Clear terminal buffer**: `terminal.reset()`
2.5. **Match terminal dimensions**: Read `termsize` from the session's metadata. If it differs from the current terminal size, temporarily resize with `terminal.resize(savedCols, savedRows)`, write the data, then resize back to the current dimensions. This matches the pattern in `termwrap-history.ts:48-62`.
3. **Write historical data**: `terminal.write(historicalAnsiData)` — the serialized ANSI from the session segment restores colors, formatting, and content
4. **Mark as restored**: A subtle indicator in the tab strip shows this is a restored session (e.g., clock icon overlay)
5. **Shell remains live**: The current shell process is NOT killed — it's still running behind the restored buffer. Any keystroke appends to the live session and the restored content scrolls up naturally.
6. **Pause rolling capture**: Set a `restoredMode` flag on the TermWrap. While `restoredMode` is true, the 30s rolling capture timer skips serialization for this terminal — it would serialize historical content and corrupt the live session's rolling data. Rolling capture resumes automatically when the user types (which clears `restoredMode` and the restored indicator).

**Note:** `terminal.reset()` (equivalent to `\x1bc` RIS) is used instead of `terminal.clear()` because `clear()` only removes scrollback but leaves the current prompt line intact. `reset()` clears everything and resets all terminal modes to defaults, providing a clean slate for writing historical ANSI data.

**Alternative: Replace shell too** — If the user chooses "Resume in New Tab", a new sub-block is created with the historical session's shell type, the scrollback is loaded, and a fresh shell of the same type starts in the same `cwd`.

### 3.3.1 Return to Live Buffer

A "Return to live session" button appears in a thin banner bar above the terminal viewport when `restoredMode` is true:

```
[clock icon] Showing session from Mar 25, 2026 17:41  [Return to live session]
```

Clicking "Return to live session":
1. `terminal.reset()` (clear restored content)
2. Re-read the live session's latest rolling segment
3. `terminal.write(liveRollingData)` to restore live state
4. Clear `restoredMode` flag
5. Resume rolling capture

The banner bar is 24px height, muted background, positioned between the tab strip and the terminal viewport. It is NOT part of the terminal buffer — it's a React overlay.

### 3.4 Live Session Switching

With multi-session tabs, switching between tabs already suspends/resumes:

- **Suspend**: The inactive tab's `TermWrap` stays mounted but hidden (`visibility: hidden; position: absolute; overflow: hidden` with explicit dimensions). Its shell process continues running. A tab-switch snapshot is saved and rolling capture is stopped (see rolling capture optimization below).
- **Resume**: The tab becomes visible. xterm.js re-renders from its in-memory buffer. No re-read from disk needed.
- **Transparent**: From the user's perspective, switching tabs is instant. Shell state, scrollback, cursor position — all preserved.

**Rolling capture optimization:** Only the active sub-session runs the 30-second rolling capture timer. When switching tabs:
1. Immediately save a snapshot of the deactivating tab (`{timestamp}-tabswitch.ansi`)
2. Stop its rolling capture timer
3. Start the rolling capture timer on the activating tab

This prevents 10 concurrent serialize() calls every 30 seconds, which would cause periodic UI jank. Inactive tabs rely on their tab-switch snapshot for recovery.

### 3.5 Shell-Aware Session Management

**New metadata field**: `ShellType string` added to `SessionMeta` in `sessionhistory.go`.

**Shell type persistence:** Shell type is NOT currently persisted to block metadata. The `ShellController` computes `ConnUnion.ShellType` at startup (`shellcontroller.go:691-713`) but only uses it transiently.

**Required change:** During `setupAndStartShellProcess`, persist the resolved shell type to block metadata as `term:shelltype`. This is a one-line addition after the `getConnUnion` call:
```go
meta["term:shelltype"] = connUnion.ShellType
```

For WSL sessions, format as `wsl:<distro>` (e.g., `wsl:Ubuntu`).

The `SessionMeta.ShellType` field is populated from `block.meta["term:shelltype"]` during rolling/snapshot capture.

**Filtering logic**:
- "THIS TERMINAL": Always shows all sessions regardless of shell type
- "SAME DIRECTORY": Defaults to filtering by current terminal's shell type. A "Show all shells" toggle reveals cross-shell sessions with shell type badges.

---

## 4. Technical Design

### 4.1 Data Model Changes

**Session metadata extension** — `pkg/sessionhistory/sessionhistory.go`:

Add `ShellType` field to `SessionMeta`:
```go
type SessionMeta struct {
    BlockId       string
    TabId         string
    TabBaseDir    string
    Connection    string
    Cwd           string
    ShellType     string  // NEW: "pwsh", "zsh", "bash", "wsl:Ubuntu", etc.
    TermCols      int     `json:"termcols,omitempty"`
    TermRows      int     `json:"termrows,omitempty"`
    CreatedAt     int64
    LastUpdatedAt int64
}
```

**Block meta keys** — `pkg/waveobj/wtypemeta.go`:

```go
TermActiveTabId string `json:"term:activetabid,omitempty"`
TermTabName     string `json:"term:tabname,omitempty"`
```

Run `task generate` after adding.

**Session history service** — `pkg/service/sessionhistoryservice/`:

Update `SaveRollingSegment` to accept and persist `ShellType` in meta.json.
Update `ListSessionHistory` to return `ShellType` in response entries.

**Frontend session types** — update `SessionInfo` in `gotypes.d.ts` to include `shelltype: string`.

### 4.2 Frontend Changes

#### 4.2.1 `TermViewModel` Extensions — `frontend/app/view/term/term-model.ts`

**Multi-session state (from original spec):**
- `activeTabIdAtom`, `subBlockIdsAtom`, `subViewModels` map
- `addTerminalTab()`, `closeTerminalTab()`, `switchToTab()`
- Delegation of `giveFocus()`, `keyDownHandler`, `sendDataToController` to active sub-model

**Session history state (new):**
- `sessionHistoryAtom: Atom<SessionInfo[]>` — full list from `ListSessionHistory` RPC
- `sessionFilterShellType: PrimitiveAtom<string | null>` — null = show all, string = filter
- `restoredSessionIndicator: PrimitiveAtom<boolean>` — true when buffer shows restored historical content

**Session loading methods:**
- `loadSessionIntoBuffer(sessionInfo: SessionInfo): Promise<void>`:
  1. Call `saveSessionSnapshot("switch")` on current state
  2. Read historical session data via `SessionHistoryService.ReadSegment`
  3. `terminal.reset()` then `terminal.write(ansiData)` (match terminal dimensions first per Section 3.3 step 2.5)
  4. Set `restoredSessionIndicator` to true; pause rolling capture (`restoredMode = true`)
  5. On next keystroke, clear indicator and resume rolling capture

- `openSessionInViewer(sessionInfo: SessionInfo): void`:
  - Existing behavior — create a new block with `view: "sessionhistory"`

- `resumeSessionInNewTab(sessionInfo: SessionInfo): Promise<void>`:
  1. Call `addTerminalTab()` with shell type from `sessionInfo.shelltype`
  2. Once new tab's `TermWrap` is ready, write historical ANSI data
  3. New shell process starts in `sessionInfo.cwd`

**Hidden tab strategy:** Inactive sub-sessions use `visibility: hidden; position: absolute; overflow: hidden` with explicit width/height matching the active terminal's container — NOT `display: none`. This is critical because:
- `display: none` causes `FitAddon.proposeDimensions()` to return 0x0, corrupting buffer layout on resize
- `terminal.open(elem)` requires the element to be in the layout for proper initialization

**WebGL resource management:** Only the active sub-session loads the `WebglAddon`. When switching tabs:
1. Dispose WebglAddon on the deactivating tab (`webglAddon.dispose()`)
2. Load WebglAddon on the activating tab
This prevents exhausting the browser's WebGL context limit (~8-16 per page). Inactive tabs fall back to the canvas renderer, which has no context limit.

#### 4.2.2 Session History Dropdown — `frontend/app/view/term/session-history-dropdown.tsx`

Redesigned dropdown with:

**Entry component** — each session entry shows:
```
[shell-icon] [shell-name]  [cwd-basename]     [timestamp]
             [connection]  [segments] [size]   [live/dead dot]
```

**Shell type icons**: Map shell types to icons:
- `pwsh` → PowerShell icon
- `zsh` / `bash` → terminal icon with shell name
- `wsl:*` → Linux penguin icon + distro name

**Sections**:
- "THIS TERMINAL" — all sessions for this blockId, no truncation, paginated
- "SAME DIRECTORY" — filtered by shell type by default, toggle for all

**Action buttons per entry**:
- Click row → load scrollback into current terminal
- Viewer icon button → open in separate viewer block
- "Resume" button → create new tab with this session's shell + scrollback

**Shell filter toggle**: Pill buttons at top of "SAME DIRECTORY" section: `[All] [pwsh] [zsh] [bash] [wsl:Ubuntu]` — derived from available shell types in the results.

#### 4.2.3 `TermTabStrip` — `frontend/app/view/term/term-tab-strip.tsx`

Same as original spec: horizontal tab strip, 28px height, accent-color active indicator, shell integration status dots, close buttons, `+` button.

**Addition**: Restored session indicator — when `restoredSessionIndicator` is true, the active tab shows a small clock icon overlay on the shell icon to indicate the buffer shows historical content.

#### 4.2.4 `TerminalView` — `frontend/app/view/term/term.tsx`

- Renders `TermTabStrip` when `subBlockIds.length > 0`
- Multiple `div.term-connectelem` elements; active one visible, inactive ones use `visibility: hidden` with explicit dimensions (not `display: none`)
- `ResizeObserver` only tracks active session

#### 4.2.5 Keyboard Shortcuts — `frontend/app/view/term/term-model.ts`

Register block-level shortcuts in `handleTerminalKeydown` (in `term-model.ts`, NOT `keymodel.ts`):
- `Ctrl:Shift:T` — new terminal tab (falls through to Tab Management when no sub-sessions)
- `Ctrl:Shift:Q` — calls `model.closeTerminalTab(activeTabId)` when 2+ sessions exist. (`Ctrl+Shift+W` is reserved for tab-level close in the Tab Close Warning spec.)
- `Ctrl:Tab` / `Ctrl:Shift:Tab` — cycle sessions within block (falls through to global maximize-mode when single session)

**Shortcut priority chain:** Block-level `handleTerminalKeydown` > global `appHandleKeyDown`. The block handler checks `subBlockIds.length > 0` before intercepting.

**Conflict resolution:**
- `Ctrl+Shift+T`: In multi-session terminals, creates new tab. Otherwise, opens Tab Management.
- `Ctrl+Tab`/`Ctrl+Shift+Tab`: In multi-session terminals, cycles sub-sessions. Otherwise, cycles maximized blocks (`keymodel.ts:566-578`).

#### 4.2.6 Session History Capture — `frontend/app/view/term/sessionhistory-capture.ts`

**Modifications:**
- `saveRollingCapture()` now passes `shellType` to `SaveRollingSegment` RPC
- Shell type extracted from `blockData.meta["term:shelltype"]` (persisted during controller startup; see Fix 6 in Section 3.5)

**Serialize options for historical snapshots:** When creating snapshot segments (not rolling segments), use `serializeAddon.serialize({ excludeModes: true, excludeAltBuffer: true })`. This prevents restoring terminal modes (like alternate screen) into a live terminal when loading historical sessions. Rolling segments continue to use default serialization (modes included) since they restore into a fresh terminal on startup.

### 4.3 Backend Changes

**`pkg/sessionhistory/sessionhistory.go`:**
- Add `ShellType` to `SessionMeta` struct
- Update `meta.json` serialization/deserialization

**`pkg/sessionhistory/sessionhistory_ops.go`:**
- `SaveRollingSegment` accepts `shellType` parameter, writes to meta
- `ListSessions` returns `ShellType` in `SessionInfo`
- **Fix pagination**: Remove any truncation limits — return ALL sessions for a block. If performance is a concern, add cursor-based pagination (not limit-based truncation).

**`pkg/service/sessionhistoryservice/sessionhistoryservice.go`:**
- Update `SaveRollingSegment` signature to include `shellType`
- Update `ListSessionHistory` to return complete session list with shell types

**`pkg/waveobj/wtypemeta.go`:**
- Add `TermActiveTabId` and `TermTabName` to `MetaTSType`
- Run `task generate`

No new controller types. Each sub-block gets its own `ShellController` via existing `controllerRegistry`.

### 4.4 RPC/API Changes

No new RPC commands. Uses existing:
- `CreateSubBlockCommand` — create new session sub-block
- `DeleteSubBlockCommand` — remove session sub-block
- `SetMetaCommand` — persist `term:activetabid`, `term:tabname`
- `ControllerResyncCommand` — per-session blockId
- `ControllerInputCommand` — per-session blockId
- `SessionHistoryService.SaveRollingSegment` — updated signature (add `shellType`)
- `SessionHistoryService.ListSessionHistory` — returns full list with shell types
- `SessionHistoryService.ReadSegment` — read historical session data for buffer restoration

---

## 5. UI/UX Design

### Tab Strip Layout (when 2+ sessions exist)

```
+---------------------------------------------------------------------+
| [pwsh *] [zsh: proj] [bash: build x] [+]                            |  <- 28px
+---------------------------------------------------------------------+
|                                                                     |
|                    xterm.js terminal output                         |
|                                                                     |
+---------------------------------------------------------------------+
```

- Tab strip only visible with 2+ sessions
- Active tab: accent-color bottom border
- Shell integration status dot: green (ready), amber (running-command), absent (null)
- Restored session indicator: clock icon overlay on tab when showing historical buffer
- Close button on hover (hidden when only one tab)
- `+` button always visible
- Horizontal scroll for many tabs

### Session History Dropdown (redesigned)

```
+----------------------------------------------------+
| Session History                             [filter]|
+----------------------------------------------------+
| THIS TERMINAL                                       |
| [pwsh] G:/Code/waveterm       1h ago  1.4KB  [*]  |
| [pwsh] G:/Code/waveterm       3h ago  14KB   [ ]  |
| [zsh]  ~/waveterm (WSL)       1d ago  3KB    [ ]  |
+----------------------------------------------------+
| SAME DIRECTORY  [All] [pwsh] [zsh]                  |
| [pwsh] G:/Code/waveterm  T3   1h ago  15KB   [ ]  |
| [pwsh] G:/Code/waveterm  T7   2h ago  8KB    [ ]  |
+----------------------------------------------------+
```

Entry click actions:
- **Click**: Load scrollback into current terminal
- **Ctrl+Click** or eye icon: Open in separate viewer
- **"+" icon**: Resume in new tab (creates sub-block with same shell type)

### Loading State

When loading a historical session (`loadSessionIntoBuffer`):
1. The terminal viewport shows a centered spinner with "Loading session..." text
2. The spinner is a React overlay (not terminal content)
3. The spinner disappears when `terminal.write()` callback fires (write complete)
4. For sessions > 1MB, a progress indicator shows bytes written / total bytes

### Context Menu (right-click in terminal)

Add two items:
- "New Terminal Tab" — creates new sub-session
- "Close Terminal Tab" — closes active sub-session (when 2+ exist)

### Inline Tab Name Editing

Double-click tab label → inline text input → Enter commits, Escape cancels. Empty name reverts to auto-derived shell name.

---

## 6. Dependency Order

1. **Go meta keys** — Add `TermActiveTabId`, `TermTabName` to `wtypemeta.go` + `task generate`
2. **Session metadata** — Add `ShellType` to `SessionMeta`, update save/list/read operations
3. **Session history service** — Fix pagination (return all sessions), add shell type to responses
4. **`TermViewModel` multi-session state** — `subBlockIdsAtom`, `activeTabIdAtom`, `subViewModels`, tab CRUD methods
5. **`TermViewModel` session history state** — `loadSessionIntoBuffer`, `resumeSessionInNewTab`, `sessionHistoryAtom`
6. **Session history dropdown redesign** — shell type labels, filtering, new action buttons
7. **`TermTabStrip` component** — tab strip UI + restored session indicator
8. **`TerminalView` multi-session rendering** — multiple connect elements, tab strip
9. **Keyboard shortcuts** — block-level in `handleTerminalKeydown`
10. **Session history capture** — pass shell type to `SaveRollingSegment`

Steps 1-3 are sequential (backend). Steps 4-5 depend on 1-3. Steps 6-10 depend on 4-5 but are independent of each other.

---

## 7. Acceptance Criteria

### Data Model
- [ ] `TermActiveTabId` and `TermTabName` meta keys in `metaconsts.go` and `gotypes.d.ts`
- [ ] `SessionMeta` has `ShellType` field persisted in `meta.json`
- [ ] `SessionInfo` response type includes `shelltype` field
- [ ] Creating a sub-block results in a DB record with correct `parentoref`
- [ ] `term:activetabid` persisted and restored on app reload

### Session Independence
- [ ] Each tab has its own independent PTY process
- [ ] Input in tab A does not appear in tab B
- [ ] Resize only affects the active session
- [ ] OSC 7 updates only the active session's `cmd:cwd`
- [ ] Shell integration status reflects each session independently

### Tab Strip UI
- [ ] Tab strip hidden when only one session exists
- [ ] Tab strip appears when second session created
- [ ] Active tab has accent-color bottom border
- [ ] Each tab shows shell name / `term:tabname`
- [ ] Shell integration status dot visible and correct per tab
- [ ] Close button hidden when it would leave zero sessions
- [ ] Double-click tab name enables inline rename
- [ ] `+` button creates new session and switches to it
- [ ] Right-click shows "New Terminal Tab" context menu item
- [ ] Right-click shows "Close Terminal Tab" when 2+ sessions exist

### Session History Dropdown
- [ ] "THIS TERMINAL" shows ALL sessions for this block — no truncation
- [ ] Each entry shows shell type icon and name (pwsh, zsh, bash, wsl:Ubuntu)
- [ ] Each entry shows timestamp, size, and segment count
- [ ] Live sessions have green indicator; dead sessions have gray
- [ ] "SAME DIRECTORY" shows terminal widget ID and shell type per entry
- [ ] "SAME DIRECTORY" filters by current shell type by default
- [ ] Shell filter toggle shows all shells when activated
- [ ] WSL sessions are visually distinct from native PowerShell sessions

### Session Loading
- [ ] Clicking a historical session loads its scrollback into the current terminal buffer
- [ ] Before loading, current terminal state is saved as a snapshot (`switch` reason)
- [ ] Restored buffer shows colors, formatting, and content correctly (ANSI round-trip)
- [ ] Tab shows restored-session indicator (clock icon) after loading historical data
- [ ] Shell process remains live behind restored buffer — typing appends normally
- [ ] Ctrl+Click opens session in separate read-only viewer (existing behavior preserved)
- [ ] "Resume in New Tab" creates sub-block with correct shell type and loads scrollback

### Live Session Switching
- [ ] Switching tabs preserves scrollback, cursor position, and shell state
- [ ] Inactive tab's shell continues running (processes don't stop)
- [ ] Tab-switch snapshot saved when deactivating a tab; rolling capture stopped for inactive tabs
- [ ] Switching back to a tab shows exact state as left

### Keyboard Shortcuts
- [ ] `Ctrl:Shift:T` creates new terminal tab when focused in multi-session terminal
- [ ] `Ctrl:Shift:Q` closes active terminal tab when 2+ sessions exist (`Ctrl+Shift+W` is reserved for tab-level close)
- [ ] `Ctrl:Tab` cycles forward through sessions
- [ ] `Ctrl:Shift:Tab` cycles backward through sessions
- [ ] Shortcuts fall through to global handlers when block has single session

### Existing Features Preserved
- [ ] Single-session terminals behave identically to today
- [ ] Session history / rolling capture works per session
- [ ] Durable session mode applies per sub-block
- [ ] Terminal theme, font size overrides apply per sub-block
- [ ] Multi-input mode broadcasts to all sessions including sub-blocks
- [ ] Block frame header shows primary block's icon and name
- [ ] Closing block frame destroys all sub-sessions

### Accessibility
- [ ] Tab strip items focusable via keyboard, announce name and status to screen readers
- [ ] Active tab indicated via `aria-selected="true"`
- [ ] Shell integration status dot has `aria-label`
- [ ] Close button has `aria-label="Close {tab name}"`
- [ ] Session history dropdown entries are keyboard-navigable
- [ ] Session action buttons (load, view, resume) have descriptive `aria-label`

### Session Loading Safety
- [ ] Rolling capture is paused while terminal shows restored historical content
- [ ] "Return to live session" banner appears when historical content is displayed
- [ ] Clicking "Return to live session" restores the live rolling segment content
- [ ] Terminal dimensions are matched before writing historical ANSI data (resize-write-resize)
- [ ] Loading state (spinner) shown during large session restoration
- [ ] Confirmation dialog shown when replacing buffer with >100 lines of content
- [ ] Historical snapshots use `excludeModes: true, excludeAltBuffer: true`
- [ ] Only active sub-session runs rolling capture; inactive tabs have their timer stopped
- [ ] WebglAddon is loaded only on the active sub-session; inactive tabs use canvas renderer
- [ ] Hidden tabs use `visibility: hidden` (not `display: none`) with explicit dimensions

### Shell Type
- [ ] Shell type is persisted to `block.meta["term:shelltype"]` during controller startup
- [ ] Session history entries display the correct shell type icon and name
- [ ] "Resume in New Tab" starts the correct shell type from session metadata

### Build
- [ ] `go build ./...` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes with zero failures

---

## Key Reference Files

- `pkg/waveobj/wtype.go:284-293` — `Block` struct with `SubBlockIds`
- `pkg/wcore/block.go:20-52` — `CreateSubBlock` / `createSubBlockObj`
- `pkg/wshrpc/wshrpctypes.go:259-262` — `CommandCreateSubBlockData`
- `frontend/app/view/term/term-model.ts:44-50` — `TermViewModel`
- `frontend/app/view/term/term.tsx:140-230` — `TermWrap` lifecycle
- `frontend/app/view/term/termwrap.ts:73-115` — `TermWrap` class
- `frontend/app/view/term/termwrap.ts:134-142` — `SerializeAddon` + `WebLinksAddon`
- `frontend/app/view/term/termwrap-history.ts` — session restore on load
- `frontend/app/view/term/sessionhistory-capture.ts` — rolling/snapshot capture
- `pkg/sessionhistory/sessionhistory.go` — `SessionMeta`, `Store`
- `pkg/sessionhistory/sessionhistory_ops.go` — save/list/read operations
- `pkg/blockcontroller/shellcontroller.go:49-77` — `ShellController`
- `pkg/waveobj/wtypemeta.go:112-131` — existing `term:*` meta keys
