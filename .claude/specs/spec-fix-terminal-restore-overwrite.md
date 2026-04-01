# Spec: Fix Terminal Buffer Overwrite on App Restart

## Problem

When Wave Terminal restarts, the previous session's scrollback is restored into xterm.js, but the new shell's startup output overwrites the lines that were visible on screen when the app closed.

**Visual evidence:**
- Before close: Terminal shows `ls` output, `dir` listings, etc.
- After restart (no scroll): Only the new shell prompt visible, rest is blank
- After scroll up: Historical scrollback IS preserved, but the last N visible lines are missing — they were overwritten by the shell's initial output writing from cursor position near (0,0)

This affects ALL shell types: WSL zsh, Command Prompt, PowerShell 7, Git Bash.

## Root Cause Analysis

### The Restore Flow (current)

```
1. Backend: shellcontroller.go:422 — MakeFile() checks if term file exists
2. Backend: shellcontroller.go:426-427 — If file exists, calls resetTerminalState()
3. Backend: shellcontroller.go:228-230 — resetTerminalState() appends ANSI reset sequence + \r\n to file
4. Backend: shellcontroller.go:319 — Spawns async goroutine for DoRunShellCommand()
5. Frontend: termwrap.ts:447 — loadInitialTerminalData() reads file and writes to xterm.js
6. Frontend: termwrap-history.ts:71-101 — Loads cache + main file data into terminal
7. Shell starts → outputs banner/prompt → written to file → frontend receives via file subject
```

### The Reset Sequence (shellutil.go:618-641)

```
GetTerminalResetSeq() returns:
  \x1b[0m      — reset attributes
  \x1b[?25h    — show cursor
  \x1b[?1l     — normal cursor keys
  \x1b[?7h     — wraparound on
  \x1b[?45l    — reverse wraparound off
  ... (mouse tracking, bracketed paste, etc. all off)
  + \r\n       — carriage return + newline
```

Note: `\x1b[?6l` (DECOM reset) was intentionally omitted because it homes the cursor. **But the bug still happens.**

### Why Content Gets Overwritten

The reset sequence itself doesn't clear the screen or home the cursor. However:

1. The restored scrollback positions xterm.js cursor at the end of historical data
2. `resetTerminalState()` appends the reset sequence + `\r\n` to the file BEFORE the shell starts
3. When the frontend loads `loadInitialTerminalData()`, it reads ALL file data including the reset sequence
4. The shell then starts and its initial output (banner, prompt) is written at the cursor position
5. **The shell's own startup sequences** (especially cmd.exe's header, PowerShell's version info, zsh's prompt with escape sequences) write to the viewport area
6. xterm.js auto-scrolls the viewport to follow the cursor, positioning it at the shell's new output — the previous visible content is now above in scrollback with its last lines overwritten

### Key Insight

The `\r\n` after the reset sequence, combined with the shell's own startup positioning, means the cursor ends up at a position where the new shell output overwrites what was previously visible. The exact overwrite depends on how many lines the shell's banner/prompt takes.

## Proposed Fix

### Approach: Push Restored Content Fully Into Scrollback Before Shell Writes

Instead of letting the shell write over the visible viewport (rows that had previous session content), push all restored content into the scrollback buffer by adding enough newlines to clear the viewport.

**In `resetTerminalState()` (shellcontroller.go:213-234):**

```go
func (sc *ShellController) resetTerminalState(logCtx context.Context, termRows int) {
    // ... existing checks ...
    
    resetSeq := shellutil.GetTerminalResetSeq()
    
    // Push restored content fully into scrollback by emitting termRows newlines.
    // This ensures the viewport is clear when the new shell starts,
    // preserving ALL historical content in the scrollback buffer.
    if termRows > 0 {
        resetSeq += strings.Repeat("\r\n", termRows)
    } else {
        resetSeq += "\r\n" // fallback: single newline as before
    }
    
    err := HandleAppendBlockFile(sc.BlockId, wavebase.BlockFile_Term, []byte(resetSeq))
    // ...
}
```

This way:
- Historical content is pushed into scrollback (preserved, accessible via scroll up)
- The shell starts writing on a clean viewport
- No content is overwritten
- User can scroll up to see previous session's full output

### Acceptance Criteria

- [ ] After app restart, scrolling up reveals ALL content from previous session — no missing lines
- [ ] After app restart, the new shell prompt appears on a clean viewport (no garbled text)
- [ ] Works for all shell types: WSL zsh, Command Prompt (cmd.exe), PowerShell 7, Git Bash
- [ ] `termRows` is correctly passed to `resetTerminalState()` (it already is at line 427)
- [ ] The second call site at line 677 passes `0` — ensure fallback behavior is acceptable

### Files to Modify

| File | Change |
|------|--------|
| `pkg/blockcontroller/shellcontroller.go:213-234` | Add `termRows` newlines to push content into scrollback |

### Edge Cases

1. **First-time terminal** (no previous file): `resetTerminalState()` returns early if file doesn't exist or is empty — no change needed
2. **termRows = 0**: Fallback to single `\r\n` (current behavior). This happens at line 677 (reconnect case)
3. **Very small terminal** (e.g. 5 rows): Still works — 5 newlines push 5 lines of content into scrollback
4. **Terminal with alt screen content**: Reset sequence already includes `OSC 16162;R` to disable alt screen

### Alternative Approaches Considered

1. **Save/restore cursor position**: Won't help — the problem is that the viewport content gets overwritten, not that the cursor is in the wrong place
2. **Don't send reset sequence at all**: Risky — terminal could be in a broken state (alt screen, mouse tracking on, etc.) from previous session
3. **Frontend-side fix (scroll to bottom after restore)**: Doesn't prevent the overwrite, just hides it
4. **Insert a visual separator line**: Cosmetic but doesn't fix the data loss

## Definition of Done

- All acceptance criteria pass with visual verification via Electron MCP
- Go build passes
- TypeScript compilation passes
- Unit tests pass (410/410)
