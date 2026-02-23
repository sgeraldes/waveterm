# Terminal Session History Implementation Plan

Created: 2026-02-23
Status: PENDING
Approved: Yes
Iterations: 0
Worktree: Yes

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

**Goal:** Add a terminal session history system that continuously captures scrollback buffer output and stores it as flat files on disk, with UI to browse and recover past terminal output — including content lost to clear-screen events.

**Architecture:** Frontend-driven capture using xterm.js SerializeAddon (already loaded). Terminal buffer is serialized before truncate/clear events and periodically on an idle timer. Serialized ANSI content is sent to a new Go backend service (`SessionHistoryService`) which writes flat files to `{WaveDataDir}/session-history/{block-id}/`. A new header dropdown (floating-ui panel) lets users browse and restore past sessions in a read-only xterm.js viewer block.

**Tech Stack:** xterm.js SerializeAddon (existing), @floating-ui/react (existing), Go flat file I/O, new "termhistory" block view type with read-only xterm.js.

## Scope

### In Scope

- Continuous rolling capture of terminal scrollback buffer (serialized ANSI) via a fixed `rolling.ansi` file per block, overwritten in place
- Pre-truncate capture: save buffer as a numbered snapshot segment before clear-screen destroys it
- Capture on terminal block close/dispose (best-effort async)
- Flat file storage: `{WaveDataDir}/session-history/{block-id}/` with `rolling.ansi`, `{timestamp}.ansi` snapshots, and `meta.json`
- New `SessionHistoryService` Go backend service for save/list/read/cleanup operations
- Session history icon button in terminal block header (clock-rotate-left icon)
- Floating dropdown panel showing past sessions grouped by "This Terminal" / "Same Directory"
- Read-only terminal viewer block type (`termhistory`) for viewing past session content
- Dual cleanup policy: 500MB total cap + 30-day age limit
- Cleanup runs on startup and periodically (hourly)
- Session history files persist beyond block deletion (intentional — users want to recover history even after closing terminals)

### Out of Scope

- Remote terminal session capture (only local terminal blocks)
- Full-text search across session history content (dropdown session-list filtering is also deferred)
- Export/share functionality for session history
- Session history for non-terminal block types (AI, preview, etc.)
- Compression of stored ANSI files (may be added later)

## Prerequisites

- xterm.js SerializeAddon is already loaded in TermWrap (confirmed at `termwrap.ts:577`)
- @floating-ui/react is already a dependency (used by DurableSessionFlyover)
- Wave's service infrastructure supports adding new services via ServiceMap

## Context for Implementer

> This section is critical for cross-session continuity. Write it for an implementer who has never seen the codebase.

- **Patterns to follow:**
  - Backend service pattern: Follow `pkg/service/blockservice/blockservice.go` — struct with methods, `_Meta()` methods for TS codegen, registered in `pkg/service/service.go:ServiceMap`
  - Floating UI dropdown: Follow `frontend/app/block/durable-session-flyover.tsx` — uses `@floating-ui/react` with `useFloating`, `useHover`, `useInteractions`, `FloatingPortal`
  - Header icon buttons: See `frontend/app/block/blockframe-header.tsx:110` (`HeaderEndIcons`) — `endIconButtons` atom from ViewModel drives the icon list
  - New view type registration: See `frontend/app/block/block.tsx` lines 43-54, `BlockRegistry` Map. Use `BlockRegistry.set("termhistory", TermHistoryViewModel)`. The view model constructor must accept `(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel)` to match the `ViewModelClass` interface even if tabModel is unused.
  - Terminal serialization: `termwrap.ts:946` — `this.serializeAddon.serialize()` produces full ANSI-encoded terminal state

- **Conventions:**
  - Go packages: lowercase single word (`sessionhistory`)
  - TypeScript files: kebab-case (`session-history-dropdown.tsx`)
  - All Go service methods need `_Meta()` companions for TS codegen
  - Run `task generate` after adding/changing service methods

