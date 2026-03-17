# v0.15.0

The first public release of the experimental fork. This rolls up everything built on top of upstream Wave Terminal v0.14.x — 274 commits, 776 files changed, covering new features, terminal fixes, security hardening, and a complete telemetry removal.

---

## Highlights

- **Maximize Mode** — Expand any block to fill the workspace. A scrollable chip bar lets you switch between blocks without leaving maximized view. Toggle back to tiled layout instantly.
- **Block Editor** — A Notion-style rich text block with image paste, live markdown preview, and editor/split/preview modes.
- **WSL as Local Shells** — WSL distributions are discovered automatically and treated as local shell profiles, not remote connections.
- **100+ Bug Fixes** — Comprehensive audit covering breadcrumb navigation, smart folders, tab color coding, accessibility, and security hotspots.
- **Linux WSLg Fix** — Removed native title bar on WSLg environments using `frame:false` with Wayland window decorations.

---

## New Features

### Maximize Mode

- Maximize button in block header and keyboard shortcuts
- `MaximizeTabBar` component with scrollable block chips
- TileLayout integration — tiled arrangement preserved when toggling
- Optimized layout performance to prevent animation jank

### Block Editor (Notion-Style)

- Rich text editing with headings, lists, code blocks, inline formatting
- Image paste from clipboard with auto-generated filenames
- Three modes: editor, split, and preview
- Live markdown rendering

### WSL Local Shell Profiles

- WSL distributions discovered via `wsl.exe -l` and appear in shell selector
- Launched natively with `wsl.exe -d <distro>` — no SSH overhead
- UNC path validation (`\\wsl.localhost\<distro>\path`)
- Case-insensitive profile matching

### Built-in Widgets

- **Tree View** — file tree with search, context menu, auto-refresh, and right-click context actions
- **Notes** — markdown notes with live preview, image paste, scrollbar, and word wrap
- **Todo** — task lists with inline editing, drag reordering, and markdown rendering

### Session History (Experimental)

- Terminal session capture and storage backend
- Read-only terminal history viewer block
- Cleanup scheduler with startup integration

### Additional Features

- Tab management panel for organizing tabs
- Tab paging and mouse forward/back navigation
- Webview mouse button navigation (back/forward)
- Auto-updater switched to GitHub Releases provider
- Hookify safety rule to prevent accidental process termination

---

## Improvements

### Terminal

- Notes image paste now uses DOM paste event correctly
- Widget improvements: notes scrollbar/word wrap, todo inline edit/drag, treeview search
- Treeview context menu with full path display

### Theme System

- Consistent theming across AI panel, settings, terminal, and all widgets
- Replaced hardcoded Tailwind colors with theme variables in AI panel
- Improved SCSS theme consistency across settings components

### Shell Profiles

- Fixed settings save failure and improved WSL handling
- Improved connection handling and shell path validation
- Replaced `wave-init` with lightweight `wave-activate` for faster tab switches
- Fixed shell detection icons, IDs, and UX issues

### Oh-My-Posh

- Improved theme configurator preview and editing UX
- Extracted `getSegmentIconClass` to shared utils

### Settings

- Disabled DEC mode 1004 focus reporting by default (prevents conflicts with some tools)
- Removed local shells from Connections panel (they're in Shell Profiles now)
- Added object type support to settings metadata types

---

## Bug Fixes

### Comprehensive Audit (94+ bugs)

- **Phases A–D**: Systematic audit covering layout, state management, rendering, and edge cases
- **Phase E**: 5 additional bugs found during test coverage expansion
- **Breadcrumb/Smart Folder**: BC-001 through BC-012, SF-001 through SF-010
- **Deferred bugs**: BC-003, BC-006, BC-007, BC-010, BC-012, SF-005 through SF-009

### Maximize Mode Fixes

- Pinned close button outside scrollable chips
- Fixed test mock and removed duplicate key registrations
- Optimized layout performance and prevented test timeouts

### Tab & UI Fixes

- Fixed tab color coding status desync, redundant RPC writes, and light theme contrast
- Fixed window drag from breadcrumb bar
- Reverted bad RPC retry logic
- Fixed WSL `--cd` argument handling
- Fixed session button styling

### Security

- Resolved all npm audit vulnerabilities
- Resolved SonarCloud security hotspots, promise/void bugs, and accessibility issues
- Fixed React anti-patterns, UTF-8 decode, channel race, Monaco keycode issues
- Crypto RNG for security-sensitive random generation

### Accessibility

- Added keyboard accessibility to shell selector menu items
- Tab-groups-section accessibility improvements
- Addressed all CodeRabbit automated review findings

### Platform-Specific

- **Linux**: Removed native title bar on WSLg using `frame:false` and `WaylandWindowDecorations`
- **Windows**: Fixed WSL shell profile case normalization
- **All**: Aligned react-dom version with react to fix app startup

---

## Upstream Changes Incorporated

Merged from [wavetermdev/waveterm](https://github.com/wavetermdev/waveterm) main branch:

- **Durable Terminal Sessions** — sessions persist across restarts
- **Tab Indicators and Confirm on Quit** — upstream's tab indicator system
- **RPC Streaming Primitives** — new streaming infrastructure with stress tests
- **Icon Flyover and Session Bug Fixes** — various stability improvements
- **OpenAI Responses API** — configurable verbosity for OpenAI
- **File Transfer Limits** — 32MB cap, S3/WaveFile removal
- Dependency bumps: `google.golang.org/api`, `golang-jwt`, `node-abi`, and others

---

## Cleanup

- Removed dead WaveApp/Tsunami builder code from AI chat
- Removed obsolete SCSS mixed-decls deprecation silencing
- Reorganized spec files and added WSL dev setup documentation
- Added architecture lessons from breadcrumb/smart folder audit

---

## Technical Details

- **274 commits** ahead of upstream
- **776 files changed** — 97,167 insertions, 53,987 deletions
- Based on upstream commit `200863bb` (2026-02-24)
- Previous release: v0.14.4

---

## Installation

Download from [GitHub Releases](https://github.com/sgeraldes/waveterm/releases/tag/v0.15.0).

| Platform           | File                        |
| ------------------ | --------------------------- |
| macOS (arm64, x64) | `.dmg`                      |
| Windows (x64)      | `.exe` installer            |
| Linux (x64, arm64) | `.deb`, `.rpm`, `.AppImage` |

Or build from source:

```bash
git clone https://github.com/sgeraldes/waveterm.git
cd waveterm
task init && task package
```
