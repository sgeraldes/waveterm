# Spec: File Double-Click Execution and Context Menu Enrichment

**Date:** 2026-03-25
**Status:** Draft
**Goal:** Double-clicking a file in the directory preview launches it in its OS default application; right-clicking provides an Explorer/Finder-like context menu with Open, Open With, Copy, Delete, Rename, and Properties actions.

---

## 1. Scope

The directory preview block (`frontend/app/view/preview/preview-directory.tsx`) and its supporting files. Electron main process additions for a new IPC handler. No changes to the Go backend, no new RPC commands, no new Wave object types.

This feature applies only to the **local** connection. Remote SSH connections retain existing behavior (Download File replaces OS-open actions).

---

## 2. Current Behavior

- **Double-click any row**: calls `model.goHistory(path)`. Directories navigate. Files open in a Wave preview block. Non-previewable binaries show an error.
- **Right-click a file**: shows New File, New Folder, Rename, Copy File Name (4 variants), Reveal in Finder/Explorer, Open File in Default Application, Open Preview in New Block, Open Terminal Here, Delete.
- **Right-click background**: shows New File, New Folder, Reveal in Finder/Explorer, Open Terminal Here.
- No "Open With", no Properties panel, no double-click-to-execute for binaries.

---

## 3. Proposed Behavior

### 3.1 Double-Click

| File category | Double-click action |
|---|---|
| Directory | Navigate into it (unchanged) |
| Text, code, markdown, CSV, image, PDF, audio, video | Open in Wave preview block (unchanged) |
| Executable (`.exe`, `.app`, Mach-O, ELF, `.sh`, etc.) | Run/open via `openNativePathExplicit(path)` |
| Unknown/unsupported mimetype | Open via `openNativePathExplicit(path)` |

### 3.2 Right-Click Context Menu (on a file)

```
Open                          <- calls openNativePathExplicit (local only; grayed for remote)
Open With >                   <- submenu (local only; hidden for remote)
  Open in Wave Preview
  Open in Terminal (as argument)
  ---
  Reveal in Finder / Explorer
Open Preview in New Block
Open Terminal Here
---
Rename
Copy File Name
Copy Full Path
Copy Full Path (Shell Quoted)
---
Delete (with confirmation dialog)
---
Properties
```

### 3.3 Right-Click Context Menu (on background)

```
New File
New Folder
---
Open Terminal Here
Reveal in Finder / Explorer
```

### 3.4 Properties Panel

A floating overlay showing: Name, Full path, Size, MIME type, Permissions, Last modified, Read-only status. Uses the existing `@floating-ui/react` overlay pattern.

---

## 4. Technical Design

### 4.1 Data Model Changes

None. `FileInfo` already carries all properties needed.

### 4.2 Frontend Changes

**`frontend/util/previewutil.ts`**

Rewrite `addOpenMenuItems` to produce the structured menu groups. Add:
```typescript
export function isNativeOpenable(mimeType: string): boolean
```

**`frontend/app/view/preview/preview-directory.tsx`**

Replace unconditional `model.goHistory()` on double-click with `handleDoubleClick(finfo)` that dispatches based on mimetype:
- Directories -> navigate
- Previewable files -> preview
- Non-previewable + local -> `openNativePathExplicit`

Expand `handleFileContextMenu` with new menu structure. Add `propertiesFileAtom` and `FilePropertiesOverlay` rendering.

**`frontend/app/view/preview/file-properties-overlay.tsx`** (new)

Component showing file metadata from `FileInfo`. Positioned center of `dir-table-container`, closed on outside click.

**`frontend/app/view/preview/directorypreview.scss`**

Add `.file-properties-overlay` styles matching `.entry-manager-overlay`.

### 4.3 Backend Changes

None.

### 4.4 RPC/API Changes

