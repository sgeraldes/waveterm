# Spec: Fork Rebrand — Identity Separation from Wave Terminal

**Date:** 2026-03-13
**Status:** Draft
**Goal:** Rebrand this fork so it can coexist with the official Wave Terminal as a separate installed application. Different name, icon, version, data directories, and identifiers.

---

## 1. Scope

This spec covers every touchpoint where the app identifies itself as "Wave Terminal" or "waveterm". After this work, a user should be able to install both the upstream Wave Terminal and this fork side-by-side with zero conflicts.

## 2. Placeholder Tokens

Throughout this spec, the following placeholders are used. Replace them once the name is decided.

| Token | Meaning | Example |
|-------|---------|---------|
| `PRODUCT_NAME` | Display name shown to users | "Something Terminal" |
| `APP_SLUG` | Lowercase identifier for dirs/packages | `something` |
| `APP_ID` | Reverse-DNS app identifier | `dev.sgeraldes.something` |
| `APP_VERSION` | Starting version number | `1.0.0` |

## 3. Changes by Category

### 3.1 App Identity — Configuration Files

| File | Field | Current | New |
|------|-------|---------|-----|
| `package.json` | `name` | `"waveterm"` | `"APP_SLUG"` |
| `package.json` | `productName` | `"Wave"` | `"PRODUCT_NAME"` |
| `package.json` | `version` | `"0.14.4"` | `"APP_VERSION"` |
| `package.json` | `build.appId` | `"dev.commandline.waveterm"` | `"APP_ID"` |
| `package.json` | `author` | `"Command Line Inc"` | New author |
| `package.json` | `homepage` | `"https://waveterm.dev"` | Fork homepage or GitHub URL |
| `Taskfile.yml` | `APP_NAME` | `"Wave"` | `"PRODUCT_NAME"` |
| `Taskfile.yml` | `WINGET_PACKAGE` | `"CommandLine.Wave"` | New WinGet ID |
| `electron-builder.config.cjs` | publish owner/repo | `sgeraldes/waveterm` | `sgeraldes/APP_SLUG` |
| `electron-builder.config.cjs` | publisher name | `"Command Line Inc"` | New publisher |
| `docs/package.json` | `name` | `"waveterm-docs"` | `"APP_SLUG-docs"` |

### 3.2 Data Directories & Environment Variables

These are critical for coexistence — both apps must use different directories.

| File | What | Current | New |
|------|------|---------|-----|
| `emain/emain-platform.ts` | `envPaths()` prefix | `"waveterm"` | `"APP_SLUG"` |
| `emain/emain-platform.ts` | `app.setName()` | `"waveterm/electron"` | `"APP_SLUG/electron"` |
| `emain/emain-platform.ts` | `app.setName()` display | `"Wave"` / `"Wave (Dev)"` | `"PRODUCT_NAME"` / `"PRODUCT_NAME (Dev)"` |
| `emain/emain-platform.ts` | Env var: `WAVETERM_CONFIG_HOME` | — | `APP_SLUG_CONFIG_HOME` |
| `emain/emain-platform.ts` | Env var: `WAVETERM_DATA_HOME` | — | `APP_SLUG_DATA_HOME` |
| `emain/emain-platform.ts` | Env var: `WAVETERM_HOME` | — | `APP_SLUG_HOME` |
| `Taskfile.yml` | Dev data paths | `waveterm-dev` | `APP_SLUG-dev` |

