# WSL Local Shell Refactor Implementation Plan

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

**Goal:** Refactor WSL from remote connection model to local shell model - treat WSL distros as local shell profiles (similar to PowerShell/cmd), discovered via `wsl.exe -l`, launched directly with `wsl.exe -d <distro>`. This fixes the `tab:basedir` bug where path validation happens on the wrong (Windows) filesystem.

**Architecture:** Remove the entire `wslconn` package and `wsl://` connection scheme. Instead, extend the existing shell profile system to natively support WSL distros with `IsWsl=true`. WSL shells will be launched via `wsl.exe -d <distro>` command, with shell integration (wsh) installed inside the WSL environment and communicating via stdio pipes. Path validation for WSL will use a new Go backend command (`WslPathStatCommand`) to stat UNC paths directly on Windows without going through the frontend security checks.

**Tech Stack:** Go (backend), TypeScript/React (frontend), Windows PTY, WSL UNC paths

## Scope

### In Scope

- Remove `pkg/wslconn/` package entirely (but port utilities to `pkg/wslutil/` first)
- Remove `wsl://` connection URI handling from connparse, shellcontroller, wshserver
- Extend shell profile system to launch WSL distros as local shells
- Add WSL path translation utilities (Linux paths ↔ UNC paths)
- Add new Go backend `WslPathStatCommand` for validating WSL paths
- Fix `tab:basedir` validation to use the new WSL stat command
- Update OSC 7 handler to detect WSL context and set `tab:wslDistro`
- Add wsh support for WSL via stdio (similar to local shells)
- Update frontend shell selector to NOT set `connection=wsl://` for WSL profiles
- Migrate existing `wsl://` blocks to shell profiles on startup
- Update security checks in pathutil.ts to allow WSL UNC paths

### Out of Scope

- SSH remote connections (unchanged)
- macOS/Linux builds (WSL is Windows-only)
- WSL 1 vs WSL 2 distinction (treat uniformly)
- Remote file browsing in WSL (future enhancement)
- Docker Desktop WSL integration (filtered out)

## Prerequisites

- Windows development environment with WSL 2 installed
- At least one WSL distribution (e.g., Ubuntu)
- Existing shell profile system is functional

## Runtime Environment

> Wave Terminal is an Electron app with remote debugging enabled in dev mode.

- **Start command:** `task electron:winquickdev` (Windows) or `task dev` (cross-platform)
- **Remote debugging:** CDP available at `localhost:9222` when `WAVETERM_DEV=1`
- **Verification:** Use Electron MCP tools (`mcp__electron__take_screenshot`, `mcp__electron__send_command_to_electron`) for automated testing
- **Test WSL terminal:** Open shell selector, select WSL distro, verify terminal opens, run `echo $SHELL`, verify output is a Linux shell path

## Context for Implementer

> This section is critical for cross-session continuity. Write it for an implementer who has never seen the codebase.

- **Patterns to follow:**
  - Shell profile handling: `pkg/wshrpc/wshserver/wshserver.go:773` (`DetectAvailableShellsCommand`)
  - Local shell startup: `pkg/shellexec/shellexec.go:583` (`StartLocalShellProc`)
  - Shell detection on Windows: `pkg/util/shellutil/shelldetect_windows.go:33` (`detectPlatformShells`)

- **Conventions:**
  - Shell profiles use `shell:` prefix for metadata keys (e.g., `shell:iswsl`, `shell:wsldistro`)
  - Connection types: `ConnType_Local`, `ConnType_Ssh` (remove `ConnType_Wsl`)
  - Windows paths use backslashes in Go, forward slashes normalized in frontend

- **Key files:**
  - `pkg/wslconn/wslconn.go` - **DELETE THIS** - current WSL connection controller
  - `pkg/wslconn/wsl-util.go` - **PORT TO wslutil THEN DELETE** - contains CpWshToRemote, GetClientPlatform
  - `pkg/blockcontroller/shellcontroller.go` - Routes shell creation based on connection type
  - `pkg/blockcontroller/blockcontroller.go` - Has wsl:// references that must be updated
  - `pkg/shellexec/shellexec.go` - Shell process startup functions
  - `pkg/util/shellutil/shelldetect_windows.go` - WSL distro detection (already exists)
  - `frontend/app/store/tab-basedir-validator.ts` - Path validation (needs WSL awareness)
  - `frontend/app/view/term/termwrap.ts` - OSC 7 handler (needs WSL context)
  - `frontend/util/pathutil.ts` - Has UNC security checks that block WSL paths