- **Key files the implementer must read first:**
  - `frontend/app/view/term/termwrap.ts` — TermWrap class, `handleNewFileSubjectData` (truncate handling at line 842), `processAndCacheData` (idle serialization at line 942), `serializeAddon` usage
  - `frontend/app/view/term/term-model.ts` — TermViewModel, `endIconButtons` atom (line 229), `getSettingsMenuItems` (line 827). **CRITICAL:** The `endIconButtons` atom has an early-return guard at line 244 (`if (blockData?.meta?.['controller'] != 'cmd' && shellProcStatus != 'done') { return rtn; }`) that hides all buttons when shell is running. The session history button MUST be added BEFORE this guard.
  - `frontend/app/block/blockframe-header.tsx` — HeaderEndIcons component (line 110), how endIconButtons renders
  - `frontend/app/block/block.tsx` — `BlockRegistry` Map (lines 43-54), `makeViewModel` (line 59) — where view types are registered
  - `frontend/app/block/durable-session-flyover.tsx` — Pattern for floating dropdown from header
  - `pkg/blockcontroller/blockcontroller.go` — `HandleTruncateBlockFile` (line 349), `HandleAppendBlockFile` (line 327)
  - `pkg/service/service.go` — ServiceMap registration, service validation
  - `pkg/service/blockservice/blockservice.go` — Pattern for service methods
  - `pkg/wavebase/wavebase.go` — `GetWaveDataDir()` (line 125) for data directory path. In production resolves to `~/.waveterm/`, in dev mode to `~/.waveterm-dev/`.

- **Gotchas:**
  - `serializeAddon.serialize()` returns a string with ANSI escape sequences — this is the complete terminal state including scrollback, not raw PTY output
  - `handleNewFileSubjectData` with `fileop == "truncate"` calls `terminal.clear()` — we must serialize BEFORE this call
  - The `processAndCacheData` method only runs if `dataBytesProcessed >= MinDataProcessedForCache (100KB)` — our rolling capture should have its own threshold
  - Services are auto-discovered via reflection — method names must be PascalCase, and `_Meta()` methods provide TS codegen hints
  - After adding a new service, you must: add to ServiceMap, run `task generate`, verify the TS bindings in `frontend/app/store/services.ts`
  - The `endIconButtons` atom has a guard that returns early for running shells — history button must be BEFORE this guard
  - TermWrap `dispose()` is called synchronously from React useEffect cleanup — async saves during dispose are best-effort (fire-and-forget)
  - The `tab:basedir` metadata is on the Tab object, not the Block object. Access via `WOS.getObjectValue(makeORef('tab', tabId))?.meta?.['tab:basedir']`

- **Domain context:**
  - Terminal blocks have a `blockId` which is the primary key for all block data
  - Blocks belong to tabs, tabs have `tab:basedir` metadata for the project directory
  - The `cmd:cwd` metadata on blocks tracks the current working directory reported via OSC 7
  - Block metadata is accessible via `WOS.getWaveObjectAtom<Block>` on frontend, `wstore.DBMustGet` on backend
  - Session history files intentionally persist beyond block deletion. Cleanup uses age/size policies, not block lifecycle. This allows users to recover terminal output even after closing blocks.

## Runtime Environment

- **Start command:** `task dev` (starts Electron + Go backend + Vite HMR)
- **Dev logs:** `~/.waveterm-dev/waveapp.log`
- **Code generation:** `task generate` (must run after Go type/service changes)
- **Tests:** `npm test` (frontend), `go test ./pkg/...` (backend)

## Progress Tracking

**MANDATORY: Update this checklist as tasks complete. Change `[ ]` to `[x]`.**

- [x] Task 1: Go session history storage package
- [x] Task 2: Go session history service (frontend API)
- [x] Task 3: Frontend capture integration (TermWrap)
- [x] Task 4: Session history header button and dropdown
- [ ] Task 5: Read-only terminal history viewer block
- [ ] Task 6: Cleanup policy and startup integration

**Total Tasks:** 6 | **Completed:** 4 | **Remaining:** 2

## Implementation Tasks

### Task 1: Go Session History Storage Package

**Objective:** Create the core `sessionhistory` Go package that handles writing, reading, listing, and cleaning up session history files on disk.

**Dependencies:** None

**Files:**

- Create: `pkg/sessionhistory/sessionhistory.go`
- Create: `pkg/sessionhistory/sessionhistory_test.go`

**Key Decisions / Notes:**

- Storage directory: `filepath.Join(wavebase.GetWaveDataDir(), "session-history")`
- In production this resolves to `~/.waveterm/session-history/`, in dev mode to `~/.waveterm-dev/session-history/`.
- **Two types of segment files per block directory:**
  1. `rolling.ansi` — overwritten in-place on every rolling capture (30s timer). Represents the current terminal state. Only one exists per block at a time.
  2. `{unix-millis-timestamp}.ansi` — created on truncate (clear-screen) and close events. These are numbered snapshots that persist. The timestamp is Unix millis at save time.
