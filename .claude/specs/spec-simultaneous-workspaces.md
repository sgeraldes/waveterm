# Spec: Simultaneous Workspaces in Separate Electron Windows

**Date:** 2026-03-25
**Status:** Draft
**Goal:** Selecting a workspace always opens it in a new Electron window; every workspace lives simultaneously in its own window.

---

## 1. Scope

This spec covers the changes required so that activating any workspace from the workspace switcher panel always opens that workspace in a dedicated Electron window, leaving the calling window untouched. The existing behavior — where the current window is repurposed to show the target workspace (potentially destroying the previous workspace) — is removed entirely.

Out of scope: workspace-to-workspace drag-and-drop, per-workspace window geometry persistence beyond what already exists, and any changes to the workspace editor/creation flow unrelated to the switching mechanic.

---

## 2. Current Behavior

The current workspace-switch flow has two branches, both rooted in `WaveBrowserWindow.switchWorkspace` (`emain/emain-window.ts:356`):

**Branch A — target workspace already has a window:**
`SwitchWorkspace` on the backend (`pkg/wcore/window.go:41-48`) detects a window already owns the target workspace, issues a `FocusWindowCommand` RPC to Electron, and returns `nil`. The IPC handler (`emain/emain-window.ts:830`) does nothing more. The calling window stays on its current workspace.

**Branch B — target workspace is unowned:**
The backend reassigns the calling window's `WorkspaceId` to the target (`pkg/wcore/window.go:49-50`), then calls `DeleteWorkspace` on the previously held workspace (`pkg/wcore/window.go:55`). On the Electron side (`emain/emain-window.ts:571-581`), `processActionQueue` tears down all loaded tab views, sets `this.workspaceId`, and loads the new workspace's active tab. The previous workspace is deleted if it was unnamed and had only default content (`DeleteWorkspace` bails if the workspace has a name and icon, `pkg/wcore/workspace.go:127-129`).

**The frontend trigger** is `getApi().switchWorkspace(ws.oid)` in `frontend/app/tab/sections/workspaces-section.tsx:164,170`. This sends the `switch-workspace` IPC message handled in `emain/emain-window.ts:830`.

**Key problem:** Branch B destroys the calling window's workspace context (and potentially deletes it) in order to re-use the same OS window for a different workspace. Named workspaces survive deletion but their tab views are still discarded and reloaded. Unnamed workspaces are permanently deleted.

---

## 3. Proposed Behavior

Selecting any workspace that is not currently active in the calling window opens that workspace in a new Electron window. The calling window is never repurposed. Specifically:

1. If the target workspace already has an open window, focus that window (identical to current Branch A — no change needed here).
2. If the target workspace has no open window, call `createWindowForWorkspace(workspaceId)` — the same function already used in the "unsaved workspace has content" guard path (`emain/emain-window.ts:372-374`). The calling window remains on its current workspace.

The `SwitchWorkspace` backend RPC and the `switchworkspace` action queue entry in `processActionQueue` are no longer needed for case 2. The Electron-side `switchWorkspace` method becomes a thin router: focus if already open, create new window otherwise.

---

## 4. Technical Design

### 4.1 Data Model Changes

No data model changes are required. The `Window`, `Workspace`, and `Client` types in `pkg/waveobj/wtype.go` are unchanged. The `WorkspaceListEntry.WindowId` field (populated by `ListWorkspaces`, `pkg/wcore/workspace.go:350`) already exposes whether a workspace is currently attached to a window, which is all the routing logic needs.

The backend `SwitchWorkspace` function in `pkg/wcore/window.go` is no longer called from the new flow; it can be deprecated or left in place for any other callers. No Go changes are strictly required.

### 4.2 Frontend Changes

**File: `emain/emain-window.ts`**

`WaveBrowserWindow.switchWorkspace` (lines 356-377) is the sole entry point to change. Replace the body with:

```typescript
async switchWorkspace(workspaceId: string) {
    if (workspaceId === this.workspaceId) {
        return;                              // already on this workspace
    }
    const workspaceList = await WorkspaceService.ListWorkspaces();
    const existingEntry = workspaceList?.find((wse) => wse.workspaceid === workspaceId);
    if (existingEntry?.windowid) {
        // Workspace is already open: focus that window via the existing RPC path
        await this._queueActionInternal({ op: "switchworkspace", workspaceId });
        return;
    }
    // Workspace is unowned: open it in a brand-new window
    await createWindowForWorkspace(workspaceId);
}
```

The `case "switchworkspace"` branch inside `processActionQueue` (lines 571-582) is retained only for the "already-open, focus it" code path. The body of that case already calls `WindowService.SwitchWorkspace` which on the backend does the focus-only path when another window owns the workspace. This remains correct.

The deletion of child views (`this.removeAllChildViews()`, line 577) and the workspace re-assignment (`this.workspaceId = entry.workspaceId`, line 579) in `processActionQueue` must be removed from the `switchworkspace` case, because that case now only handles the focus-redirect path. After `WindowService.SwitchWorkspace` returns `nil` (focus path), there is nothing to reload; the queue entry should simply return early.

Revised `switchworkspace` case:

```typescript
case "switchworkspace":
    const focusResult = await WindowService.SwitchWorkspace(this.waveWindowId, entry.workspaceId);
    // focusResult is null when focus was dispatched to an existing window
    if (!focusResult) {
        return;
    }
    // Should not reach here in the new flow
    return;
```

Because `createWorkspace` (`emain/emain-window.ts:856`) calls `window.switchWorkspace(newWsId)` for new workspaces, it will now always open a new window for newly created workspaces (since they start unowned). The `else` branch (`createWindowForWorkspace(newWsId)`) in `createWorkspace` is now the only path and the `if (window)` conditional can be simplified:

```typescript
export async function createWorkspace(window: WaveBrowserWindow) {
    const newWsId = await WorkspaceService.CreateWorkspace("", "", "", true);
    if (newWsId) {
        await createWindowForWorkspace(newWsId);
    }
}
```

**File: `frontend/app/tab/sections/workspaces-section.tsx`**

No changes are required. The call `getApi().switchWorkspace(ws.oid)` at lines 164 and 170 remains. The new behavior is entirely driven by the emain routing logic described above.

### 4.3 Backend Changes

`pkg/wcore/window.go` — `SwitchWorkspace`:

The function's Branch B (lines 49-69) — which reassigns `window.WorkspaceId` and calls `DeleteWorkspace` — is no longer reachable from the new Electron flow. However, the function is still referenced from `WindowService.SwitchWorkspace` (called from the `processActionQueue` focus-path). For safety, leave the function intact but add a guard: if no existing window owns the target workspace, log a warning and return an error rather than silently mutating the database. This prevents any future callers from accidentally triggering the old destructive path.

No migration, no new RPC types, no `task generate` required.

### 4.4 RPC/API Changes

None. `WindowService.SwitchWorkspace` (the HTTP service endpoint) remains. `createWindowForWorkspace` already exists in `emain/emain-window.ts:669`. The `switch-workspace` IPC channel remains unchanged. No new IPC channels, no new preload entries.

---

## 5. UI/UX Design

**Workspace switcher panel** (`workspaces-section.tsx`):

The existing "open in another window" indicator (`fa-window-maximize` icon at line 185-190) already shows when a workspace has a `windowId`. No visual changes are required. Clicking any non-active workspace now opens a new OS window; the panel can close after the click (it already dismisses via `onDismissPanel` for tab items; workspace row clicks do not currently dismiss — this is acceptable).

**No confirmation dialogs** are needed for the new-window path. The previous dialog guard (`isNonEmptyUnsavedWorkspace`) existed only to protect against losing the current window's workspace during repurposing. Since the calling window is never repurposed, that guard is removed from `switchWorkspace`.

**Window count:** With this change, users can accumulate many open windows. No auto-limit is imposed; the existing "close window" flow handles cleanup. The OS taskbar/dock naturally groups all windows under the Wave app icon.

**Keyboard shortcut:** No new shortcuts are introduced. The existing workspace switcher shortcut (opened via the globe/workspace button in the tab bar) remains the entry point.

---

## 6. Dependency Order

The following order is determined by the dependency graph:

1. **Modify `WaveBrowserWindow.switchWorkspace`** in `emain/emain-window.ts` — this is the single routing change that drives all behavior.
2. **Simplify the `switchworkspace` case in `processActionQueue`** in `emain/emain-window.ts` — depends on step 1 establishing that this path only handles focus-redirect.
3. **Simplify `createWorkspace`** in `emain/emain-window.ts` — depends on step 1 establishing that `createWindowForWorkspace` is always correct.
4. **Add guard in `SwitchWorkspace`** in `pkg/wcore/window.go` — independent of steps 1-3, but logically follows once the destructive path is removed from emain.

All four steps are in the same two files. Steps 1-3 are in `emain/emain-window.ts` and can be done atomically in one edit pass.

---

## 6.5 Cross-Spec Dependencies

- **spec-widget-popout-v2.md**: Both specs create new Electron windows. Widget windows (`WaveWidgetWindow`) and workspace windows (`WaveBrowserWindow`) use different classes and different tracking maps (`widgetWindowMap` vs `waveWindowMap`). Focus management between them is unspecified — when both types of windows exist, the OS window manager handles focus ordering. No explicit coordination is required, but both specs must ensure their window tracking does not interfere with each other.

---

## 7. Acceptance Criteria

- [ ] Clicking a workspace in the workspace switcher panel that is not currently open opens a new Electron OS window containing that workspace.
- [ ] The window that originated the click is unaffected: it remains on its current workspace with all its tabs intact.
- [ ] Clicking a workspace that is already open in another window focuses that other window; no new window is created.
- [ ] Clicking the current workspace (already active) does nothing.
- [ ] Creating a new workspace via the "+" / create-workspace flow opens the new workspace in a new window (the calling window is not repurposed).
- [ ] Named workspaces are never deleted as a side effect of switching to another workspace.
- [ ] Unnamed/unsaved workspaces are never deleted as a side effect of switching to another workspace (they persist until their window is closed).
- [ ] The "open in another window" indicator in the workspace switcher correctly shows for workspaces that are open in other windows.
- [ ] App startup correctly restores all open windows (`relaunchBrowserWindows` in `emain/emain-window.ts:975`) — no regression.
- [ ] Backend `SwitchWorkspace` returns an error when called for an unowned workspace (Branch B guard), preventing the destructive reassignment path
- [ ] No confirmation dialog appears when switching workspaces (the previous unsaved-workspace guard is removed since the calling window is never repurposed)
- [ ] Deleting a workspace that has an open window closes that window and deletes the workspace
- [ ] If new window creation fails, an error notification is shown and the calling window remains on its current workspace
- [ ] On macOS, all workspace windows appear under a single dock icon with window menu navigation
- [ ] `go build ./...` passes with zero errors.
- [ ] `npx tsc --noEmit` passes with zero errors.
- [ ] `npm test` passes with zero failures.

### Accessibility
- [ ] Each workspace window has a distinct title (workspace name) for screen reader identification
- [ ] Window focus changes are announced to screen readers
- [ ] Keyboard shortcut for switching between workspace windows is documented
