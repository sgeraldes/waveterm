# ERROR-0001: Network Path Regex Matching Windows Drive Letters

**Date:** 2026-03-02
**Category:** Path Validation
**Severity:** CRITICAL
**Platform:** Windows
**Symptom:** 30-second timeout when setting base directory to local paths

---

## Symptom

When user sets tab base directory to a local Windows path like `G:\Code\waveterm`, the operation hangs for 30 seconds before completing. No error is shown, just a long delay.

**User Experience:**
1. User clicks "Set Base Directory" on tab
2. Selects `G:\Code\waveterm` from file dialog
3. UI freezes for 30 seconds
4. Base directory finally gets set
5. User confused and frustrated

## Root Cause

The `isNetworkPath` regex incorrectly identified Windows drive letters as network paths:

```typescript
// WRONG - matches C:, G:, etc.
function isNetworkPath(path: string): boolean {
    return /^[^/\\]+:/.test(path);
}

isNetworkPath("G:\\Code\\waveterm")  // TRUE (wrong!)
isNetworkPath("http://example.com")  // TRUE (correct)
isNetworkPath("\\\\server\\share")   // FALSE (wrong!)
```

**What the regex meant to match:** `scheme://` URLs like `http://`, `file://`

**What it actually matched:** ANY string with `:` after one or more non-slash characters

**Result:** Windows drive letters (`C:`, `G:`, etc.) matched as "network paths"

## Why This Caused 30s Timeout

The validation logic had this flow:

```typescript
async function validateBasedir(basedir: string): Promise<ValidationResult> {
    if (isNetworkPath(basedir)) {
        // Network paths take 30s to fail with NETWORK_ERROR
        return { valid: false, reason: "network_error" };
    }

    // Local path validation (fast)
    const stat = await FileService.StatFile(basedir);
    return { valid: stat.exists };
}
```

When `G:\Code\waveterm` was treated as network path:
1. Attempted network path access (not local file)
2. Network timeout (30 seconds)
3. Returned `network_error`
4. Path was STILL set (transient errors don't clear path)
5. User saw working path after unexplained delay

## The Fix

Changed regex to require 2+ letters in scheme (excluding drive letters):

```typescript
// CORRECT - requires at least 2 letters before colon
function isNetworkPath(path: string): boolean {
    return /^[a-zA-Z]{2,}:/.test(path);
}

isNetworkPath("G:\\Code\\waveterm")  // FALSE (correct!)
isNetworkPath("http://example.com")  // TRUE (correct)
isNetworkPath("file://localhost/path") // TRUE (correct)
isNetworkPath("\\\\server\\share")   // FALSE (still wrong, but handled elsewhere)
```

**Why this works:**
- Single-letter schemes: Windows drive letters (`C:`, `G:`)
- Multi-letter schemes: URLs (`http:`, `https:`, `file:`)

## How to Detect This Bug

### User Reports
- "Setting base directory is really slow"
- "30 second freeze when selecting folders"
- "Works eventually but takes forever"

### Logs
```
[tab-basedir-validator] Validating G:\Code\waveterm
[tab-basedir-validator] Network path detected: G:\Code\waveterm
[FileService] Network timeout after 30000ms
[tab-basedir-validator] Validation failed: network_error
```

### Debugging Steps

1. **Add logging to `isNetworkPath`:**
```typescript
function isNetworkPath(path: string): boolean {
    const result = /^[^/\\]+:/.test(path);
    if (result) {
        console.log("Network path detected:", path);
    }
    return result;
}
```

2. **Test with local paths:**
```typescript
console.log(isNetworkPath("C:\\Users"));      // Should be FALSE
console.log(isNetworkPath("G:\\Code"));       // Should be FALSE
console.log(isNetworkPath("http://test"));    // Should be TRUE
```

3. **Check validation timing:**
```typescript
const start = Date.now();
await validateBasedir("G:\\Code");
console.log("Took:", Date.now() - start, "ms");  // Should be < 100ms
```

## Prevention

### 1. Test Drive Letters Explicitly

```typescript
describe("isNetworkPath", () => {
    it("should NOT match Windows drive letters", () => {
        expect(isNetworkPath("C:\\")).toBe(false);
        expect(isNetworkPath("G:\\Code")).toBe(false);
        expect(isNetworkPath("Z:\\")).toBe(false);
    });

    it("should match URL schemes", () => {
        expect(isNetworkPath("http://example.com")).toBe(true);
        expect(isNetworkPath("https://example.com")).toBe(true);
        expect(isNetworkPath("file://localhost/path")).toBe(true);
    });
});
```

### 2. Use Platform-Specific Helpers

```typescript
function isNetworkPath(path: string): boolean {
    // Windows: UNC paths start with \\
    if (path.startsWith("\\\\") || path.startsWith("//")) {
        return true;
    }

    // URLs have scheme with 2+ letters
    return /^[a-zA-Z]{2,}:/.test(path);
}
```

### 3. Log Performance Metrics

```typescript
async function validateBasedir(basedir: string): Promise<ValidationResult> {
    const start = performance.now();
    const result = await doValidation(basedir);
    const elapsed = performance.now() - start;

    if (elapsed > 1000) {
        console.warn("Slow validation detected:", basedir, elapsed, "ms");
    }

    return result;
}
```

## Related Issues

### SF-001: isNetworkPath Regex Bug
- **File:** `frontend/app/store/tab-basedir-validator.ts`
- **Fix:** Changed `/^[^/\\]+:/` to `/^[a-zA-Z]{2,}:/`
- **Commit:** `ab9a5287`

### Similar Bugs in Other Codebases

This is a common cross-platform bug:
- Regex meant to match URLs
- Forgets about Windows drive letters
- Causes mysterious timeouts on Windows only
- Linux/Mac developers never see it

**Search for:** Any regex using `^[^/\\]+:` or `^[^:]+:` for "URL detection"

## Platform-Specific Path Formats

| Platform | Format | Example | Should Match |
|----------|--------|---------|--------------|
| Windows | Drive letter | `C:\Users` | FALSE |
| Windows | UNC | `\\server\share` | TRUE |
| Unix | Absolute | `/home/user` | FALSE |
| Unix | Relative | `./path` | FALSE |
| All | URL | `http://example.com` | TRUE |
| All | File URL | `file:///path` | TRUE |

## Checklist for Path Validation

- [ ] Test with Windows drive letters (`C:`, `G:`, `Z:`)
- [ ] Test with UNC paths (`\\server\share`)
- [ ] Test with URLs (`http://`, `https://`, `file://`)
- [ ] Test with Unix absolute paths (`/home/user`)
- [ ] Test with Unix relative paths (`./code`, `../parent`)
- [ ] Add performance assertions (< 100ms for local paths)
- [ ] Log slow validations for debugging
- [ ] Platform-specific test suites

## References

- Bug SF-001: Network path regex matching drive letters
- Commit `ab9a5287`: Fixed regex pattern
- File: `frontend/app/store/tab-basedir-validator.ts:66`

---

## Related Lessons

- [LESSON-0005](LESSON-0005-exploratory-code-audit-workflow.md) - How this bug was discovered through exploratory audit