- **Gotchas:**
  - `wsl.exe` path can vary; use `exec.LookPath` or rely on PATH
  - UNC paths: `\\wsl$\Ubuntu` works, but `\\wsl.localhost\Ubuntu` is preferred on newer Windows
  - PTY for WSL: Use `creack/pty` library (already in use for Git Bash)
  - Shell detection already populates `WslDistro` field - leverage this
  - **CRITICAL**: `pathutil.ts` has `isUncPath()` that blocks UNC paths - must whitelist WSL paths
  - **CRITICAL**: `shellselector.tsx` line 260 sets `connection = wsl://<distro>` - must be removed

- **Domain context:**
  - WSL runs Linux inside Windows via virtualization
  - Linux paths in WSL (e.g., `/home/user`) are accessible from Windows via UNC (`\\wsl$\distro\...`)
  - OSC 7 reports Linux paths; Windows needs UNC paths for `os.Stat()`
  - The shell profile ID for WSL will be `wsl:<distro>` (e.g., `wsl:Ubuntu`)

## Feature Inventory

> Migration from `wslconn` package to shell profile model.

### Files Being Replaced

| Old File | Functions/Classes | Mapped to Task |
|----------|-------------------|----------------|
| `pkg/wslconn/wslconn.go` | `WslConn`, `EnsureConnection`, `GetWslConn`, `Connect`, `Close` | Task 1 (delete), Task 3 (replace with local shell) |
| `pkg/wslconn/wsl-util.go` | `CpWshToRemote`, `GetClientPlatform`, `hasBashInstalled` | Task 5 (port to wslutil first) |
| `pkg/blockcontroller/shellcontroller.go` | `ConnType_Wsl`, `getConnUnion` WSL branch | Task 3 |
| `pkg/blockcontroller/blockcontroller.go` | `wsl://` prefix checks, `wslconn.EnsureConnection` | Task 1 |
| `pkg/shellexec/shellexec.go` | `StartWslShellProc`, `StartWslShellProcNoWsh` | Task 3 |
| `pkg/remote/connparse/connparse.go` | `wsl://` URI parsing | Task 1 |
| `pkg/remote/conncontroller/conncontroller.go` | `wsl://` prefix filter | Task 1 |
| `pkg/service/clientservice/clientservice.go` | `wslconn.GetAllConnStatus` | Task 1 |
| `cmd/server/main-server.go` | `wslconn.GetNumWSLHasConnected` | Task 1 |
| `frontend/app/modals/shellselector.tsx` | `meta['connection'] = wsl://` | Task 6 |
| `frontend/app/modals/conntypeahead.tsx` | WSL connection items | Task 6 |

### Feature Mapping Verification

- [x] All old files listed above
- [x] All functions/classes identified
- [x] Every feature has a task number
- [x] No features accidentally omitted

## Progress Tracking

**MANDATORY: Update this checklist as tasks complete. Change `[ ]` to `[x]`.**

- [x] Task 1: Port wsl-util.go to wslutil, then remove wslconn package
- [x] Task 2: Add WSL path translation utilities and WslPathStatCommand
- [x] Task 3: Implement WSL local shell startup with data migration
- [x] Task 4: Fix tab:basedir validation for WSL contexts
- [x] Task 5: Add wsh support for WSL via stdio
- [x] Task 6: Update frontend shell selector and fix security checks
- [x] Task 7: Update OSC 7 handler for WSL path context
- [x] Task 8: Integration testing and cleanup

**Total Tasks:** 8 | **Completed:** 8 | **Remaining:** 0

## Implementation Tasks

### Task 1: Port wsl-util.go to wslutil, Then Remove wslconn Package

**Objective:** First port the needed utilities from wsl-util.go to pkg/wslutil/, then remove the entire WSL-as-remote-connection infrastructure.

**Dependencies:** None

**Files:**

