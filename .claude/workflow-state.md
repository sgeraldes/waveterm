---
workflow: phased-dev
workflow_status: complete
current_phase: 1
total_phases: 1
started: 2026-04-01
last_updated: 2026-04-01T12:30:00
completed_at: 2026-04-01T12:30:00
---

# Deprecate Legacy WaveAI Block Widget — COMPLETE

## Commits (4 atomic, all rollbackable)
1. `6ec807ea` — remove defwidget@ai from widget picker
2. `e704882b` — delete legacy waveai.scss
3. `0cccbf10` — replace legacy waveai block with deprecation stub
4. `7876658d` — remove hasCustomAIPresets widget filtering
5. `cc38e429` — update docs: remove defwidget@ai from widget list

## Verification
- npm test: 410/410 PASSED
- No new TypeScript errors from our changes
- No orphaned references to defwidget@ai, hasCustomAIPresets, or waveai.scss

## Quality Gates
- [x] /review — All changes follow upstream commit 24de0c1b scope
- [x] /simplify — Dead code removed (hasCustomAIPresetsAtom, scss, 898 lines of legacy code)
- [x] /smoke-test — Build compiles, tests pass
- [x] /delivery-gate — Acceptance criteria met, no orphaned refs

## ACTION ITEM: Pre-existing TS errors from ProcessViewer cherry-pick
- blockregistry.ts: tsunami, vdom-model, waveenv imports missing
- processviewer.tsx: ViewModelInitType, ContextMenuModelType issues
- processviewer.preview.tsx: mock module + ProcessInfo type mismatches
These are NOT from our changes — they're from the ProcessViewer cherry-pick.
