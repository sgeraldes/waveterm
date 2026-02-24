# LESSON-0004: Definition of Done

**Date:** 2026-02-24
**Category:** Quality Standards
**Severity:** CRITICAL

---

## Summary

Work is NOT done until ALL tests pass. Not "tests related to changed files." Not "tests that aren't pre-existing failures." ALL tests. Zero failures.

## The Rule

**Before declaring any task complete, ALL of the following must pass with zero failures:**

```bash
# Go tests
go test ./pkg/...

# Frontend tests
npm test

# TypeScript compilation
npx tsc --noEmit

# Go compilation
go build ./...
```

**Zero failures means zero failures.** If a test was already broken before you started, fix it or flag it to the user before moving on. "Pre-existing failure" is not an excuse — it's a problem you inherited and must address.

## The Anti-Pattern That Triggered This Lesson

During a merge of diverged branches, all conflicts were resolved and compilation passed. Tests were run. Some failed. The response was:

> "None of these failures are in files we touched during the merge. The merge didn't break anything."

This is wrong. The codebase has failing tests. The work is not done. "I didn't cause it" is irrelevant — the user expects a working codebase, not a diff-scoped quality bar.

## What "Done" Actually Means

| Claim | Required Evidence |
|-------|-------------------|
| "Merge complete" | All tests pass. All compilation clean. |
| "Feature implemented" | All tests pass. New tests for new code. |
| "Bug fixed" | All tests pass. Regression test added. |
| "Refactor complete" | All tests pass. No behavior changes. |

## When Pre-Existing Failures Exist

If tests were already failing before your work:

1. **Tell the user immediately** — "I found N pre-existing test failures before starting"
2. **Fix them if you can** — they're part of the codebase you're working in
3. **If you can't fix them, explicitly ask** — "These 3 tests fail due to CGO/platform issues. Should I skip them or address them?"
4. **Never silently accept them** — claiming "done" with known failures is lying

## Verification Checklist

Before saying work is complete:

- [ ] `go build ./...` — zero errors
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `CGO_ENABLED=1 CC="zig cc -target x86_64-windows-gnu" go test -tags "osusergo,sqlite_omit_load_extension" ./pkg/...` — zero failures
- [ ] `npm test` — zero failures
- [ ] No conflict markers in any file
- [ ] Git status is clean (no unintended changes)

## CGO on Windows

The `pkg/filestore` tests require CGO for SQLite. Zig is installed via scoop at `C:\Users\Sebastian\scoop\shims\zig.exe`. **Always** run Go tests with:

```bash
CGO_ENABLED=1 CC="zig cc -target x86_64-windows-gnu" go test -tags "osusergo,sqlite_omit_load_extension" ./pkg/...
```

Never run `go test ./pkg/...` without CGO — it will fail on filestore tests and that is NOT a "platform constraint," it's you using the wrong command.