- Create: `pkg/wslutil/wslutil.go` - Port `CpWshToRemote`, `GetClientPlatform`, `GetClientPlatformFromOsArchStr` from wsl-util.go
- Delete: `pkg/wslconn/wslconn.go`
- Delete: `pkg/wslconn/wsl-util.go` (AFTER porting utilities)
- Modify: `pkg/remote/connparse/connparse.go` - Remove `wsl://` scheme handling
- Modify: `pkg/remote/connparse/connparse_test.go` - Remove WSL tests
- Modify: `pkg/wshrpc/wshserver/wshserver.go` - Remove `WslStatusCommand`, `WslListCommand`, `WslDefaultDistroCommand`, and wsl:// branches in `ConnEnsureCommand`, `ConnStatusCommand`, `ConnConnectCommand`, `ConnDisconnectCommand`, `DismissWshFailCommand`
- Modify: `pkg/wshrpc/wshrpctypes.go` - Remove WSL-specific RPC types if any
- Modify: `pkg/blockcontroller/shellcontroller.go` - Remove `ConnType_Wsl` constant and related code
- Modify: `pkg/blockcontroller/blockcontroller.go` - Remove wsl:// prefix checks (lines 147, 234, 384), wslconn imports
- Modify: `pkg/shellexec/shellexec.go` - Remove `StartWslShellProc`, `StartWslShellProcNoWsh`
- Modify: `pkg/remote/conncontroller/conncontroller.go` - Remove wsl:// prefix filter (line 1196)
- Modify: `pkg/service/clientservice/clientservice.go` - Remove wslconn import and GetAllConnStatus wslStatuses merge
- Modify: `cmd/server/main-server.go` - Remove wslconn import and GetNumWSLHasConnected reference
- Modify: `cmd/wsh/cmd/wshcmd-wsl.go` - Remove or repurpose WSL command
- Modify: `cmd/wsh/cmd/wshcmd-conn.go` - Remove WSL connection handling

**Key Decisions / Notes:**

- Port utilities FIRST, then delete - this ensures Task 5 has the functions it needs
- Keep `pkg/wsl/wsl-win.go` - we still need `gowsl` for distro discovery
- Update imports in all affected files
- The build will temporarily break until Task 3 is complete

**Definition of Done:**

- [ ] `pkg/wslutil/wslutil.go` contains ported utilities: `CpWshToRemote`, `GetClientPlatform`, `GetClientPlatformFromOsArchStr`
- [ ] `pkg/wslconn/` directory is deleted
- [ ] No references to `wsl://` remain in Go codebase (except docs/comments)
- [ ] No references to `ConnType_Wsl` remain
- [ ] No references to `wslconn` package remain in imports
- [ ] Code compiles (may fail tests until Task 3)

**Verify:**

- `grep -r "wslconn" pkg/ cmd/ --include="*.go" | wc -l` returns 0
- `grep -r "wsl://" pkg/ cmd/ --include="*.go" | wc -l` returns 0
- `go build ./cmd/server/` succeeds

---

### Task 2: Add WSL Path Translation Utilities and WslPathStatCommand

**Objective:** Create utilities to translate between Linux paths and Windows UNC paths, and add a Go backend command for validating WSL paths.

**Dependencies:** None (can run in parallel with Task 1)

**Files:**

- Create: `pkg/util/wslpath/wslpath.go` - Path translation utilities
- Create: `pkg/util/wslpath/wslpath_test.go` - Unit tests
- Create: `pkg/util/wslpath/wslpath_windows.go` - Windows-specific implementation
- Create: `pkg/util/wslpath/wslpath_unix.go` - Stub for non-Windows (no-op)
- Modify: `pkg/wshrpc/wshrpctypes.go` - Add `WslPathStatCommand` type
- Modify: `pkg/wshrpc/wshserver/wshserver.go` - Implement `WslPathStatCommand`

**Key Decisions / Notes:**

- `LinuxToUNC` should attempt `\\wsl.localhost\<distro>` first; if `os.Stat` returns error, retry with `\\wsl$\<distro>`. Cache the working format per distro for process lifetime.
- Unit tests should mock os.Stat to test both fallback paths
- Handle edge cases: `/` → `\\wsl.localhost\distro\`, `~` expansion
- Reverse translation: UNC back to Linux path (for display)
- Paths starting with `/mnt/c/` should map to `C:\` (not UNC)
- **WslPathStatCommand(distro, linuxPath)**: Performs UNC translation and os.Stat on Go side, avoiding frontend security checks

**Definition of Done:**

- [ ] `LinuxToUNC(distro, path string) string` function works with fallback
- [ ] `UNCToLinux(uncPath string) (distro, path string, ok bool)` function works
- [ ] Handles `/mnt/c/...` → `C:\...` translation
- [ ] Handles root path `/` correctly
- [ ] `WslPathStatCommand` added to wshrpctypes.go and implemented in wshserver.go
- [ ] All unit tests pass

**Verify:**

- `go test ./pkg/util/wslpath/... -v` passes
- Test cases cover: `/home/user`, `/`, `/mnt/c/Users`, fallback from wsl.localhost to wsl$

---

### Task 3: Implement WSL Local Shell Startup with Data Migration

**Objective:** Add function to start WSL shells as local processes via `wsl.exe -d <distro>`, and add startup migration for existing `wsl://` blocks.

