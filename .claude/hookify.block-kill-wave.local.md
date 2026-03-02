---
name: block-kill-wave
enabled: true
event: bash
pattern: (taskkill\s+|kill\s+|pkill\s+|killall\s+).*(Wave|wavesrv|waveterm)
action: block
---

# 🚫 ABSOLUTELY FORBIDDEN: Killing Wave Terminal Processes

**This operation is BLOCKED by user-level instructions.**

You attempted to kill a Wave Terminal process. This is **explicitly forbidden** by the user's CLAUDE.md instructions:

> "I am COMPLETELY FORBIDDEN from running these commands without EXPLICIT user request"

**Processes protected:**
- Wave.exe (Electron main process)
- wavesrv.x64.exe (Go backend server)
- waveterm-app.exe (alternate name)

**Why this is blocked:**
- Wave Terminal is the application running Claude Code
- Killing it would terminate this session
- The user has existing work and state that would be lost
- The dev server needs to be managed by the user, not automatically

**What you should do instead:**
1. **STOP** - Do not attempt to kill Wave processes
2. **ASK** the user if they want to restart Wave Terminal
3. **EXPLAIN** why you think a restart is needed
4. **WAIT** for explicit user permission

**This is NON-NEGOTIABLE. Violation = broken trust.**