**Resulting directory layout (example, Windows):**
- Production: `%LOCALAPPDATA%\APP_SLUG\`
- Dev: `%LOCALAPPDATA%\APP_SLUG-dev\`

### 3.3 Binary Names

| File | What | Current | New |
|------|------|---------|-----|
| `Taskfile.yml` | Server binary | `wavesrv.*.exe` | `APP_SLUGsrv.*.exe` or keep as-is |
| `Taskfile.yml` | CLI tool | `wsh-*` | Decide: rename or keep `wsh` |
| `build/deb-postinstall.tpl` | Linux symlink | `/usr/bin/waveterm` | `/usr/bin/APP_SLUG` |
| `emain/emain.ts` | Startup log | `"waveterm-app starting"` | `"APP_SLUG-app starting"` |

### 3.4 Icons & Logo Assets

All files below need replacement with new artwork.

**App icons (used by installers, taskbar, dock):**
- `build/icon.ico` (Windows)
- `build/icon.icns` (macOS)
- `assets/waveterm-logo-with-bg.ico`
- `assets/waveterm-logo-with-bg.svg`

**UI logos (rendered in the app):**
- `frontend/app/asset/logo.svg` (About modal, onboarding)
- `assets/wave-logo_icon-outline-duotone.svg`
- `assets/wave-logo_icon-outline.svg`
- `assets/wave-logo_icon-solid.svg`
- `assets/waveterm-logo-horizontal-dark.png`
- `assets/waveterm-logo-horizontal-light.png`
- `assets/wave-dark.png`
- `assets/wave-light.png`

**Documentation site logos:**
- `docs/static/img/logo/wave-logo_appicon.svg`
- `docs/static/img/logo/wave-logo_horizontal-coloronblack.svg`
- `docs/static/img/logo/wave-logo_horizontal-coloronwhite.svg`
- `docs/static/img/logo/wave-dark.png`
- `docs/static/img/logo/wave-light.png`

### 3.5 UI Display Strings

| File | What | Current |
|------|------|---------|
| `frontend/app/modals/about.tsx` | Title | `"Wave Terminal"` |
| `frontend/app/modals/about.tsx` | Tagline | `"Open-Source AI-Native Terminal..."` |
| `frontend/app/modals/about.tsx` | Copyright | `"Command Line Inc."` |
| `frontend/app/onboarding/onboarding.tsx` | Welcome | `"Welcome to Wave Terminal"` |
| `frontend/app/onboarding/fakechat.tsx` | Demo text | References `~/waveterm` |

### 3.6 URL References

**Cloud/API endpoints (Taskfile.yml, .env):**
- `ping-dev.waveterm.dev` → remove or replace
- `api-dev.waveterm.dev` → remove or replace
- `wsapi-dev.waveterm.dev` → remove or replace
- `dl.waveterm.dev` → remove or replace

**Documentation links (12+ frontend files):**
These all point to `docs.waveterm.dev`. Decision needed: host fork docs, or point to upstream docs, or remove links.

Files containing doc URLs:
- `frontend/app/aipanel/byokannouncement.tsx`
- `frontend/app/block/durable-session-flyover.tsx`
- `frontend/app/element/quicktips.tsx`
- `frontend/app/modals/about.tsx`
- `frontend/app/view/helpview/helpview.tsx`
- `frontend/app/view/waveconfig/aipresets-content.tsx`
- `frontend/app/view/waveconfig/waveconfig-model.ts`
- `frontend/app/onboarding/onboarding.tsx`

**GitHub references:**
- `frontend/app/modals/about.tsx`: `github.com/wavetermdev/waveterm` → `github.com/sgeraldes/APP_SLUG`
- `frontend/app/onboarding/onboarding.tsx`: same

### 3.7 Go Module Path

| File | Current | New |
|------|---------|-----|
| `go.mod` | `github.com/wavetermdev/waveterm` | `github.com/sgeraldes/APP_SLUG` |
| All `pkg/**/*.go` | Import prefix `github.com/wavetermdev/waveterm/` | New prefix |
| All `cmd/**/*.go` | Import prefix `github.com/wavetermdev/waveterm/` | New prefix |

This is a mechanical find-and-replace across 100+ Go files. No logic changes.

### 3.8 Documentation Site

| File | Field | Current | New |
|------|-------|---------|-----|
| `docs/docusaurus.config.ts` | `title` | `"Wave Terminal Documentation"` | `"PRODUCT_NAME Documentation"` |
| `docs/docusaurus.config.ts` | `url` | `"https://docs.waveterm.dev/"` | Fork URL |
| `docs/docusaurus.config.ts` | `organizationName` | `"wavetermdev"` | `"sgeraldes"` |
| `docs/docusaurus.config.ts` | `projectName` | `"waveterm-docs"` | `"APP_SLUG-docs"` |
| `docs/docusaurus.config.ts` | Analytics domain | `"docs.waveterm.dev"` | Remove or replace |

### 3.9 Installer Configuration

| Artifact | Current Name Pattern | New |
|----------|---------------------|-----|
| NSIS installer | `Wave-win32-x64-VERSION.exe` | `PRODUCT_NAME-win32-x64-VERSION.exe` |
| MSI installer | `Wave-win32-x64-VERSION.msi` | Same pattern |
| Linux .deb/.rpm | Based on `package.json` name | Uses `APP_SLUG` |
| macOS .dmg | Based on `productName` | Uses `PRODUCT_NAME` |
| Install path (Win) | `%LOCALAPPDATA%\Programs\waveterm\` | `%LOCALAPPDATA%\Programs\APP_SLUG\` |

## 4. Dependency Order

```
Phase 1 (coexistence — must happen together):
  ├── 3.1 App identity (package.json, appId, productName)
  ├── 3.2 Data directories (envPaths prefix, env vars)
  └── 3.9 Installer configuration

Phase 2 (cosmetic — independent of each other):
  ├── 3.4 Icons & logos (needs design work)
  ├── 3.5 UI display strings
  └── 3.8 Documentation site

Phase 3 (cleanup — can be done anytime):
  ├── 3.3 Binary names
  ├── 3.6 URL references
  └── 3.7 Go module path
```

## 5. Acceptance Criteria

- [ ] Both apps can be installed on the same Windows machine simultaneously
- [ ] Both apps use separate data directories (no shared config/state)
- [ ] The fork shows its own name and icon in taskbar, title bar, and About dialog
- [ ] The fork's installer creates its own Start Menu entry
- [ ] `task dev` and `task package` produce correctly named artifacts
- [ ] All env vars use the new prefix
- [ ] No "Wave Terminal" text appears in the fork's UI (except attribution in About, if desired)
- [ ] Build passes: `go build ./...`, `npx tsc --noEmit`, `npm test`
