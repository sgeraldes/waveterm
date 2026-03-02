# File Watch Implementation - PV-003

## Overview
Implemented automatic file watching for the preview view to detect external changes and auto-refresh content.

## Changes Made

### Backend (Go)

1. **New Package: `pkg/filewatcher/filewatcher.go`**
   - Singleton file watcher using fsnotify
   - Debounce delay of 300ms to avoid rapid-fire events
   - Supports multiple blocks watching the same file
   - Methods:
     - `AddWatch(path, blockId)` - Start watching a file for a block
     - `RemoveWatch(path, blockId)` - Stop watching a file for a block
     - `RemoveAllWatchesForBlock(blockId)` - Cleanup when block closes
   - Publishes WPS events on file changes

2. **Updated: `pkg/wshrpc/wshrpctypes.go`**
   - Added `FileWatchCommand` to RPC interface
   - Added `CommandFileWatchData` type:
     ```go
     type CommandFileWatchData struct {
         Path    string `json:"path"`
         Watch   bool   `json:"watch"`  // true to start, false to stop
         BlockId string `json:"blockid,omitempty"`
     }
     ```

3. **Updated: `pkg/wps/wpstypes.go`**
   - Added `Event_FileChange` constant
   - Added `FileChangeEventData` type:
     ```go
     type FileChangeEventData struct {
         Path    string `json:"path"`
         BlockId string `json:"blockid,omitempty"`
         ModTime int64  `json:"modtime,omitempty"`
     }
     ```

4. **Updated: `pkg/wshrpc/wshserver/wshserver.go`**
   - Implemented `FileWatchCommand`:
     - Validates path and blockId
     - Gets absolute path
     - Verifies file exists
     - Delegates to file watcher singleton
   - Added import for filewatcher package

### Frontend (TypeScript)

1. **Updated: `frontend/app/view/preview/preview-model.tsx`**
   - Added `fileWatchEnabled` atom to track watch state
   - Added `startFileWatcher()` method:
     - Only watches local files (not remote)
     - Skips directories and non-existent files
     - Calls RPC to start watching
     - Subscribes to file:change events
   - Added `stopFileWatcher()` method:
     - Calls RPC to stop watching
     - Unsubscribes from events
   - Added `handleFileChangeEvent()` method:
     - Increments refreshVersion atom
     - Clears cached content

2. **Updated: `frontend/app/view/preview/preview.tsx`**
   - Added WPS import for event subscription
   - Added effect to start/stop watching based on view type:
     - Watches for: codeedit, markdown, csv views
     - Cleans up on unmount or view change
   - Added effect to subscribe to file:change events:
     - Scoped to current blockId
     - Calls model.handleFileChangeEvent() on event

## How It Works

1. **Initialization**:
   - When preview view mounts with a watchable view type (codeedit/markdown/csv)
   - Frontend calls `FileWatchCommand` with `watch: true`
   - Backend adds file to fsnotify watcher

2. **File Change Detection**:
   - fsnotify detects Write/Remove events
   - Debouncer waits 300ms for rapid changes
   - Publishes WPS event with blockId scope

3. **Frontend Update**:
   - WPS event handler receives file:change event
   - Increments refreshVersion atom
   - Clears cached content
   - Jotai re-runs fullFile atom getter
   - View re-renders with new content

4. **Cleanup**:
   - On unmount or view change, frontend calls `FileWatchCommand` with `watch: false`
   - Backend removes watch entry
   - If no more blocks watching, removes from fsnotify

## Testing

Manual test:
1. Open a local file in preview (markdown, code, or CSV)
2. Edit the file in an external editor
3. Save the file
4. Preview should auto-refresh within 300ms

## Limitations

- **Local files only**: Remote files via SSH/WSL are not watched (would require wsh-side implementation)
- **Directories not watched**: Only regular files are watched
- **No recursive watching**: Only watches the specific file, not its directory

## Future Enhancements

- Add visual indicator when auto-refresh occurs
- Add setting to disable auto-refresh
- Support remote file watching via wsh
- Add file watch status to block metadata
