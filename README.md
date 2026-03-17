<p align="center">
  <a href="https://github.com/sgeraldes/waveterm">
	<picture>
		<source media="(prefers-color-scheme: dark)" srcset="./assets/wave-dark.png">
		<source media="(prefers-color-scheme: light)" srcset="./assets/wave-light.png">
		<img alt="Wave Terminal Logo" src="./assets/wave-light.png" width="240">
	</picture>
  </a>
  <br/>
</p>

<h1 align="center">Wave Terminal — Experimental Fork</h1>

<p align="center">
  An opinionated fork of <a href="https://github.com/wavetermdev/waveterm">Wave Terminal</a> with project-centric workflows, better terminal rendering, and zero telemetry.<br/>
  <strong>macOS · Linux · Windows · WSL</strong>
</p>

<p align="center">
  <a href="https://github.com/sgeraldes/waveterm/releases">Releases</a> ·
  <a href="#whats-different">What's Different</a> ·
  <a href="#features">Features</a> ·
  <a href="#building-from-source">Build</a>
</p>

---

## What's Different

This fork takes Wave Terminal and pushes it toward a **project-centric, privacy-respecting** developer experience. The main changes:

- **Tabs are project-aware** — each tab knows its working directory, colors itself accordingly, and passes context to every block inside it.
- **Terminal rendering is fixed** — xterm.js 6.1.0 with Synchronized Output means htop, npm progress bars, and TUI spinners actually work.
- **No telemetry, period** — all telemetry collection is removed. Wave AI works without it.
- **WSL is a first-class citizen** — WSL distributions appear as local shell profiles, not remote connections.
- **Visual settings** — a VS Code-style settings panel instead of editing JSON by hand.
- **Maximize mode** — expand any block to full screen with a keyboard shortcut, navigate between maximized blocks with a chip bar.

274 commits ahead of upstream. Based on Wave Terminal v0.14.x with upstream's durable sessions merged.

![WaveTerm Screenshot](./assets/wave-screenshot.webp)

---

## Features

### Project-Centric Tabs

Every tab can be bound to a project directory. All terminals and widgets in that tab inherit the context.

- **Colored tab backgrounds** based on directory — instantly see which project you're in
- **Breadcrumb navigation** below the tab bar for quick path traversal
- **Smart auto-detection** — OSC 7 integration picks up the working directory from your first terminal
- **Directory locking** — pin a tab's directory so it doesn't change when you `cd`
- **Tab presets** — save and restore tab configurations (`tabvar@my-project`)
- **Color picker** — 8-color palette for manual tab coloring via right-click

### Maximize Mode

Expand any block to fill the entire workspace. Useful for deep terminal work or reading long files.

- **One-click maximize** from the block header, or use keyboard shortcuts
- **Chip bar** along the top to switch between all blocks while maximized
- **Instant toggle** back to tiled layout — your arrangement is preserved

### Block Editor

A Notion-style rich text editor block for notes and documentation right inside your terminal workspace.

- **Rich text editing** with headings, lists, code blocks, and inline formatting
- **Image paste** — paste screenshots directly from clipboard
- **Markdown preview** — editor, split, and preview modes
- **Live preview** — see rendered markdown as you type

### Theme System

Two-dimensional theming: **Mode** (Dark / Light / System) and **Accent** (Green / Warm / Blue / Purple / Teal).

- **Accent selector** with live palette preview
- **Custom accents** — create your own color schemes with a visual editor
- **Theme overrides** — fine-tune individual CSS variables
- **Consistent theming** across AI panel, settings, terminal, and all widgets

### Shell Profiles & WSL

Shells and connections are separated. Local shells (including WSL) get their own profile system.

- **Shell selector** in the terminal header — switch between bash, zsh, fish, PowerShell, WSL distros
- **WSL as local shells** — WSL distributions discovered via `wsl.exe -l`, launched natively
- **PowerShell profile loading** — your `$PROFILE` aliases and prompt work out of the box
- **Per-profile settings** — different shell, different font, different theme

### Visual Settings

A VS Code-style settings panel for people who don't want to edit JSON.

