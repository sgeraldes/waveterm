# Spec-Driven Audit Report — Wave Terminal TODO Specs

**Date:** 2026-03-25
**Specs Audited:** 8
**Teams Dispatched:** 3 (competing, independent)
**Methodology:** Team A (file paths/APIs), Team B (architecture/patterns), Team C (acceptance criteria)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Specs audited | 8 |
| Total acceptance criteria | ~120 |
| Cross-team convergent findings | 7 (independently discovered by 2+ teams) |
| CRITICAL issues | 4 |
| HIGH issues | 6 |
| MEDIUM issues | 12 |
| LOW issues | 8 |
| Missing acceptance criteria | 56 (Team C) |
| Shortcut conflicts | 3 collisions across 5 specs |

---

## CRITICAL Issues (fix before implementation)

### CRIT-1: `preview:line` meta key does not exist (CL spec assumes it does)

**Found by:** Team A, Team B (convergent)

The clickable-file-links spec proposes `meta["preview:line"] = line` to open previews at a specific line. This key does not exist in `wtypemeta.go`, `metaconsts.go`, or `gotypes.d.ts`. The `PreviewModel` has no code to read or act on it.

**Affected specs:** CL (clickable-file-links), MD (multi-document-preview)
**Fix:** Add `PreviewLine *int64` to `MetaTSType` in `wtypemeta.go`, run `task generate`, add line-scrolling logic in `PreviewModel` (Monaco's `revealLineInCenter`).

---

### CRIT-2: Keyboard shortcut triple-collision on `Ctrl+Shift+T`

**Found by:** Team B, Team C (convergent)

Three specs claim `Ctrl+Shift+T`:
- **MT** (multi-terminal): "New Terminal Tab" inside terminal blocks
- **WP** (widget-popout): "Toggle always-on-top" in widget windows
- **Existing**: Tab Management panel (`tabbar.tsx:384`)

**Fix:** Assign unique shortcuts. Suggested:
- MT: Keep `Ctrl+Shift+T` (matches browser convention for reopening tabs)
- WP: Change to `Ctrl+Shift+P` (pin) for always-on-top
- Existing Tab Management: Already at `Ctrl+Shift+T` — MT must only intercept when focus is inside a terminal block

---

### CRIT-3: `Ctrl+Tab` / `Ctrl+Shift+Tab` triple-collision

**Found by:** Team B, Team C (convergent)

Three uses claim the same shortcut:
- **MT**: Cycle terminal sub-sessions within a block
- **MD**: Cycle document tabs within a preview block
- **Existing**: Maximize-mode block cycling (`keymodel.ts:566-578`)

**Fix:** Define priority: block-level handler wins when focus is inside a multi-session/multi-doc block; global handler wins otherwise. The specs must explicitly document this priority chain.

---

### CRIT-4: `LayoutNode.hidden` affects 14 action handlers (WP spec)

**Found by:** Team B (unique)

Adding `hidden?: boolean` to `LayoutNode` changes layout tree semantics. The tree is persisted in the database. 14 `LayoutTreeActionType` handlers (`Move`, `Swap`, `ResizeNode`, `FocusNode`, `MagnifyNodeToggle`, `ClearTree`, etc.) must all be audited for behavior with hidden nodes. A hidden node adjacent to a resize handle could cause visual glitches. A `FocusNode` on a hidden node is undefined behavior.

**Fix:** Either (a) enumerate all 14 handlers and specify behavior with hidden nodes, or (b) remove the node from the tree entirely on pop-out and restore from saved coordinates on pop-in (avoids corrupting the tree).

---

## HIGH Issues

### HIGH-1: MD spec creates duplicate RPC command

**Found by:** Team A, Team B, Team C (convergent — all 3 teams)

The multi-document-preview spec proposes a new `SubBlockCreateCommand` with `CommandSubBlockCreateData`. `CreateSubBlockCommand` with `CommandCreateSubBlockData` already exists at `wshrpctypes.go:259-262` and is correctly used by the MT spec.

**Fix:** Remove proposed `SubBlockCreateCommand` from MD spec. Use existing `CreateSubBlockCommand`.

### HIGH-2: MD spec references non-existent `BlockCloseCommand`

**Found by:** Team A, Team B (convergent)

Section 4.4 says "Existing: `BlockCloseCommand` (close/delete sub-block)". No such command exists. The correct command is `DeleteSubBlockCommand`.

**Fix:** Replace `BlockCloseCommand` with `DeleteSubBlockCommand` throughout the MD spec.

### HIGH-3: MT + TC sub-block process detection gap

**Found by:** Team B, Team C (convergent)

The tab-close-warning spec's `tabHasRunningProcess()` and `blockHasRunningProcess()` must iterate through `SubBlockIds` to detect running processes in sub-sessions. Neither the MT nor TC spec addresses this interaction.

**Fix:** Add to TC spec: "When any sub-session within a multi-session terminal block has a running process, the block close confirmation is triggered." Add to `blockHasRunningProcess`: recursively check `SubBlockIds`.

### HIGH-4: TC spec contradicts itself on `tab:skipcloseconfirm`

**Found by:** Team A, Team C (convergent)

The spec says both "no backend field needed — lives only in tab meta map" AND "Add to `frontend/types/gotypes.d.ts` MetaType". Adding to `gotypes.d.ts` requires adding to `MetaTSType` in `wtypemeta.go` (which is a backend field).

**Fix:** Choose one approach. Recommended: Add to `MetaTSType` in `wtypemeta.go` for type safety, run `task generate`.

### HIGH-5: TC spec `block:confirmclose` semantics are ambiguous

**Found by:** Team C (unique)

Default is `false`. Spec says "Block close confirmation only shown when block is a terminal with a running process." But if the default is `false` (disabled), the running-process check is irrelevant. The spec seems to intend that the running-process check is ALWAYS active and `block:confirmclose` adds confirmation even WITHOUT a running process. This must be clarified.

**Fix:** Rewrite Section 3.2 to explicitly state: "Block close confirmation is shown in two cases: (1) always when a terminal has a running process (regardless of setting), (2) for all terminal blocks when `block:confirmclose` is `true`."

### HIGH-6: WP + MT/MD interaction unspecified

**Found by:** Team C (unique)

If a multi-session terminal block (MT) or multi-doc preview block (MD) is popped out into a widget window, all sub-sessions/documents must render. Neither WP nor MT/MD addresses this.

**Fix:** Add to WP spec: "Popping out a block with `SubBlockIds` renders all sub-elements in the widget window (all terminal tabs or document tabs are preserved)."

---

## MEDIUM Issues

| ID | Spec | Issue | Found by |
|----|------|-------|----------|
| MED-1 | MD | References `UpdateObjectMeta` which doesn't exist; correct name is `SetMetaCommand` | Team A |
| MED-2 | CL | Says "no `task generate` needed" in 4.4 but contradicts 4.1 which correctly says it IS needed | Team B |
| MED-3 | KB | Hand-rolled YAML parser is maintenance risk; consider JSON front-matter or lightweight YAML lib | Team B |
| MED-4 | WP | Vite config filename wrong: spec says `vite.*.config.ts`, reality is `electron.vite.config.ts` | Team A |
| MED-5 | WP | 14 new IPC channels is an explosion; consider consolidating with type discriminator | Team B |
| MED-6 | TC | `blockHasRunningProcess` should use `getBlockingCommand()` from `shellblocking.ts`, not `shellProcStatus` | Team B |
| MED-7 | MT | `handleTerminalKeydown` is in `term-model.ts`, not `keymodel.ts` as spec implies | Team A |
| MED-8 | FC | Delete in context menu needs confirmation dialog (not specified) | Team C |
| MED-9 | FC | "Reveal in Finder" moved from top-level to submenu is a UX regression | Team C |
| MED-10 | All | Accessibility criteria missing from 7/8 specs (only WP has them) | Team C |
| MED-11 | SW | `deleteWorkspace` flow calls `switchWorkspace` which now routes differently | Team C |
| MED-12 | CL | Windows absolute path detection in criteria but not in acceptance tests | Team C |

---

## Cross-Spec Dependency Matrix

| Spec A | Spec B | Dependency | Status |
|--------|--------|------------|--------|
| MT | TC | Close warning must enumerate sub-block sessions | UNDOCUMENTED |
| MT | WP | Pop-out must render all sub-sessions | UNDOCUMENTED |
| MD | WP | Pop-out must preserve all document tabs | UNDOCUMENTED |
| MD | MT | Both use `SubBlockIds`; MD creates redundant RPC | CONFLICT |
| CL | MD | File link opens preview; should it open in existing multi-doc tab? | UNADDRESSED |
| WP | SW | Both create Electron windows; focus management unspecified | UNADDRESSED |
| CL | FC | Both enhance file interaction; shared `openFilePath` utility | UNCOORDINATED |
| MT | WP | `Ctrl+Shift+T` shortcut conflict | CONFLICT |
| MT/MD | Global | `Ctrl+Tab`/`Ctrl+Shift+Tab` conflict with maximize-mode | CONFLICT |

---

## Spec Quality Scores

| Spec | Team A (Accuracy) | Team B (Architecture) | Team C (Criteria) | Avg |
|------|-------------------|-----------------------|-------------------|-----|
| MT (Multi-Terminal Tabs) | 9/10 | PASS | 7/10 | 8.0 |
| MD (Multi-Document Preview) | 6/10 | PARTIAL | 6/10 | 6.0 |
| KB (Kanban Board) | 9/10 | PASS | 7/10 | 7.7 |
| CL (Clickable File Links) | 8/10 | PASS | 8/10 | 8.0 |
| FC (File Context Menu) | 9/10 | PASS | 6/10 | 7.3 |
| WP (Widget Pop-Out) | 9/10 | PARTIAL | 9/10 | 8.7 |
| SW (Simultaneous Workspaces) | 10/10 | PASS | 7/10 | 8.3 |
| TC (Tab Close Warning) | 8/10 | PASS | 7/10 | 7.3 |

**Best spec:** WP (Widget Pop-Out) — most thorough, best error handling, only spec with accessibility criteria
**Weakest spec:** MD (Multi-Document Preview) — references non-existent commands, duplicate RPC, wrong API names

---

## Priority Fix Order

### Phase A: CRITICAL (fix before any implementation)
1. Define unified keyboard shortcut strategy across all specs
2. Add `preview:line` meta key to Go types + frontend handling
3. Resolve `LayoutNode.hidden` impact on 14 action handlers (WP)
4. Fix MD spec: remove duplicate RPC, fix `BlockCloseCommand` -> `DeleteSubBlockCommand`

### Phase B: HIGH (fix during spec revision)
5. Document MT+TC sub-block process detection interaction
6. Clarify TC `block:confirmclose` semantics
7. Resolve TC `tab:skipcloseconfirm` backend field contradiction
8. Document WP+MT/MD sub-block pop-out behavior

### Phase C: MEDIUM (fix during implementation)
9. Fix API name references (MD: `UpdateObjectMeta` -> `SetMetaCommand`)
10. Fix file references (WP: `electron.vite.config.ts`, MT: `handleTerminalKeydown` location)
11. Add accessibility criteria to all specs
12. Address KB YAML parser risk
13. Add delete confirmation to FC spec

### Phase D: Missing Criteria (add to specs)
14. Add 56 missing acceptance criteria identified by Team C
15. Document all cross-spec dependencies
16. Add error handling criteria to all specs
17. Add platform-specific criteria where needed
