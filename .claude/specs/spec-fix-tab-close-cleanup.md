# Spec: Tab Close Confirm Code Cleanup

**Date:** 2026-03-25
**Status:** Draft
**Goal:** Remove duplicated tab close confirmation logic; use the utility functions from `tabclose-confirm.ts`

---

## 1. Problem

- `keymodel.ts` duplicates the `tab:confirmclose` settings check inline instead of calling `isTabCloseConfirmEnabled()`
- `keymodel.ts` calls `modalsModel.pushModal("TabCloseConfirmModal", ...)` directly instead of using `showTabCloseConfirm()`
- `tabbar.tsx` also calls `modalsModel.pushModal` directly instead of using `showTabCloseConfirm()`
- `showTabCloseConfirm()` in `tabclose-confirm.ts` is exported but never called (dead code)

## 2. Files to Modify

| File | Change |
|------|--------|
| `frontend/app/store/keymodel.ts` | Replace inline settings check + pushModal with `isTabCloseConfirmEnabled()` + `showTabCloseConfirm()` from `tabclose-confirm.ts` |
| `frontend/app/tab/tabbar.tsx` | Replace inline pushModal with `showTabCloseConfirm()` from `tabclose-confirm.ts` |

## 3. Acceptance Criteria

- [ ] `keymodel.ts` imports and calls `isTabCloseConfirmEnabled()` instead of reading settings directly
- [ ] `keymodel.ts` imports and calls `showTabCloseConfirm()` instead of calling `modalsModel.pushModal` directly
- [ ] `tabbar.tsx` calls `showTabCloseConfirm()` instead of calling `modalsModel.pushModal` directly
- [ ] `showTabCloseConfirm()` is no longer dead code
- [ ] `modalsModel` import can be removed from `keymodel.ts` (if no longer needed)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes
