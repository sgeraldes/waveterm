# LESSON-0005: Exploratory Code Audit Workflow

**Date:** 2026-03-02
**Category:** Quality Assurance
**Severity:** INFORMATIONAL
**Applies To:** Feature audits, bug discovery, systematic quality reviews

---

## Summary

Exploratory code audits using parallel agents can systematically discover bugs that manual review misses. By having agents independently trace feature domains end-to-end without being told what bugs exist, they find issues at every layer — UI, state management, validation, error handling.

## The Workflow

### DISCOVER Phase
- Read all relevant source files for the features being audited
- Understand what the features SHOULD do
- Map out component interactions, state flows, validation paths
- Identify critical paths and edge cases

### PARTITION Phase
- Split the audit scope into independent domains
- Example: "BreadCrumb" (BC) and "SmartFolder" (SF) domains
- Each domain gets its own bug namespace

### DISPATCH Phase
- Launch parallel agents, one per domain
- Each agent independently traces their domain end-to-end
- Agents find bugs organically by understanding expected behavior vs actual code
- No predetermined bug list — agents discover issues

### COLLECT Phase
- Gather all bugs from parallel agents
- Categorize by severity (CRITICAL/HIGH/MEDIUM/LOW)
- Group related bugs for efficient fixing

### FIX Phase
- Fix all bugs (don't defer "hard" ones)
- Verify with TypeScript and tests after each round
- Commit when verification passes

## Results from Breadcrumb/Smart Folder Audit

**Found:** 23 bugs across 2 domains in first audit pass
- 2 CRITICAL (30s network timeout, concurrent validation race)
- 7 HIGH (dead code, missing features, incorrect behavior)
- 8 MEDIUM (inconsistencies, unhandled errors)
- 6 LOW (unused props, missing validations)

**Fixed:** All 23 bugs in 2 rounds
- First round: 12 fixes (foundational issues)
- Second round: 11 fixes (deferred/medium/low)

**Verification:** All tests passing (358/358), TypeScript clean

## Why This Works

1. **Independent Discovery:** Agents aren't biased by preconceived notions of what's broken
2. **Systematic Coverage:** End-to-end tracing ensures every layer is checked
3. **Parallel Efficiency:** Multiple domains audited simultaneously
4. **Severity-Based Triage:** CRITICAL bugs fixed first, but all bugs eventually fixed

## When to Use Exploratory Audits

**✅ Use When:**
- Adding complex features (breadcrumb navigation, smart folder detection)
- Merging diverged branches
- Preparing for release
- User reports "something feels off" but can't pinpoint it
- Refactoring cross-cutting concerns

**❌ Don't Use When:**
- Single obvious bug to fix
- Time-critical hotfix needed
- Feature scope is trivial (< 50 lines)

## Common Bug Categories Found

From the breadcrumb/smart folder audit:

### UI Issues
- Missing click handlers (BC-001: segments not clickable)
- Wrong menu shown (BC-003: full app menu instead of context menu)
- Unused props (BC-007: `isFirst` declared but not used)

### State Management
- Validation state not surfaced to UI (SF-005)
- Atoms not reset on clear (SF-009)
- Concurrent validation race (SF-003)

### Validation Logic
- Regex bugs (SF-001: network path regex matched drive letters)
- Inconsistent sentinel handling (SF-008: "~" treated differently)
- Hostname not validated (SF-006)

### Error Handling
- Errors only in tooltips (BC-012: no visible indicator)
- Transient errors clearing state (SF-004: access_denied clearing path)
- Lock state incorrectly reset (SF-002)

### Dead Code
- Large unused infrastructure (SF-007: batching system never called)
- Dead type declarations (BC-006: IPC handlers never implemented)

## Files Involved in This Audit

**Discovery:**
- `frontend/app/workspace/workspace.tsx` - TabBreadcrumb component
- `frontend/app/tab/tab.tsx` - Tab controls
- `frontend/app/view/term/termwrap-osc.ts` - OSC 7 handler
- `frontend/app/store/tab-basedir-validator.ts` - Validation logic
- `frontend/app/store/tab-basedir-validation-hook.ts` - Validation hook

**Agents Dispatched:**
- BC agent (BreadCrumb domain) - 12 bugs found
- SF agent (SmartFolder domain) - 11 bugs found

## Metrics

- **Time:** ~2 hours (DISCOVER + PARTITION + DISPATCH + COLLECT + FIX rounds 1-2)
- **Bugs Found:** 23
- **Bugs Fixed:** 23 (100%)
- **Tests Added:** 0 (existing tests sufficient)
- **Lines Changed:** ~200 insertions, ~150 deletions

## Key Takeaways

1. **Don't defer bugs** - Fix all found bugs, not just "easy" ones
2. **Verify after each round** - TypeScript + tests after every fix batch
3. **Dead code is findable** - Trace call sites to find unused infrastructure
4. **Sentinel values need consistency** - Special values ("~", null, empty string) must be handled uniformly
5. **Agents find what humans miss** - Systematic tracing beats manual inspection

## Checklist for Running Exploratory Audits

- [ ] Identify feature domains to audit
- [ ] Read all source files to understand expected behavior
- [ ] Partition into independent domains
- [ ] Dispatch parallel agents (one per domain)
- [ ] Collect bugs from all agents
- [ ] Categorize by severity
- [ ] Fix CRITICAL/HIGH bugs first
- [ ] Fix ALL bugs (don't defer medium/low)
- [ ] Verify TypeScript clean after each round
- [ ] Verify all tests passing
- [ ] Commit when verification passes

## References

- Session: `4ab05a3b-b049-4d10-b5c1-96819095096a.jsonl`
- Commits: `ab9a5287`, `ffed2b2e`, `f743d5cc`
- Bugs Fixed: BC-001 through BC-012, SF-001 through SF-010

---

## Related Lessons

- [LESSON-0004](LESSON-0004-definition-of-done.md) - Definition of Done (ALL tests must pass)
