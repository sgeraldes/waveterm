# Spec: Tab/Widget Close Warning

**Date:** 2026-03-25
**Status:** Draft
**Goal:** Complete the close-confirmation system so it covers tabs, widgets/blocks, and keyboard shortcuts uniformly, with process-awareness and per-tab opt-out.

---

## 1. Scope

This spec covers:

- Tab close confirmation (partially implemented, see Section 2)
- Widget/block close confirmation (not yet implemented)
- Process-aware confirmation messaging (terminal blocks with a running command)
- "Don't ask again" / per-tab skip mechanic
- Keyboard shortcut coverage: `Cmd+W` (close block), `Cmd+Shift+W` (close tab), middle-click on tab

Out of scope: window-level close confirmation (`window:confirmclose`, `app:confirmquit`) — those are separate systems already handled in `emain`.

---

## 2. Current Behavior (What Is Already Implemented)

### Setting

- `tab:confirmclose` — boolean, default `true`, registered in:
  - `pkg/wconfig/settingsconfig.go:155` — `TabConfirmClose *bool`
  - `pkg/wconfig/metaconsts.go:110` — `ConfigKey_TabConfirmClose`
  - `pkg/wconfig/defaultconfig/settings.json:26` — `"tab:confirmclose": true`
  - `frontend/app/store/settings-registry.ts:1118` — full `SettingMetadata` entry

### Modal

- `frontend/app/modals/tabcloseconfirm.tsx` — `TabCloseConfirmModal` component using the `Modal` primitive; has "Close Tab" / "Cancel" buttons; static message body

### Utility

- `frontend/app/tab/tabclose-confirm.ts` — `isTabCloseConfirmEnabled()` and `showTabCloseConfirm(tabName, onConfirm)`

### Call Sites

- `frontend/app/tab/tabbar.tsx` — `handleCloseTab()` checks and calls utility
- `frontend/app/store/keymodel.ts` — `simpleCloseStaticTab()` checks and calls utility
- `frontend/app/store/keymodel.ts` — `genericClose()` calls `simpleCloseStaticTab()` when `blockCount === 0`

### Gaps

1. `uxCloseBlock()` in `keymodel.ts` — closes a widget/block with no confirmation
2. Block header X button calls `uxCloseBlock()` directly — no confirmation
3. Context-menu "Close Block" calls `uxCloseBlock()` directly — no confirmation
4. Modal message says "running processes will be terminated" but doesn't check if any process is running
5. No "Don't ask again" checkbox
6. No per-tab metadata to skip confirmation
7. `Cmd+W` on any non-last block calls `genericClose()` -> `closeFocusedNode()` with no confirmation

---

## 3. Proposed Behavior (Complete Vision)

### 3.1 Tab Close Confirmation

- All tab close paths respect `tab:confirmclose` setting (already done)
- Modal message is conditional:
  - When any terminal block in the tab has a running process -> show "This tab has a running process. Closing will terminate it."
  - Otherwise -> show "Are you sure you want to close this tab?"
- "Don't ask again" checkbox that, when checked on confirm, sets `tab:confirmclose` to `false` globally

### 3.2 Widget/Block Close Confirmation

- New setting `block:confirmclose` (boolean, default `false`) — when `true`, shows confirmation on EVERY terminal block close regardless of process state
- **Running process detection is always active**, independent of `block:confirmclose`:
  - A terminal block with a detected running foreground process (via `getBlockingCommand()` from `shellblocking.ts`, NOT `shellProcStatus`) always shows the block close confirmation, even when `block:confirmclose` is `false`
  - When `block:confirmclose` is `true`, confirmation is shown for ALL terminal block closes, even those without running processes
- Non-terminal blocks (preview, web, editor) never show a block close confirmation
- Separate modal: `BlockCloseConfirmModal`

