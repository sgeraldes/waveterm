# PV-007: Large File Preview Memory Spike Fix

**Status:** FIXED
**Priority:** MEDIUM (Performance)
**Date:** 2026-02-27

## Problem

Opening large files (100MB+) in the preview view caused massive memory usage because the entire file was loaded into memory before checking the size limit. This created memory spikes that could slow down or crash the application.

## Root Cause

The preview model had two critical issues:

1. **Size check happened AFTER loading**: The `getSpecializedView()` method checked file size at lines 522-526, but the `fullFileAtom` (line 418) loaded the entire file content via `RpcApi.FileReadCommand` before this check occurred.

2. **Hardcoded size limits**: The size limits were hardcoded constants (`MaxFileSize = 10MB`, `MaxCSVSize = 1MB`) with no way for users to adjust them.

## Solution Implemented

### 1. Added Configurable Settings

Created two new user-configurable settings in the Preview category:

- **`preview:maxfilesize`** (default: 10 MB)
  - Maximum file size for general previews
  - Range: 0-1000 MB
  - Setting to 0 disables the limit (not recommended)

- **`preview:maxcsvsize`** (default: 1 MB)
  - Maximum CSV file size for table view
  - Range: 0-100 MB
  - CSV files are more memory-intensive due to table rendering

### 2. Modified File Loading Order

Updated `fullFileAtom` to check file size BEFORE calling `RpcApi.FileReadCommand`:

```typescript
// Check file size BEFORE loading to prevent memory spikes
const fileInfo = await get(this.statFile);
if (fileInfo && !fileInfo.notfound && !fileInfo.isdir) {
    const maxFileSizeMB = (globalStore.get(getSettingsKeyAtom("preview:maxfilesize")) as number) ?? 10;
    const maxCSVSizeMB = (globalStore.get(getSettingsKeyAtom("preview:maxcsvsize")) as number) ?? 1;
    const maxFileSize = (maxFileSizeMB as number) * 1024 * 1024;
    const maxCSVSize = (maxCSVSizeMB as number) * 1024 * 1024;

    // Don't load files that exceed size limits
    if (fileInfo.mimetype === "text/csv" && maxCSVSize > 0 && fileInfo.size > maxCSVSize) {
        return null; // File too large, return null to prevent loading
    }
    if (maxFileSize > 0 && fileInfo.size > maxFileSize && !isStreamingType(fileInfo.mimetype)) {
        return null; // File too large, return null to prevent loading
    }
}
```

### 3. Improved Error Messages

Updated error messages in `getSpecializedView()` to:
- Show actual file size (formatted in MB)
- Show current limit
- Provide actionable guidance (increase limit in Settings or open in external editor)

Example error messages:
- `"CSV File Too Large to Preview (15.50 MB / 1 MB max). Increase limit in Settings → Preview → Max CSV Size, or open in external editor."`
- `"File Too Large to Preview (100.00 MB / 10 MB max). Increase limit in Settings → Preview → Max File Size, or open in external editor."`

## Files Modified

### Frontend Files
1. **`frontend/app/store/settings-registry.ts`**
   - Added `preview:maxfilesize` setting metadata
   - Added `preview:maxcsvsize` setting metadata

2. **`frontend/app/view/preview/preview-model.tsx`**
   - Renamed constants: `MaxFileSize` → `DefaultMaxFileSize`, `MaxCSVSize` → `DefaultMaxCSVSize`
   - Modified `fullFileAtom` to check file size before loading
   - Updated `getSpecializedView()` to use configurable limits
   - Improved error messages with file size and limit information

3. **`frontend/app/view/preview/preview-model.test.ts`**
   - Added 5 new tests for size limit validation
   - Tests verify calculations, formatting, and zero-limit behavior

### Backend Files
1. **`pkg/wconfig/settingsconfig.go`**
   - Added `PreviewMaxFileSize float64` field to `SettingsType` struct
   - Added `PreviewMaxCSVSize float64` field to `SettingsType` struct

2. **`frontend/types/gotypes.d.ts`** (auto-generated)
   - Added TypeScript type definitions for new settings

## Validation

### Build Verification
- ✅ Go compilation: `go build ./...` - SUCCESS
- ✅ TypeScript types: `task generate` - SUCCESS
- ✅ All tests pass: `npm test` - 280/280 PASSED

### Test Coverage
Added 5 new unit tests in `preview-model.test.ts`:
- Default size limits are defined
- Size limit calculations work correctly
- CSV size limits are smaller than general file limits
- Size formatting for error messages
- Zero limit disables size check

### Memory Impact
- **Before**: Opening a 100MB file would load all 100MB into memory, then show error
- **After**: Opening a 100MB file checks size (via `FileInfoCommand`), shows error, loads nothing

## User Experience

### Before Fix
1. User clicks on 100MB file
2. Application freezes/slows while loading 100MB
3. Error message appears: "File Too Large to Preview (10 MB Max)"
4. Memory spike visible in system monitor

### After Fix
1. User clicks on 100MB file
2. Instant response (only file info is fetched, ~1KB)
3. Error message appears: "File Too Large to Preview (100.00 MB / 10 MB max). Increase limit in Settings → Preview → Max File Size, or open in external editor."
4. No memory spike
5. User can adjust limit in Settings → Preview if needed

## Configuration

Users can adjust limits in **Settings → Preview**:

- **Max File Size (MB)**: General file preview limit (default: 10 MB, range: 0-1000 MB)
- **Max CSV Size (MB)**: CSV table view limit (default: 1 MB, range: 0-100 MB)

Setting a limit to 0 disables the check (not recommended for production use).

## Performance Characteristics

| File Size | Old Behavior | New Behavior |
|-----------|--------------|--------------|
| < 10 MB | Load fully ✅ | Load fully ✅ |
| 10-100 MB | Load fully → Error ❌ | Check size → Error ✅ |
| > 100 MB | Load fully → Error ❌ | Check size → Error ✅ |

**Memory savings**: For a 100MB file, this saves ~100MB of memory allocation and prevents the load operation entirely.

## Notes

- Streaming file types (PDF, video, audio, images) are not affected by this limit as they use streaming endpoints
- Directories are not affected by this limit
- Empty files (size = 0) are always allowed
- The size check uses `FileInfoCommand` which only retrieves metadata, not file content

## Related Code

- File reading: `pkg/wshrpc/wshremote/wshremote_file.go` (RpcApi.FileReadCommand)
- File info: `pkg/wshrpc/wshrpctypes_file.go` (FileInfo type)
- Settings UI: `frontend/app/view/waveconfig/` (settings panels)