- `meta.json` — metadata file per block: `{blockId, tabId, tabBaseDir, connection, cwd, createdAt, lastUpdatedAt}`
  - Does NOT contain a segments array. Segment info is derived from the filesystem at list time (os.ReadDir + file stat) to avoid concurrent write corruption.
  - Only written on first save for a block (create) and on metadata changes (cwd update). NOT updated on every segment save.
- **Concurrency:** Use a per-block `sync.Mutex` (map keyed by blockId, protected by a global RWMutex) to serialize all operations per block directory.
- Key functions:
  - `SaveRollingSegment(blockId string, content []byte, meta SessionMeta) error` — overwrites `rolling.ansi` and creates/updates `meta.json` if needed
  - `SaveSnapshotSegment(blockId string, content []byte, meta SessionMeta, reason string) error` — writes a new `{timestamp}.ansi` file
  - `ListSessions(filter SessionFilter) ([]SessionInfo, error)` — lists session metadata by walking block directories and stat-ing `.ansi` files
  - `ReadSegment(blockId string, filename string) ([]byte, error)` — reads a specific segment file
  - `ReadLatestSegments(blockId string, maxBytes int64) ([]byte, []string, error)` — reads the most recent segments up to maxBytes total, returns concatenated content and list of filenames read
  - `Cleanup(maxAge time.Duration, maxTotalSize int64) error` — removes old segments and enforces size cap
  - `GetTotalSize() (int64, error)` — calculates total session-history directory size
- SessionMeta struct: `{BlockId, TabId, TabBaseDir, Connection, Cwd string; CreatedAt, LastUpdatedAt int64}`
- SessionFilter struct: `{BlockId, TabBaseDir string}` — both optional, used for listing
- SessionInfo struct: returned from list, includes metadata + computed segment summary (count, total size, newest/oldest timestamp)

**Definition of Done:**

- [ ] All Go tests pass: `go test ./pkg/sessionhistory/`
- [ ] SaveRollingSegment overwrites `rolling.ansi` in place (verified by saving twice and checking file count stays at 1)
- [ ] SaveSnapshotSegment creates timestamped `.ansi` files (verified by saving twice and checking 2 distinct files)
- [ ] ListSessions returns sessions filtered by blockId and by baseDir
- [ ] ReadSegment returns correct content for both rolling and snapshot files
- [ ] ReadLatestSegments respects maxBytes limit and returns only most recent segments
- [ ] Cleanup removes files older than maxAge and enforces maxTotalSize
- [ ] Per-block mutex prevents concurrent write corruption (test with parallel goroutines)
- [ ] No lint errors: `go vet ./pkg/sessionhistory/`

**Verify:**

- `go test -v ./pkg/sessionhistory/`
- `go vet ./pkg/sessionhistory/`

---

### Task 2: Go Session History Service (Frontend API)

**Objective:** Create a `SessionHistoryService` registered in the ServiceMap so the frontend can call save/list/read operations via the standard service RPC mechanism.

**Dependencies:** Task 1

**Files:**

- Create: `pkg/service/sessionhistoryservice/sessionhistoryservice.go`
- Create: `pkg/service/sessionhistoryservice/sessionhistoryservice_test.go`
- Modify: `pkg/service/service.go` (add to ServiceMap)
- Modify: `frontend/app/store/services.ts` (auto-generated by `task generate`)

**Key Decisions / Notes:**

- Service name in ServiceMap: `"sessionhistory"`
- Methods (all take `ctx context.Context` as first arg):
  - `SaveRollingSegment(ctx, blockId string, content string, tabId string, tabBaseDir string, connection string, cwd string) error` — calls `sessionhistory.SaveRollingSegment`
  - `SaveSnapshotSegment(ctx, blockId string, content string, tabId string, tabBaseDir string, connection string, cwd string, reason string) error` — calls `sessionhistory.SaveSnapshotSegment`
  - `ListSessionHistory(ctx, blockId string, tabBaseDir string) ([]SessionInfo, error)` — calls `sessionhistory.ListSessions`
  - `ReadSessionSegment(ctx, blockId string, filename string) (string, error)` — reads a single segment, returns base64-encoded content. Frontend loads segments individually, not all at once.
  - `ReadLatestSegments(ctx, blockId string, maxBytes int64) (string, error)` — reads most recent segments up to maxBytes, returns base64-encoded concatenated content
  - `CleanupSessionHistory(ctx) error` — calls `sessionhistory.Cleanup` with configured limits (500MB, 30 days)