**Sub-block awareness (multi-session terminals):** When the multi-terminal-tabs feature (spec-multi-terminal-tabs.md) is implemented, `blockHasRunningProcess(blockId)` must iterate through `block.SubBlockIds` and recursively check each sub-session's process status. A terminal block with 3 sub-sessions where one has a running process must trigger the confirmation.

Similarly, `tabHasRunningProcess(tabId)` must check all blocks in the tab AND their sub-blocks.

### 3.3 Per-Tab Skip Metadata

- New tab metadata key `tab:skipcloseconfirm` (boolean, default `false`)
- When `true`, that tab skips close confirmation regardless of global setting
- Settable from tab context menu: "Skip close confirmation for this tab"

### 3.4 Trigger Coverage

| Action | Current | Target |
|---|---|---|
| Tab close button click | Confirmed | Confirmed |
| Tab middle-click | Confirmed | Confirmed |
| `Cmd+Shift+W` (close tab) | Confirmed | Confirmed |
| `Cmd+W` on last block in tab | Confirmed | Confirmed |
| `Cmd+W` on non-last block | No confirmation | Block confirm if terminal + running |
| Block header X button | No confirmation | Block confirm if terminal + running |
| Block context menu "Close Block" | No confirmation | Block confirm if terminal + running |

---

## 4. Technical Design

### 4.1 Data Model Changes

**New setting:** `block:confirmclose` — boolean, default `false`

- `pkg/wconfig/settingsconfig.go` — add `BlockConfirmClose *bool`
- `pkg/wconfig/defaultconfig/settings.json` — add `"block:confirmclose": false`
- `frontend/app/store/settings-registry.ts` — register entry
- Run `task generate` after

**New tab metadata key:** `tab:skipcloseconfirm` — boolean

- Add `TabSkipCloseConfirm *bool` to `MetaTSType` in `pkg/waveobj/wtypemeta.go` for type safety
- Run `task generate` to regenerate `metaconsts.go` and `gotypes.d.ts`
- The field is persisted in the tab's metadata via the standard `SetMetaCommand` flow

### 4.2 Frontend Changes

**`frontend/app/tab/tabclose-confirm.ts`** — extend utility:

```typescript
function isTabCloseConfirmEnabledForTab(tabId: string): boolean {
    if (!isTabCloseConfirmEnabled()) return false;
    const tabData = globalStore.get(WOS.getWaveObjectAtom<Tab>(WOS.makeORef("tab", tabId)));
    return !tabData?.meta?.["tab:skipcloseconfirm"];
}

function tabHasRunningProcess(tabId: string): boolean {
    // Check terminal status atoms for blocks in this tab
}
```

**`frontend/app/modals/tabcloseconfirm.tsx`** — update props:

```typescript
interface TabCloseConfirmModalProps {
    tabName: string;
    hasRunningProcess: boolean;
    onConfirm: () => void;
}
```

- Conditional message based on `hasRunningProcess`
- Add "Don't ask again" checkbox; on confirm with checkbox checked, set `tab:confirmclose: false`

**`frontend/app/modals/blockcloseconfirm.tsx`** — new file:

- Mirrors `tabcloseconfirm.tsx` structure
- Message: "This terminal has a running process. Closing will terminate it."
- Buttons: "Close Terminal" / "Cancel"
- Register in `modalregistry.tsx`

**`frontend/app/block/blockclose-confirm.ts`** — new utility:

```typescript
function isBlockCloseConfirmEnabled(): boolean
function blockHasRunningProcess(blockId: string): boolean
function showBlockCloseConfirm(blockId: string, blockName: string, onConfirm: () => void): void
```

**`frontend/app/store/keymodel.ts`** — update `uxCloseBlock()`:

- Extract current close logic into `executeUxCloseBlock(blockId)`
- Before closing, check `blockHasRunningProcess(blockId)`
- If running, show `BlockCloseConfirmModal`

**`frontend/app/tab/tab.tsx`** (tab context menu):

