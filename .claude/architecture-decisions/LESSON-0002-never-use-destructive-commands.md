# LESSON-0002: Never Use Destructive Commands

**Date:** 2026-01-24
**Category:** Agent Behavior
**Severity:** CRITICAL

---

## Summary

Fix problems by fixing them. Never remove, disable, or bypass things to make errors disappear.

## The Anti-Pattern

| Problem | WRONG | CORRECT |
|---------|-------|---------|
| Missing dependency | Remove the feature | Install the dependency |
| Test failing | Disable/skip the test | Fix the test |
| Bug in feature | Delete the feature | Fix the bug |
| Linting error | Disable linting | Fix the lint error |
| Pre-commit hook fails | `--no-verify` | Fix the issue |
| Unwanted edit | `git checkout` | Edit tool to undo |
| "Fix all problems" | Stop at unfamiliar issues | Fix everything |

## Destructive Commands - Never Use

### Git
```bash
git checkout <file>      git restore <file>       git reset --hard
git checkout .           git restore .            git clean -f
git stash drop           git push --force         git branch -D
git commit --no-verify   git push --no-verify
```

### Files
```bash
rm    rm -rf    del    rmdir /s    Remove-Item -Recurse
```

### Processes
```bash
kill    taskkill    pkill    killall    Stop-Process
```

## Safe Revert Pattern

1. Read the file
2. Use Edit tool to undo your specific changes
3. Never use git commands to revert

## Rules

- Fix problems by fixing them
- Never disable tests, linting, or hooks
- Never use `--no-verify`
- Never remove functionality to fix an error
- When asked to fix problems, fix ALL of them
- Use Edit tool to surgically revert changes