**Dependencies:** Task 1, Task 2

**Files:**

- Modify: `pkg/shellexec/shellexec.go` - Add `StartWslLocalShellProc` function
- Modify: `pkg/blockcontroller/shellcontroller.go` - Route WSL profiles to local shell startup
- Modify: `pkg/util/shellutil/shelldetect_windows.go` - Ensure `IsWsl` and `WslDistro` are populated
- Modify: `cmd/server/main-server.go` - Add startup migration for wsl:// blocks

**Key Decisions / Notes:**

- Use `wsl.exe -d <distro> -- <shell>` for shell invocation
- Shell integration files need to be installed in WSL's `~/.waveterm/`
- Working directory: Translate Windows cwd to WSL path if needed, or default to `~`
- PTY: Use `creack/pty` to create pseudo-terminal for `wsl.exe` process
- **Routing logic**: shellcontroller.go routes to `StartWslLocalShellProc` when block metadata has `shell:iswsl=true` (from shell profile) OR `shell:profile` starts with "wsl:". The router does NOT use connection field for WSL detection.
- **Data migration**: On startup, scan all blocks for `connection` starting with `wsl://`. For each: set `connection=null`, set `shell:profile=wsl:<distro>`
- **Ignore stale connection field**: When shell:profile indicates IsWsl, ignore cmd:connection field entirely

**Definition of Done:**

- [ ] WSL shell profile launches successfully via shell selector
- [ ] Terminal is interactive with full PTY support
- [ ] OSC sequences are not stripped by PTY layer (verified by running `printf "\033]7;file://wsl.localhost/Ubuntu/home/user\a"` and confirming basedir updates)
- [ ] Ctrl+C sends SIGINT to foreground process (verified by running `sleep 100`, pressing Ctrl+C, confirming shell prompt returns)
- [ ] Exit codes propagate correctly
- [ ] Startup migration converts existing `wsl://` blocks to shell profiles

**Verify:**

- Start a WSL terminal via shell selector, run `echo $SHELL`, verify output is Linux shell path
- Run `pwd`, verify shows Linux path (e.g., `/home/user`)
- Run `exit`, verify terminal closes cleanly
- Seed test data with `connection=wsl://Ubuntu`, start server, verify block now has `shell:profile=wsl:Ubuntu` and `connection=null`

---

### Task 4: Fix tab:basedir Validation for WSL Contexts

**Objective:** Update path validation to use the new `WslPathStatCommand` for WSL tab base directories.

**Dependencies:** Task 2, Task 3

**Files:**

- Modify: `frontend/app/store/tab-basedir-validator.ts` - Add WSL context detection, call `WslPathStatCommand` for WSL paths
- Modify: `frontend/util/pathutil.ts` - Update `isUncPath()` to whitelist WSL UNC paths (`\\wsl.localhost\*`, `\\wsl$\*`)
- Modify: `frontend/app/view/term/termwrap.ts` - Update UNC block in `handleOsc7Command` to allow WSL UNC paths

**Key Decisions / Notes:**