- Each method needs a `_Meta()` companion for TS codegen (follow `blockservice.go` pattern)
- The `content` parameter for save methods is a string (serialized ANSI from xterm.js). Cap at 5MB per call — return error if exceeded.
- **No `ReadAllSegments` method.** Loading is either per-segment or via `ReadLatestSegments` with a byte cap, avoiding the unbounded response size problem.
- After creating, run `task generate` to produce TS bindings
- Verify the HTTP server in wavesrv does not have a restrictive body size limit that would reject 5MB payloads. The existing `SaveTerminalState` uses the same pattern with large strings, so this should be safe.

**Definition of Done:**

- [ ] Service registered in ServiceMap at `pkg/service/service.go`
- [ ] All methods have `_Meta()` companions
- [ ] `task generate` succeeds and `SessionHistoryServiceType` class exists in `frontend/app/store/services.ts` with methods `SaveRollingSegment`, `SaveSnapshotSegment`, `ListSessionHistory`, `ReadSessionSegment`, `ReadLatestSegments`, `CleanupSessionHistory`
- [ ] `go build ./pkg/service/...` passes and `task check:ts` passes
- [ ] Round-trip integration test passes: save a segment, list it, read it back, confirm content matches
- [ ] 5MB content cap is enforced — save with > 5MB content returns error

**Verify:**

- `go test -v ./pkg/service/sessionhistoryservice/`
- `go build ./pkg/service/...`
- `task generate` completes without errors
- `task check:ts` passes

---

### Task 3: Frontend Capture Integration (TermWrap)

**Objective:** Modify TermWrap to capture terminal buffer content before clear events, periodically (rolling), and on dispose. Send captured content to the backend SessionHistoryService.

**Dependencies:** Task 2

**Files:**

- Modify: `frontend/app/view/term/termwrap.ts`
- Modify: `frontend/app/view/term/term-model.ts` (pass tab metadata to TermWrap)

**Key Decisions / Notes:**

- **Pre-truncate capture (snapshot):** In `handleNewFileSubjectData`, when `msg.fileop == "truncate"`, serialize the buffer BEFORE calling `terminal.clear()`:
  ```typescript
  if (msg.fileop == "truncate") {
      this.saveSessionSnapshot("clear");  // serialize + send to backend as snapshot
      this.terminal.clear();
      this.heldData = [];
  }
  ```
- **Rolling capture:** Add a new `sessionHistoryTimer` (setInterval, 30 seconds). On each tick, serialize the buffer and call `services.SessionHistoryService.SaveRollingSegment()`. Track `lastRollingContent` (length or hash) to skip saves when content hasn't changed.
- **Dispose capture (best-effort):** Add `this.saveSessionSnapshot("close")` in the dispose/cleanup path via `fireAndForget()`. This is async in a sync context — the save may not complete if the block is torn down quickly. This is acknowledged as a known limitation: the most recent terminal state will usually be captured by the rolling capture (which fires every 30s), so the dispose capture is a "best-effort last chance" save.
- **New methods on TermWrap:**
  - `saveSessionSnapshot(reason: string)` — serializes terminal, sends as snapshot segment
  - `saveRollingCapture()` — serializes terminal, sends as rolling segment (overwrite)
  - Both use `services.SessionHistoryService` via `fireAndForget()`
- **Tab metadata access:** Read `tab:basedir` at save time from the global store:
  ```typescript
  const tabData = globalStore.get(WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", this.tabId)));
  const tabBaseDir = tabData?.meta?.["tab:basedir"] ?? "";
  ```
  When `tabBaseDir` is empty, save with empty string. The "Same Directory" filter in the dropdown will only group sessions with matching non-empty basedirs.
- **Block metadata for cwd:** Read from block atom:
  ```typescript
  const blockData = globalStore.get(WOS.getWaveObjectAtom<Block>(WOS.makeORef("block", this.blockId)));
  const cwd = blockData?.meta?.["cmd:cwd"] ?? "";
  const connection = blockData?.meta?.connection ?? "";
  ```
