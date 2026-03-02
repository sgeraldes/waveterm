# LESSON-0006: Sentinel Value Consistency

**Date:** 2026-03-02
**Category:** Data Handling
**Severity:** HIGH
**Applies To:** Special values, state management, validation logic

---

## Summary

When multiple systems use sentinel values (special values like `"~"`, `null`, `""`) to represent "not set" or "default", inconsistent handling causes bugs. All systems that interact with a sentinel value must treat it identically.

## The Problem

**Bug SF-008:** Three different parts of the codebase handled the `"~"` sentinel differently:

1. **OSC 7 handler** (`termwrap-osc.ts`): Treated `"~"` as "not set" and skipped updating tab
2. **Validation hook** (`tab-basedir-validation-hook.ts`): DID validate `"~"`, triggering network checks
3. **File dialog** (`tab.tsx`): Could STORE `"~"` if user selected home directory

**Result:**
- Validation ran on sentinel value (unnecessary work)
- User could accidentally store sentinel as real path
- Inconsistent behavior across systems

## The Fix

Make all systems treat `"~"` identically:

```typescript
// OSC 7 handler (already correct)
if (!path || path === "~") {
    return true; // Skip update
}

// Validation hook (now consistent)
if (!basedir || basedir === "~") {
    globalStore.set(validationAtom, null);
    return; // Skip validation
}

// File dialog (now consistent)
if (newDir && newDir[0] !== "~") {
    // Only store non-sentinel values
    await ObjectService.UpdateObjectMeta(...)
}
```

## Why This Matters

### Cascading Failures

Inconsistent sentinel handling creates chain reactions:

1. OSC 7 receives `"~"` → correctly skips update
2. User opens file dialog → accidentally stores `"~"` as basedir
3. Validation hook sees `"~"` → runs network check on literal "~" path
4. Network check fails → error surfaced to user
5. User confused: "Why is my home directory invalid?"

### Performance Impact

Running validation on sentinel values:
- Unnecessary file system checks
- Unnecessary network timeouts
- Wasted CPU cycles
- Delayed UI updates

### Semantic Confusion

What does `"~"` mean?
- In shell: home directory
- In our system: "not set"
- If inconsistent: **nobody knows**

## General Rules for Sentinel Values

### 1. Document the Sentinel

In type definitions or constants:

```typescript
// SENTINEL VALUE: "~" means "basedir not explicitly set"
// All systems MUST treat "~" as equivalent to null/undefined
const BASEDIR_NOT_SET = "~";
```

### 2. Check Sentinel Early

Guard at system boundaries:

```typescript
function handleBasedir(basedir: string | null) {
    // Early exit for sentinel
    if (!basedir || basedir === BASEDIR_NOT_SET) {
        return;
    }

    // Rest of logic only runs on real values
    validatePath(basedir);
}
```

### 3. Prevent Sentinel Storage

Never store sentinels from user input:

```typescript
// WRONG: Stores whatever user selected
await UpdateMeta({ "tab:basedir": selectedPath });

// CORRECT: Filters sentinel values
if (selectedPath && selectedPath !== BASEDIR_NOT_SET) {
    await UpdateMeta({ "tab:basedir": selectedPath });
}
```

### 4. Test Sentinel Paths

Add test cases explicitly:

```typescript
it("skips validation when basedir is sentinel", () => {
    const result = validateBasedir("~");
    expect(result).toBeNull();
});

it("prevents storing sentinel from dialog", () => {
    const stored = shouldStoreBasedir("~");
    expect(stored).toBe(false);
});
```

## Common Sentinel Values

Different sentinels for different purposes:

| Sentinel | Meaning | Use Case |
|----------|---------|----------|
| `null` | Value not set | Database/API fields |
| `undefined` | Key doesn't exist | JavaScript objects |
| `""` | Empty but intentional | User-cleared text field |
| `"~"` | Use default/home | Path shortcuts |
| `-1` | Invalid index | Array searches |
| `0` | Uninitialized timestamp | Time-based state |

**Rule:** Pick ONE sentinel per concept and use it consistently everywhere.

## Real-World Examples

### Example 1: OSC 7 Path Reporting

**Problem:** Terminal reports `"~"` when shell integration initializes

**Systems Involved:**
- OSC 7 parser (receives `"~"`)
- Tab basedir state (stores path)
- Validation hook (validates path)
- UI breadcrumb (displays path)

**Solution:** All systems treat `"~"` as "not yet set"

### Example 2: User Clears Base Directory

**Problem:** User clicks "Clear Base Directory" button

**Expected Behavior:**
- Clear `tab:basedir` → `null` (not `"~"`)
- Clear `tab:basedirlock` → `null`
- Reset validation atoms
- Update UI to show no breadcrumb

**Sentinel:** `null` (not `"~"`) because this is explicit clearing

### Example 3: Network Paths

**Problem:** `\\server\share` paths should be rejected

**Sentinel:** Network paths are NOT a sentinel, they're invalid
- Don't use special string marker
- Use validation: `isNetworkPath(path)` returns boolean

## Audit Findings

From breadcrumb/smart folder audit:

**SF-008:** `"~"` sentinel inconsistency
- **Files:** `termwrap-osc.ts`, `tab-basedir-validation-hook.ts`, `tab.tsx`
- **Fix:** Added `|| basedir === "~"` check to validation hook
- **Fix:** Added `&& newDir[0] !== "~"` guard to file dialog

## Checklist for Adding Sentinel Values

- [ ] Document what the sentinel means in comments
- [ ] Define sentinel as constant (not magic string)
- [ ] Guard at all system boundaries
- [ ] Prevent storing sentinel from user input
- [ ] Add explicit test cases for sentinel
- [ ] Search codebase for all places sentinel is checked
- [ ] Ensure all checks are identical
- [ ] Update type definitions if needed

## Anti-Patterns

**❌ Don't:**
```typescript
// Different checks in different places
if (!basedir) return;           // File A
if (basedir === "~") return;    // File B
if (!basedir || !basedir.length) return;  // File C
```

**✅ Do:**
```typescript
// Same check everywhere (extract to helper)
function isBasedirSet(basedir: string | null): boolean {
    return basedir != null && basedir !== "~" && basedir !== "";
}

if (!isBasedirSet(basedir)) return;  // Everywhere
```

## References

- Bug SF-008: `"~"` sentinel treated inconsistently
- Commit `ffed2b2e`: Added `"~"` consistency across systems
- Files: `termwrap-osc.ts`, `tab-basedir-validation-hook.ts`, `tab.tsx`

---

## Related Lessons

- [LESSON-0005](LESSON-0005-exploratory-code-audit-workflow.md) - Exploratory audit methodology