- Detect WSL context from `tab:wslDistro` metadata
- Store Linux paths in `tab:basedir` (user-friendly), call `WslPathStatCommand(distro, path)` for validation
- The Go backend handles UNC translation and os.Stat - avoids frontend security check issues
- Update `isUncPath()` in pathutil.ts to return `{valid: true}` for paths starting with `\\wsl.localhost\` or `\\wsl$\`
- Update termwrap.ts line 229 UNC block to skip paths matching WSL patterns

**Definition of Done:**

- [ ] WSL terminal's OSC 7 updates `tab:basedir` with Linux path (e.g., `/home/user/project`)
- [ ] Validation calls `WslPathStatCommand` (not `FileInfoCommand`) for tabs with `tab:wslDistro` set
- [ ] Stale path detection works (directory deleted in WSL)
- [ ] Tab breadcrumb shows Linux path format (not UNC)
- [ ] `isUncPath()` in pathutil.ts allows WSL UNC paths

**Verify:**

- Create WSL terminal, `cd /home/user/projects/myproject`
- Verify tab:basedir is set to `/home/user/projects/myproject`
- Run `rmdir /home/user/projects/myproject` in another terminal
- Verify stale path notification appears
- Verify `isUncPath('\\\\wsl.localhost\\Ubuntu\\home\\user')` returns `{valid: true}`

---

### Task 5: Add wsh Support for WSL via stdio

**Objective:** Install and run wsh inside WSL, communicating via stdin/stdout pipes (similar to local shell wsh).

**Dependencies:** Task 1, Task 3

**Files:**

- Modify: `pkg/shellexec/shellexec.go` - Add `StartWslLocalShellProcWithWsh` function
- Modify: `pkg/wslutil/wslutil.go` - Use ported utilities for binary installation
- Modify: `pkg/util/shellutil/shellutil.go` - Add WSL shell integration file paths

**Key Decisions / Notes:**

- Use ported `CpWshToRemote`, `GetClientPlatform` from `pkg/wslutil/wslutil.go` (ported in Task 1)
- Install wsh binary via UNC path: `\\wsl.localhost\distro\home\user\.waveterm\bin\wsh`
- Start wsh as: `wsl.exe -d <distro> -- ~/.waveterm/bin/wsh connserver --router`
- Use swap token mechanism for authentication
- Shell integration files: Copy bash/zsh/fish integration to WSL home
- **Routing**: WSL wsh connects to local domain socket (same as local shells). Route ID based on empty connName. JWT token matching for auth.
- **Fallback on failure**: If wsh installation fails (permission denied, arch detection fails): log error to block log, launch without wsh, display notification "wsh not installed in WSL - RPC commands unavailable". Terminal remains functional.

**Definition of Done:**

- [ ] wsh binary is installed in WSL on first connection (verified by checking `~/.waveterm/bin/wsh` exists in WSL)
- [ ] wsh connserver starts and registers route (verified by checking router has route for block)
- [ ] `StartWslLocalShellProcWithWsh` function in shellexec.go starts wsh connserver process with stdin/stdout pipes
- [ ] Integration test: spawn WSL shell process, send RPC ping, receive pong response within 5 seconds
- [ ] Graceful fallback: if wsh install fails, terminal still opens without wsh, notification displayed

**Verify:**

- Start WSL terminal with wsh enabled
- Run `ls ~/.waveterm/bin/wsh` in WSL, verify file exists
- Run `wsh version` in WSL terminal, verify output
- Force wsh install failure (e.g., read-only ~/.waveterm), verify terminal still opens

---

### Task 6: Update Frontend Shell Selector and Fix Security Checks

**Objective:** Remove WSL from connection dropdown, fix shell selector to NOT set `connection=wsl://`, and update security checks for WSL paths.

**Dependencies:** Task 3

**Files:**

- Modify: `frontend/app/modals/shellselector.tsx` - Remove `meta['connection'] = wsl://<distro>` for WSL profiles (line 260). Set `shell:profile=wsl:<distro>` and `connection=null` instead
- Modify: `frontend/app/modals/conntypeahead.tsx` - Remove WSL connection items
- Modify: `frontend/app/view/waveconfig/connections-content.tsx` - Remove WSL from connections panel
- Modify: `frontend/app/view/waveconfig/shells-content.tsx` - Ensure WSL profiles appear

**Key Decisions / Notes:**

- WSL profiles should be grouped together in shell selector
- Icon: Use distro-specific icons (Ubuntu, Debian, Fedora, or generic Linux)
- Show "(default)" for default WSL distro
- Profile ID format: `wsl:<distro>` (e.g., `wsl:Ubuntu`)
- **CRITICAL**: In `changeShell` callback, for WSL profiles: set `meta['connection'] = null` (NOT `wsl://<distro>`)

**Definition of Done:**

- [ ] Shell selector shows WSL distros as profiles
- [ ] WSL removed from connection dropdown
- [ ] Selecting WSL profile sets `shell:profile=wsl:<distro>` and `connection=null` (not `wsl://<distro>`)
- [ ] Icons display correctly for known distros

**Verify:**

- Open shell selector, verify WSL distros listed
- Select WSL distro, verify terminal starts
- Inspect block metadata: confirm `connection` is null/undefined, `shell:profile` is `wsl:Ubuntu`
- Check icon matches distro (Ubuntu penguin, etc.)

---

### Task 7: Update OSC 7 Handler for WSL Path Context

**Objective:** Detect WSL context in terminals and set `tab:wslDistro` metadata for basedir updates.

**Dependencies:** Task 4

**Files:**