- **Minimum content threshold:** Only save if serialized output is > 100 bytes (skip empty terminals)
- **Debounce snapshots:** Don't save snapshot if last snapshot was < 10 seconds ago (prevent spam on rapid clears)
- **Size cap:** Skip save with console warning if serialized output > 5MB
- **Cleanup on TermWrap dispose:** Clear the `sessionHistoryTimer` interval

**Definition of Done:**

- [ ] Pre-truncate capture works: clearing terminal saves a snapshot segment to `{WaveDataDir}/session-history/{block-id}/{timestamp}.ansi` before content is lost
- [ ] A `rolling.ansi` file exists in `{WaveDataDir}/session-history/{block-id}/` within 30 seconds of the terminal having > 100 bytes of new content (verified by running a command and checking the directory)
- [ ] A new or updated `rolling.ansi` file is NOT created if the terminal content has not changed since the last save (verify by checking file mtime after an idle period)
- [ ] Dispose capture fires `saveSessionSnapshot("close")` as best-effort async
- [ ] Minimum content threshold (100 bytes) prevents saving empty sessions
- [ ] Snapshot debounce (10s) prevents rapid duplicate saves
- [ ] Size cap (5MB) prevents saving oversized content
- [ ] `sessionHistoryTimer` is cleared on dispose
- [ ] No TypeScript type errors: `task check:ts`

**Verify:**

- `task check:ts` passes
- Run app with `task dev`, open terminal, run commands, check `~/.waveterm-dev/session-history/` for rolling.ansi and meta.json files
- Clear terminal (`clear` command), verify a timestamped snapshot .ansi file appears

---

### Task 4: Session History Header Button and Dropdown

**Objective:** Add a session history icon button to the terminal block header that opens a floating dropdown panel showing past sessions.

**Dependencies:** Task 2, Task 3

**Files:**

- Create: `frontend/app/view/term/session-history-dropdown.tsx`
- Create: `frontend/app/view/term/session-history-dropdown.scss`
- Modify: `frontend/app/view/term/term-model.ts` (add button to endIconButtons BEFORE the shellProcStatus guard)

**Key Decisions / Notes:**

- **Icon:** `clock-rotate-left` (FontAwesome) — positioned before the cog button in `endIconButtons`
- **CRITICAL: Button must be added BEFORE the early-return guard.** In the `endIconButtons` atom (line 229 of term-model.ts), the history button must be pushed to `rtn` BEFORE the guard at line 244 (`if (blockData?.meta?.['controller'] != 'cmd' && shellProcStatus != 'done') { return rtn; }`). Otherwise the button is invisible during normal terminal operation (shell running), which is the primary use case. The button should always be visible regardless of shell status.
- **Dropdown pattern:** Follow `durable-session-flyover.tsx` using `@floating-ui/react`:
  - `useFloating` with `placement: "bottom-end"`, `flip()`, `shift()`, `offset(8)`
  - `FloatingPortal` for rendering outside block bounds
  - Click-triggered (not hover) — use `useClick` interaction
- **Dropdown content:**
  - Header: "Session History"
  - Two sections: "This Terminal" | "Same Directory"
  - Each entry shows: timestamp (relative, e.g., "2 hours ago"), CWD path, total segment size
  - Click an entry → opens a new `termhistory` block (Task 5) with that block's session content
  - Empty state: "No session history yet"
  - **Search/filter within the dropdown is deferred** — the current iteration shows all entries. "Search" in the user requirements refers to in-content search (Ctrl+F within the viewer, Task 5), not session-list filtering.
- **Data fetching:** On dropdown open, call `services.SessionHistoryService.ListSessionHistory(blockId, tabBaseDir)` and display results
- **Atom for dropdown visibility:** Add `sessionHistoryOpen: jotai.PrimitiveAtom<boolean>` on TermViewModel

**Definition of Done:**

- [ ] Clock icon button appears in terminal block header, positioned before cog, visible while shell is running (not hidden by shellProcStatus guard)
- [ ] Clicking the icon opens a floating dropdown panel
- [ ] Dropdown fetches and displays session history entries from backend
- [ ] Entries are grouped into "This Terminal" and "Same Directory" sections
- [ ] Clicking an entry dispatches action to open history viewer (Task 5)
- [ ] Dropdown closes on outside click or Escape
- [ ] No TypeScript type errors: `task check:ts`
- [ ] No console errors when opening/closing dropdown (verified via Electron MCP `read_electron_logs`)

