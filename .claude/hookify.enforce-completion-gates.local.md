---
name: enforce-completion-gates
enabled: true
event: stop
pattern: (done|complete|finished|listo|terminado|pusheado|pushed|committed|all.*pass|todo.*funciona|everything.*works|implementation.*complete|feature.*ready)
action: block
---

🛑 **BLOCKED: Claiming completion without evidence**

You are claiming work is complete. Before you can stop, you MUST show **actual command output** proving it works.

**Required evidence (ALL must be present in your recent messages):**

1. **Test output** — Actual `npm test` or `go test` output showing pass/fail counts
   - ❌ "tests should pass" — this is NOT evidence
   - ✅ "410 passed (410)" — this IS evidence

2. **Build verification** — Actual `npx tsc --noEmit` or `go build` output showing zero errors
   - ❌ "compiles cleanly" — this is NOT evidence
   - ✅ "(Bash completed with no output)" after tsc — this IS evidence

3. **For UI changes** — Screenshot via Electron MCP or user confirmation
   - ❌ "should look correct" — this is NOT evidence
   - ✅ Screenshot showing the UI working — this IS evidence

4. **For Go backend changes** — `go build ./...` output
   - ❌ "the Go code compiles" — this is NOT evidence
   - ✅ Actual build command with no errors — this IS evidence

**What to do now:**
Run the verification commands, show the output, and THEN claim completion.

If the user has already confirmed the work visually or verbally, that counts as evidence — but you must have actually run build/tests yourself.