- Add "Skip close confirmation" toggle item
- Reads/writes `tab:skipcloseconfirm` via `ObjectService.UpdateObjectMeta`

### 4.3 Backend Changes

No new backend changes beyond the `SettingsType` field addition. Run `task generate` after.

### 4.4 RPC/API Changes

None. All operations use existing frontend primitives.

---

## 5. UI/UX Design

### Tab Close Modal (updated)

```
+--------------------------------------+
|  Close Tab?                          |
|                                      |
|  Are you sure you want to close      |
|  "my-project"? This tab has a        |  <- only when running process
|  running process that will be        |
|  terminated.                         |
|                                      |
|  [ ] Don't ask again                 |
|                                      |
|  [Cancel]          [Close Tab]       |
+--------------------------------------+
```

### Block Close Modal (new)

```
+--------------------------------------+
|  Close Terminal?                     |
|                                      |
|  This terminal has a running         |
|  process. Closing will terminate it. |
|                                      |
|  [Cancel]       [Close Terminal]     |
+--------------------------------------+
```

### Tab Context Menu Addition

```
  Rename Tab
  Set Base Directory...
  Lock Base Directory
  ---
  Skip close confirmation   [checkmark]
  ---
  Close Tab
```

---

## 6. Dependency Order

1. **Add `block:confirmclose` setting** — Backend, `task generate`, settings registry
2. **Update `TabCloseConfirmModal`** — Add `hasRunningProcess` prop, conditional messaging, "Don't ask again" checkbox. Update `showTabCloseConfirm` signature.
3. **Create `BlockCloseConfirmModal`** — New modal + utility. Register in modal registry.
4. **Update `uxCloseBlock`** — Wire block close confirmation. Depends on step 3.
5. **Add `tab:skipcloseconfirm` metadata** — Add constant, context menu toggle. Depends on step 2.

---

## 7. Acceptance Criteria

### Settings

- [ ] `block:confirmclose` exists in SettingsType, metaconsts, settings.json, settings registry, gotypes.d.ts
- [ ] `block:confirmclose` defaults to `false`
- [ ] `tab:skipcloseconfirm` exists in MetaType in gotypes.d.ts

### Tab Close Confirmation

- [ ] Closing a tab with X button shows modal when `tab:confirmclose` is `true`
- [ ] Closing a tab via middle-click shows modal when enabled
- [ ] `Cmd+Shift+W` shows modal when enabled
- [ ] Modal mentions running process only when detected
- [ ] "Don't ask again" checkbox sets `tab:confirmclose` to `false`
- [ ] Tab with `tab:skipcloseconfirm: true` skips confirmation

### Block Close Confirmation

- [ ] Closing a terminal block with running process via X button shows block close modal
- [ ] Closing via context menu "Close Block" with running process shows modal
- [ ] Closing via `Cmd+W` with running process shows modal
- [ ] Closing a non-terminal block never shows modal
- [ ] Closing a terminal with no running process does NOT show modal when `block:confirmclose` is `false`
- [ ] Programmatic block deletion via `DeleteBlockCommand` (e.g., from `wsh` CLI) bypasses the frontend confirmation modal
- [ ] When closing the last block in a tab triggers tab close, only the tab close modal is shown (not both block and tab modals)

### Per-Tab Skip

- [ ] Tab context menu includes "Skip close confirmation" toggle
- [ ] Toggle reads and writes `tab:skipcloseconfirm`
- [ ] Checkmark present when flag is active

### Accessibility
- [ ] Tab close confirmation modal is keyboard-navigable: Tab moves between buttons, Escape cancels, Enter confirms focused button
- [ ] Block close confirmation modal has the same keyboard navigation
- [ ] Both modals have `role="dialog"` and `aria-labelledby` pointing to the title
- [ ] "Don't ask again" checkbox is keyboard-accessible and screen-reader announced

### Build and Tests

- [ ] `go build ./...` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes with zero failures