**Verify:**

- `task check:ts` passes
- Electron MCP: `take_screenshot` showing clock-rotate-left icon in terminal header
- Electron MCP: `click_by_text` or `send_command_to_electron` to open dropdown, `take_screenshot` to confirm it renders
- Electron MCP: `read_electron_logs(logType="console")` confirms no runtime errors

---

### Task 5: Read-Only Terminal History Viewer Block

**Objective:** Create a new block view type (`termhistory`) that displays past session content in a read-only xterm.js terminal instance.

**Dependencies:** Task 2

**Files:**

- Create: `frontend/app/view/term/termhistory.tsx`
- Create: `frontend/app/view/term/termhistory-model.ts`
- Modify: `frontend/app/block/block.tsx` (register in `BlockRegistry`)
- Modify: `frontend/types/custom.d.ts` (if new types needed)

**Key Decisions / Notes:**

- **Block metadata:** `view: "termhistory"`, `termhistory:blockid: "<source-block-id>"` — identifies which session to load
- **View model:** `TermHistoryViewModel implements ViewModel` — constructor signature must be `(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel)` to match ViewModelClass interface, even though tabModel may not be used
- **Registration:** `BlockRegistry.set("termhistory", TermHistoryViewModel)` in `block.tsx`
- **Terminal setup:** Create xterm.js Terminal with same theme/font settings as user's current terminal, but:
  - Disable keyboard input: attach a `customKeyEventHandler` that returns false for all keys except Ctrl+F (search), preventing input from being sent anywhere
  - Load `SearchAddon` for searching through history content (Ctrl+F)
  - Load `FitAddon` for proper sizing
  - Load `WebglAddon` for performance (if supported)