- **Category sidebar** with scroll-spy synchronization
- **Search** across all settings by name, description, or key
- **Rich controls** — toggles, sliders, dropdowns, color pickers, font selectors
- **Modified indicators** — see which settings differ from defaults
- **Dual view** — switch between visual mode and raw JSON anytime
- **Real-time sync** — changes persist immediately with debounced saves

### Terminal Upgrades

- **xterm.js 6.1.0** — DEC mode 2026 (Synchronized Output) for proper TUI rendering
- **Font ligatures** — enable with `"term:ligatures": true` for Fira Code, JetBrains Mono, etc.
- **Focus reporting control** — disable DEC mode 1004 if it conflicts with your tools
- **Terminal status indicators** — visual feedback for running, finished, and stopped commands

### Built-in Widgets

Extra widget types beyond what upstream offers:

| Widget        | Description                                                          |
| ------------- | -------------------------------------------------------------------- |
| **Tree View** | File tree with search, context menu, and auto-refresh                |
| **Notes**     | Markdown notes with live preview and image paste                     |
| **Todo**      | Inline-editable task lists with drag reordering and markdown support |

### Oh-My-Posh Configurator

A visual editor for Oh-My-Posh themes, directly inside the Appearance settings.

- Discovers your OMP config files automatically
- Renders block and segment previews
- Edit properties, colors, and segment order visually
- High contrast mode analysis for readability

### Privacy

- **All telemetry removed** — no usage data, no analytics, no cloud pings
- **Wave AI works without telemetry** — cloud AI modes don't gate on telemetry opt-in
- **S3 and WaveFile transfers removed** — no cloud file sync
- **Simplified onboarding** — no telemetry toggle in setup

### Backend Security

Comprehensive metadata validation added on top of upstream:

- Path traversal prevention on all path fields
- URL validation with scheme restrictions
- Optimistic locking for concurrent metadata updates
- TOCTOU race condition fixes in OSC 7 updates

---

## Everything from Wave Terminal

This fork includes all upstream Wave Terminal features:

- Drag & drop tiled layout for terminals, editors, web browsers, and AI assistants
- Built-in Monaco editor for local and remote files
- Rich file previews — markdown, images, video, PDFs, CSVs, directories
- Wave AI with terminal context, file operations, and multi-provider support (OpenAI, Claude, Azure, Ollama, etc.)
- Command Blocks for isolating individual commands
- One-click SSH remote connections with full filesystem access
- Secure secret storage using native system backends
- `wsh` CLI for workspace automation and cross-session data sharing

---

## Installation

### From Releases

Download the latest build from [GitHub Releases](https://github.com/sgeraldes/waveterm/releases).

| Platform      | File                        |
| ------------- | --------------------------- |
| macOS (arm64) | `.dmg`                      |
| macOS (x64)   | `.dmg`                      |
| Windows (x64) | `.exe` installer            |
| Linux (x64)   | `.deb`, `.rpm`, `.AppImage` |
| Linux (arm64) | `.deb`, `.rpm`, `.AppImage` |

### Minimum Requirements

- macOS 11 or later (arm64, x64)
- Windows 10 1809 or later (x64)
- Linux with glibc 2.28+ (Debian 10, RHEL 8, Ubuntu 20.04, etc.)

---

## Building from Source

Requires **Node.js 22+**, **Go 1.24+**, and [Task](https://taskfile.dev/) (modern Make alternative).

```bash
# Clone and install dependencies
git clone https://github.com/sgeraldes/waveterm.git
cd waveterm
task init

# Development with hot reload
task dev

# Production build
task package
```

**Windows note:** Requires PowerShell 7+ (`pwsh`) and Zig for CGO static linking. See [BUILD.md](BUILD.md) for full details.

---

## Relationship with Upstream

This fork is periodically synced with [wavetermdev/waveterm](https://github.com/wavetermdev/waveterm). Upstream's push remote is disabled to prevent accidental pushes.

```
origin    https://github.com/sgeraldes/waveterm.git
upstream  https://github.com/wavetermdev/waveterm.git (fetch only)
```

For the official Wave Terminal experience, visit the [upstream repository](https://github.com/wavetermdev/waveterm).

---

## License

Wave Terminal is licensed under the [Apache-2.0 License](LICENSE). For dependency information, see [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md).