- Modify: `frontend/app/view/term/termwrap.ts` - Add WSL context detection in `handleOsc7Command`, set `tab:wslDistro`
- Modify: `frontend/app/store/keymodel.ts` - Pass WSL context when creating terminals

**Key Decisions / Notes:**

- Detect WSL context from block metadata `shell:profile` (starts with "wsl:")
- Store raw Linux path in `tab:basedir` (not UNC)
- Set `tab:wslDistro` metadata when basedir comes from WSL terminal
- Validation layer (Task 4) uses `tab:wslDistro` to determine validation method

**Definition of Done:**

- [ ] WSL terminal OSC 7 correctly updates `tab:basedir` with Linux path
- [ ] `tab:wslDistro` metadata is set to distro name when basedir comes from WSL
- [ ] Non-WSL terminals don't set `tab:wslDistro`
- [ ] Mixed tabs (WSL + PowerShell) work correctly (each terminal sets its own context)

**Verify:**

- WSL terminal: `cd /home/user/project`, verify basedir is `/home/user/project`
- Check `tab:wslDistro` is set to distro name (e.g., "Ubuntu")
- PowerShell terminal: `cd C:\Users`, verify basedir is `C:\Users`, verify `tab:wslDistro` is null

---

### Task 8: Integration Testing and Cleanup

**Objective:** Comprehensive testing of the refactored WSL implementation and cleanup of dead code.

**Dependencies:** Task 1-7

**Files:**

- Modify: Various test files
- Delete: Any remaining dead code
- Modify: `CLAUDE.md` - Update documentation to remove wsl:// references

**Key Decisions / Notes:**

- Test all WSL distro types (Ubuntu, Debian, custom)
- Test path validation with various scenarios
- Test wsh functionality
- Clean up any TODO comments from implementation
- Update documentation

**Definition of Done:**

- [ ] `go test ./pkg/util/wslpath/... -v` shows all path translation tests pass
- [ ] `task check:ts` exits with code 0
- [ ] `go test ./...` exits with code 0
- [ ] `grep -r "wslconn" pkg/ cmd/ --include="*.go"` returns 0 results
- [ ] `grep -r "wsl://" pkg/ cmd/ --include="*.go"` returns 0 results (excluding test fixtures)
- [ ] `CLAUDE.md` updated to document WSL as shell profile (not connection)

**Verify:**

- `task check:ts` passes
- `go test ./...` passes
- PTY resize test: Open WSL terminal, run `vim`, resize Wave window, verify vim redraws correctly
- Manual test: full WSL workflow (select profile, cd to directory, verify basedir, delete directory, verify stale notification)

## Testing Strategy

- **Unit tests:** Path translation utilities, shell profile parsing
- **Integration tests:** Shell startup, wsh communication (spawn, send RPC, verify response)
- **Automated E2E:** Use Electron MCP tools to verify UI
- **Manual verification:**
  - Launch WSL terminal from shell selector
  - Verify OSC 7 sets correct basedir
  - Verify basedir validation (create/delete directory)
  - Verify wsh commands work
  - Test with multiple WSL distros
  - Test PTY resize with vim/tmux

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| UNC path access slow | Low | Med | Cache validation results for 30 seconds per distro. Use background validation. |
| wsh installation fails in WSL | Med | Med | If wsh binary install fails (copy via UNC errors, permission denied, arch detection fails): (1) Log error to block log, (2) Launch WSL terminal without wsh, (3) Display notification "wsh not installed in WSL - RPC commands unavailable". Terminal remains functional. |
| PTY issues with wsl.exe | Low | High | Use same PTY approach as Git Bash (proven). Test SIGWINCH propagation manually with vim/tmux. |
| Breaking change for existing users | Med | High | Startup migration: scan all blocks for `connection=wsl://*`, convert to `shell:profile=wsl:<distro>`, clear connection. Migration runs before wsl:// branch is needed. |
| Mixed WSL/Windows paths confusion | Med | Med | Clear UI: basedir always shows Linux paths, wslDistro metadata tracks context, validation layer handles translation transparently. |
| UNC format varies by Windows version | Low | Low | Try `\\wsl.localhost\` first, fall back to `\\wsl$\`. Cache working format per distro. |

## Open Questions

- None - design decisions have been made via user clarification and verification.

### Deferred Ideas

- Remote file browsing in WSL via UNC paths
- WSL 1 vs WSL 2 detection and display
- Per-distro shell configuration (e.g., different shells in different distros)