- **Content loading:** On mount, call `services.SessionHistoryService.ReadLatestSegments(sourceBlockId, 10 * 1024 * 1024)` (10MB cap) → decode base64 → write to terminal via `terminal.write()`. Content containing ANSI color sequences (e.g., ESC[32m) renders as colored text, not as raw escape code characters.
- **Header:** Show icon `clock-rotate-left`, view name "Session History", and the source terminal's CWD in the header text
- **Opening from dropdown (Task 4):** Call `createBlock({ meta: { view: "termhistory", "termhistory:blockid": blockId } })`

**Definition of Done:**

- [ ] `termhistory` view type registered in `BlockRegistry` in `block.tsx` and renders correctly
- [ ] Content loads from session history backend. ANSI color sequences render as colored text (not raw escape codes like `ESC[32m`). Verified by saving a session with colored output (e.g., `ls --color`) and confirming the viewer shows colors via Electron MCP screenshot.
- [ ] Terminal is read-only (keyboard input does not produce characters or send data to backend)
- [ ] Search works within the history viewer (Ctrl+F opens search, finds text)
- [ ] Header shows clock-rotate-left icon, "Session History" view name, and source CWD
- [ ] Constructor accepts `(blockId, nodeModel, tabModel)` to match ViewModelClass interface
- [ ] No TypeScript type errors: `task check:ts`

**Verify:**

- `task check:ts` passes
- Electron MCP: open session history dropdown, click entry, `take_screenshot` of viewer showing colored terminal content
- Electron MCP: `read_electron_logs(logType="console")` confirms no runtime errors
- Electron MCP: verify keyboard input does nothing in viewer

---

### Task 6: Cleanup Policy and Startup Integration

**Objective:** Implement the dual cleanup policy (500MB cap + 30-day age limit) and integrate it with Wave's startup and periodic maintenance.

**Dependencies:** Task 1, Task 2

**Files:**

- Modify: `cmd/server/main-server.go` (add startup cleanup call)
- Modify: `pkg/sessionhistory/sessionhistory.go` (add periodic cleanup goroutine)
- Create: `pkg/sessionhistory/cleanup_test.go` (specific cleanup tests)

**Key Decisions / Notes:**

- **Startup cleanup:** In `main-server.go`, after initialization, call `sessionhistory.StartCleanupScheduler(ctx)` which:
  1. Runs an immediate cleanup on startup
  2. Starts a goroutine that runs cleanup every 1 hour
- **Cleanup logic (in sessionhistory package):**
  1. Walk `session-history/` directory tree
  2. For each block directory, acquire the per-block mutex before reading/modifying
  3. Collect all `.ansi` files with their timestamps and sizes
  4. Delete files older than 30 days
  5. If total remaining size > 500MB, delete oldest files until under 500MB
  6. Remove empty block directories after cleanup (directories where no `.ansi` files remain)
  7. Log cleanup stats (files removed, space freed)
- **Graceful shutdown:** The cleanup goroutine should respect context cancellation
- **Config (future):** Hardcode 500MB and 30 days for now. These could become settings later, but that's out of scope.
- **Error handling:** Cleanup errors are logged but don't prevent app startup or operation
- **Cleanup does NOT delete files for currently-active sessions.** Since it uses age/size policies and active terminals produce files with current timestamps, recently-created files are naturally preserved.

**Definition of Done:**

- [ ] Cleanup removes files older than 30 days
- [ ] Cleanup enforces 500MB total size cap by removing oldest first
- [ ] Empty block directories are removed after cleanup
- [ ] Cleanup acquires per-block mutex before modifying block directories
- [ ] Cleanup runs on startup and every hour thereafter
- [ ] Cleanup goroutine stops on context cancellation (graceful shutdown)
- [ ] All Go tests pass: `go test ./pkg/sessionhistory/`

**Verify:**

- `go test -v ./pkg/sessionhistory/`
- `go build ./cmd/server/`

## Testing Strategy

- **Unit tests:** Go package tests for `sessionhistory` (file I/O, cleanup logic, listing, filtering, concurrent access)
- **Integration tests:** Service-level tests in `sessionhistoryservice_test.go` verifying SaveRollingSegment → ListSessionHistory → ReadSessionSegment round-trip
- **Frontend type checking:** `task check:ts` ensures no type errors after TS codegen
- **Electron MCP verification:** Use Electron MCP tools (`take_screenshot`, `read_electron_logs`, `send_command_to_electron`) to verify:
  - Clock-rotate-left icon visible in terminal header
  - Dropdown opens and shows session entries
  - History viewer renders ANSI content with colors
  - No console errors during feature use

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `serializeAddon.serialize()` produces large output for terminals with huge scrollback | Medium | Medium | Cap serialized output at 5MB per save call. Skip save if over limit with a console warning. Service rejects content > 5MB. |
| Rolling capture creates too many files | N/A | N/A | Eliminated by design: rolling capture overwrites a single `rolling.ansi` file per block. Only truncate/close events create new numbered snapshot files. |
| Concurrent meta.json corruption from multiple terminals | N/A | N/A | Eliminated by design: meta.json is only written on first save or metadata change (not on every segment save). Segment info is derived from filesystem at list time. Per-block mutex serializes all writes. |
| Cleanup race condition with active saves | Low | Low | Cleanup acquires per-block mutex before modifying any block directory. Active sessions create files with current timestamps that are not age-eligible for deletion. |
| Session history dir grows large before cleanup runs | Low | Medium | Cleanup runs on startup + hourly. 500MB cap is generous but bounded. |
| Dispose capture is best-effort (async in sync context) | Medium | Low | Rolling capture fires every 30s, so at most 30s of terminal output can be lost on block close. The pre-truncate capture handles the clear-screen case reliably. Dispose capture is a best-effort supplement. |
| Large response from ReadLatestSegments | Low | Medium | `ReadLatestSegments` accepts a `maxBytes` parameter (default 10MB). Frontend loads only what fits. Individual segments can be loaded on-demand via `ReadSessionSegment`. |
| TypeScript codegen breaks after adding new service | Low | High | Verified by: `SessionHistoryServiceType` class exists in `services.ts` with all expected methods, `go build ./pkg/service/...` and `task check:ts` both pass. |

## Open Questions

- None — all requirements have been clarified through the pre-planning discussion and verification feedback.

### Deferred Ideas

- Full-text search across session history content
- Session-list filtering in the dropdown (search/filter by CWD, timestamp)
- Compression (gzip) for stored ANSI files to reduce disk usage
- Configurable cleanup thresholds via Wave settings panel
- Remote terminal session capture
- Export session history as HTML or text file
- Session history retention per-connection (different limits for SSH vs local)
- Backend-side capture on block deletion events (to guarantee final state is saved)
