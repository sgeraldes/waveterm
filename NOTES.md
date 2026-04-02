# Notes

## Rebranding: Fork Identity Separation

I need this app to part ways with Wave Terminal. New name, new icon, new version number. I want to be able to have both apps installed side by side without conflicts.

Working name: "Something" Terminal (placeholder until decided).

Full spec: `.claude/specs/spec-fork-rebrand.md`

---

## Ideas (atomic, parallelizable)

### Pick a name
Choose a new product name and slug. Everything else depends on this. The slug drives package names, directory names, env vars, binary names.

### Design a new icon set
Create new app icons (`.ico`, `.icns`, `.svg`). Needs to look distinct from Wave's teal wave icon. Can be done independently once the name is picked.

### Fresh version numbering
Start at `1.0.0` to signal a clean break from upstream `0.x` versioning.

### Separate data directories
The fork must store config/data in its own directories so both apps coexist. This is the `envPaths()` prefix in `emain/emain-platform.ts` plus the env vars (`WAVETERM_*` → new prefix).

### Remove or replace cloud endpoints
The fork doesn't use `waveterm.dev` cloud services. The `WCLOUD_*` endpoints in Taskfile.yml and `.env` should either be removed, stubbed out, or pointed to fork-owned infrastructure.

### Rewrite the About dialog
New name, new logo, new copyright, new GitHub link. The About modal (`frontend/app/modals/about.tsx`) is self-contained enough to rewrite independently.

### Update onboarding flow
The welcome screen and fake chat demo reference "Wave Terminal" and `~/waveterm`. Update to new name.

### Redirect doc links
12+ frontend files link to `docs.waveterm.dev`. Decision needed: host fork docs, keep pointing to upstream (since core features are shared), or remove the links.

### Rename Go module path
Mechanical find-and-replace across 100+ Go files (`github.com/wavetermdev/waveterm` → new path). Low risk, high volume. Can be done last since it doesn't affect the user-facing identity.

### Update GitHub repo references
About dialog and onboarding link to `github.com/wavetermdev/waveterm`. Should point to the fork.

### Binary renaming
Decide whether `wavesrv` and `wsh` keep their names or get renamed. Less visible to users but matters for process identification and shell integration.

### New publisher identity
Replace "Command Line Inc" in package.json author, electron-builder publisher, and About dialog copyright.
