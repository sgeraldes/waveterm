# Spec: Fix bool/pointer Settings Bug

**Date:** 2026-03-25
**Status:** Draft
**Goal:** Fix `TabConfirmClose` and `WindowConfirmClose` to use `*bool` so users can explicitly set them to `false`

---

## 1. Problem

In `pkg/wconfig/settingsconfig.go`, boolean settings with `true` defaults use plain `bool` with `omitempty`. Since `false` is the zero value for `bool`, Go's JSON serializer omits it, making it impossible for users to disable these settings.

## 2. Files to Modify

| File | Change |
|------|--------|
| `pkg/wconfig/settingsconfig.go` | Change `TabConfirmClose bool` to `*bool`; change `WindowConfirmClose bool` to `*bool` |

## 3. After Modification

Run `task generate` to regenerate:
- `pkg/wconfig/metaconsts.go`
- `frontend/types/gotypes.d.ts`

## 4. Acceptance Criteria

- [ ] `TabConfirmClose` field is `*bool` in SettingsType
- [ ] `WindowConfirmClose` field is `*bool` in SettingsType
- [ ] `task generate` runs successfully
- [ ] `go build ./...` passes
- [ ] `npx tsc --noEmit` passes
