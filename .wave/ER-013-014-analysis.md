# ER-013 & ER-014: Console Error and fireAndForget Analysis

## Summary

Analysis of 159 console.error calls and 161 fireAndForget calls across the frontend codebase.

## Completed Changes

### 1. ER-014: Fixed fireAndForget (COMPLETED)
- **File**: `frontend/util/util.ts`
- **Changes**:
  - Changed console.log to console.error
  - Added optional error callback parameter
  - Signature: `function fireAndForget(f: () => Promise<any>, onError?: (e: Error) => void)`

### 2. Created Error Notification Utilities (COMPLETED)
- **File**: `frontend/util/errorutil.ts` (NEW)
- **Functions**:
  - `showErrorNotification(title, message, options)` - Show error toast to user
  - `showErrorNotificationFromError(title, error, options)` - Show error from Error object
  - `showWarningNotification(title, message, options)` - Show warning toast
- **Exported from**: `frontend/app/store/global.ts`

## Console.Error Analysis

### Categories

#### Category 1: Already Has UI Error Display (NO CHANGE NEEDED)
These errors call setError() or have other UI error display mechanisms:

**AI Panel (18 occurrences in waveai-model.tsx)**
- Lines 252, 307, 324, 366, 376, 400, 413, 430, 444, 462, 479, 574, 602, 611, 627, 642, 668
- All call `this.setError()` or display errors in AI chat UI
- **Action**: Keep as-is, console.error provides developer context

**Connections (3 occurrences in connections-content.tsx)**
- Lines 921, 940, 988
- All call `setError()` to display in UI
- **Action**: Keep as-is

**AI Panel Context Menu (5 occurrences)**
- Lines 43, 60, 75, 88, 101 in aipanel-contextmenu.ts
- Non-critical menu operations
- **Action**: Keep as-is

#### Category 2: Non-Critical Background Operations (NO CHANGE NEEDED)
These are background/debug operations that don't require user notification:

**Terminal Operations**
- `term-model.ts:335` - Initial controller status fetch (non-blocking)
- `term-model.ts:456` - Send data to controller (handled by connection status overlay)
- `termwrap.ts:266` - Middle-click paste failure (clipboard access issue)
- `termwrap.ts:403, 412` - Cleanup/disposal errors
- `session-history-dropdown.tsx:96` - Session history load (handled gracefully with empty state)

**Layout System**
- `layoutModel.ts:457, 466, 493` - Layout tree synchronization issues
- These are development/debugging errors for state inconsistencies
- **Action**: Keep as-is, add comments explaining they're debug-only

**Initialization**
- `wave.ts:96, 218` - Startup errors (already logged via sendLog to backend)
- `global.ts:68, 78, 86` - Feature initialization failures (non-blocking)

**Resource Cleanup**
- Various dispose/cleanup errors (non-critical)

#### Category 3: Should Show User Notification (NEEDS FIX)
These errors should display notifications to users:

**File Operations**
1. **Preview/File Errors**
   - `preview-model.tsx` - File preview failures
   - `preview-directory.tsx` - Directory operation failures
   - Should notify user when file operations fail

2. **Configuration Errors**
   - `omp-configurator/advanced-section.tsx:56` - Config import failure
   - `settings-service.ts` - Settings save/load failures
   - Should notify user when config operations fail

3. **Font Loading**
   - `font-control.tsx:119` - Font query failure
   - Should notify user when fonts can't be loaded

4. **Connection Operations** (without setError)
   - `connections-model.ts:41` - Git bash path find failure
   - Should notify user when tool detection fails

5. **AI Panel Operations** (without setError)
   - `waveai-model.tsx:215` - FILE_ITEM drop error
   - Should notify user when file drops fail

6. **Clipboard Operations**
   - `omp-configurator/advanced-section.tsx:142` - Copy to clipboard failure
   - Should notify user when copy fails

7. **Shell Configuration**
   - `shells-content.tsx` - Shell profile operations
   - `shell-profile-helper.tsx` - Shell detection failures
   - Should notify user when shell operations fail

8. **Widget Operations**
   - `widgets-content.tsx` - Widget config errors
   - Should notify user when widget operations fail

9. **Tab Configuration**
   - `tabvars-content.tsx` - Tab preset errors
   - Should notify user when tab operations fail

10. **Background Presets**
    - `bgpresets-content.tsx` - Background config errors
    - Should notify user when background operations fail

## Implementation Strategy

### Phase 1: High Priority User-Facing Errors (DO FIRST)
Focus on operations users explicitly trigger:

1. File operations (preview, directory)
2. Configuration imports/exports
3. Font loading
4. Clipboard operations
5. File drops in AI

### Phase 2: Medium Priority Configuration Errors (DO SECOND)
Focus on settings/config operations:

1. Shell configuration
2. Widget configuration
3. Tab presets
4. Background presets
5. Settings service

### Phase 3: Low Priority (DO LAST)
Background operations that could benefit from notification:

1. Git bash detection
2. Other tool detection

### Files Requiring Changes (Priority Order)

1. `frontend/app/view/preview/preview-model.tsx` - File preview errors
2. `frontend/app/view/preview/preview-directory.tsx` - Directory errors
3. `frontend/app/element/settings/omp-configurator/advanced-section.tsx` - Config import/clipboard
4. `frontend/app/element/settings/font-control.tsx` - Font loading
5. `frontend/app/aipanel/waveai-model.tsx:215` - File drop error
6. `frontend/app/store/settings-service.ts` - Settings errors
7. `frontend/app/view/waveconfig/shells-content.tsx` - Shell errors
8. `frontend/app/view/waveconfig/widgets-content.tsx` - Widget errors
9. `frontend/app/view/waveconfig/tabvars-content.tsx` - Tab errors
10. `frontend/app/view/waveconfig/bgpresets-content.tsx` - Background errors
11. `frontend/app/store/connections-model.ts:41` - Tool detection

## fireAndForget Analysis

Total: 161 usages

### Categories

#### Critical Operations (Need Error Callbacks)
Operations users explicitly trigger that must succeed:

1. File operations
2. Save operations
3. Delete operations
4. Configuration changes
5. RPC operations with user expectations

#### Non-Critical Operations (Can Keep Without Callback)
Background operations that shouldn't overwhelm users:

1. Polling/status checks
2. Metrics/telemetry
3. Auto-save/sync operations
4. Cleanup operations
5. Cache updates

### Implementation Strategy for fireAndForget

1. Focus on user-triggered operations
2. Add error callbacks using showErrorNotification
3. Leave background operations as-is (they'll still log to console.error)

## Testing Strategy

1. Build and verify TypeScript compilation
2. Test notification display with sample errors
3. Verify existing error displays still work
4. Test fireAndForget error callbacks
5. Verify console.error still logs for debugging

## Success Criteria

- [ ] All critical user-facing errors show notifications
- [ ] Users are informed when their actions fail
- [ ] Background operations don't overwhelm with notifications
- [ ] Console.error still provides debug context
- [ ] fireAndForget logs errors properly
- [ ] No regressions in existing error handling