**`emain/emain-ipc.ts`** — Add `open-native-path-explicit` IPC handler:
- Same as `open-native-path` but without the home-directory restriction
- Retains: tilde expansion, path.resolve, UNC block, existence check

**`emain/preload.ts`** — Expose `openNativePathExplicit`

**`frontend/types/custom.d.ts`** — Add to `ElectronApi`

---

## 5. UI/UX Design

**Double-click feedback**: No spinner. If `openNativePathExplicit` returns error, show notification.

**"Open With" submenu**: Two static items: "Open in Wave Preview" and "Open in Terminal (as argument)". No OS application enumeration.

**Properties overlay**: Positioned center of directory table. Read-only display. Closes on outside click.

**Disabled items**: "Open" and "Open With" are grayed for remote connections.

**Delete confirmation:** Selecting "Delete" from the context menu shows a confirmation dialog: "Delete {filename}? This cannot be undone." with [Cancel] and [Delete] buttons. The dialog uses the existing `Modal` component pattern.

---

## 6. Dependency Order

1. **`emain/emain-ipc.ts` + `emain/preload.ts` + `frontend/types/custom.d.ts`** — Add IPC handler
2. **`frontend/util/previewutil.ts`** — Add `isNativeOpenable()`, restructure menu
3. **`frontend/app/view/preview/file-properties-overlay.tsx`** (new) — Properties component
4. **`frontend/app/view/preview/directorypreview.scss`** — Properties styles
5. **`frontend/app/view/preview/preview-directory.tsx`** — Integrate all changes. Depends on steps 2-4.

---

## 7. Acceptance Criteria

- [ ] Double-clicking a `.txt` file opens in Wave code editor (unchanged)
- [ ] Double-clicking a `.png` file opens in Wave image preview (unchanged)
- [ ] Double-clicking a directory navigates into it (unchanged)
- [ ] Double-clicking a `.exe` / `.app` / ELF binary calls `openNativePathExplicit`
- [ ] Double-clicking unknown MIME type calls `openNativePathExplicit`
- [ ] Error from `openNativePathExplicit` shows notification
- [ ] Right-click menu on local file has: Open, Open With submenu, Rename, Copy variants, Delete, Properties
- [ ] Right-click on remote file has "Open" and "Open With" grayed out
- [ ] "Open With -> Open in Wave Preview" opens preview block
- [ ] "Open With -> Open in Terminal" creates terminal block in current tab
- [ ] "Properties" opens overlay with file metadata
- [ ] Properties overlay closes on outside click
- [ ] Background right-click shows: New File, New Folder, Open Terminal Here, Reveal
- [ ] `openNativePathExplicit` works for paths outside `$HOME`
- [ ] `openNativePathExplicit` blocks UNC paths on Windows
- [ ] `openNativePathExplicit` blocks non-existent paths
- [ ] Selecting "Delete" from the context menu shows a confirmation dialog before deleting
- [ ] Confirmation dialog is keyboard-navigable (Escape cancels, Enter confirms)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `go build ./...` passes

### Accessibility
- [ ] Properties overlay is keyboard-dismissible (Escape closes it)
- [ ] Properties overlay has `role="dialog"` and `aria-labelledby`
- [ ] All context menu items are keyboard-accessible
- [ ] "Open" and "Open With" items announce "disabled" state to screen readers when grayed for remote connections

---

## Files to Create or Modify

| File | Action |
|---|---|
| `emain/emain-ipc.ts` | Modify — add `open-native-path-explicit` handler |
| `emain/preload.ts` | Modify — expose `openNativePathExplicit` |
| `frontend/types/custom.d.ts` | Modify — add to `ElectronApi` |
| `frontend/util/previewutil.ts` | Modify — add `isNativeOpenable()`, restructure menu |
| `frontend/app/view/preview/file-properties-overlay.tsx` | Create |
| `frontend/app/view/preview/directorypreview.scss` | Modify |
| `frontend/app/view/preview/preview-directory.tsx` | Modify |
