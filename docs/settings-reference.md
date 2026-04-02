# Wave Terminal Settings Reference

This document describes every configurable setting in Wave Terminal. Settings are stored in `~/.waveterm/config/settings.json` and can also be changed through the Settings panel in the application.

---

## Terminal

Terminal appearance and behavior settings.

### Appearance

#### Font Size

| Property | Value |
|---|---|
| **Key** | `term:fontsize` |
| **Type** | number |
| **Default** | `12` |
| **Range** | 8 - 24 (step 1) |
| **Requires Restart** | No |

The font size for terminal text, measured in pixels. Increase this if you find the default text too small, or decrease it to fit more content on screen. This only affects terminal blocks, not the editor or AI panels.

---

#### Font Family

| Property | Value |
|---|---|
| **Key** | `term:fontfamily` |
| **Type** | string |
| **Default** | `""` (system default monospace font) |
| **Requires Restart** | No |

The font family used for terminal text. This should be a monospace font for proper character alignment. Leave empty to use the system default monospace font. Examples: `"JetBrains Mono"`, `"Fira Code"`, `"Cascadia Code"`, `"Consolas"`.

---

#### Color Scheme

| Property | Value |
|---|---|
| **Key** | `term:theme` |
| **Type** | string |
| **Default** | `""` (built-in default) |
| **Requires Restart** | No |

The color scheme (theme) applied to the terminal. This controls the palette used for ANSI colors, background, foreground, cursor, and selection colors. Choose a theme that provides good contrast for your preferred background. Leave empty to use the built-in default color scheme. Custom themes can be added as JSON files in your Wave config directory.

---

#### Transparency

| Property | Value |
|---|---|
| **Key** | `term:transparency` |
| **Type** | number |
| **Default** | `0` |
| **Range** | 0 - 1 (step 0.1) |
| **Requires Restart** | No |

Terminal background transparency level. A value of `0` means fully opaque, and `1` means fully transparent. For this setting to have any visible effect, you must also enable `window:transparent` (Transparent Window). Without window-level transparency enabled, this setting does nothing.

---

#### Font Ligatures

| Property | Value |
|---|---|
| **Key** | `term:ligatures` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Enable font ligatures in the terminal for supported fonts. Ligatures combine multi-character sequences into single glyphs (for example, `=>` becomes an arrow, `!=` becomes a not-equal sign). This only works with ligature-capable fonts such as Fira Code, JetBrains Mono, or Cascadia Code. You must set `term:fontfamily` to a ligature-enabled font for this to have any effect.

| Value | Meaning |
|---|---|
| `true` | Ligatures are rendered when the font supports them |
| `false` | Ligatures are disabled; all characters render individually |

---

### Behavior

#### Scrollback Lines

| Property | Value |
|---|---|
| **Key** | `term:scrollback` |
| **Type** | number |
| **Default** | `1000` |
| **Range** | 100 - 100,000 |
| **Requires Restart** | No |

The number of lines retained in the terminal scrollback buffer. Higher values let you scroll back further through command output history but consume more memory. If you frequently run commands with large output, consider increasing this. For constrained environments, lower values reduce memory usage.

---

#### Copy on Select

| Property | Value |
|---|---|
| **Key** | `term:copyonselect` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

When enabled, selecting text in the terminal automatically copies it to the system clipboard without needing to press Ctrl+C (or Cmd+C). This is a common behavior in Linux terminals. Disable this if you prefer explicit copy actions.

| Value | Meaning |
|---|---|
| `true` | Selected text is automatically copied to the clipboard |
| `false` | You must explicitly copy selected text |

---

#### Bracketed Paste

| Property | Value |
|---|---|
| **Key** | `term:allowbracketedpaste` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Enable bracketed paste mode for compatible shells. When enabled, pasted text is wrapped in escape sequences that tell the shell it was pasted rather than typed. This prevents the shell from executing pasted commands line by line and allows editors like vim and programs like fzf to handle pastes correctly. Only disable this if you experience issues with pasting in specific programs.

| Value | Meaning |
|---|---|
| `true` | Pasted text is wrapped in bracketed paste escape sequences |
| `false` | Text is pasted as if it were typed character by character |

---

#### Shift+Enter for Newline

| Property | Value |
|---|---|
| **Key** | `term:shiftenternewline` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

When enabled, pressing Shift+Enter inserts a literal newline character instead of executing the command. This can be useful for writing multi-line commands or heredocs. When disabled, Shift+Enter behaves the same as Enter.

| Value | Meaning |
|---|---|
| `true` | Shift+Enter inserts a newline |
| `false` | Shift+Enter acts as a regular Enter (executes the command) |

---

#### Option Key as Meta (macOS)

| Property | Value |
|---|---|
| **Key** | `term:macoptionismeta` |
| **Type** | boolean |
| **Default** | `false` |
| **Platform** | macOS only |
| **Requires Restart** | No |

Use the Option key as the Meta key in the terminal. This is needed for programs like emacs that rely on Meta key bindings. When enabled, Option+key sends the Meta (ESC) prefix instead of inserting special characters. Disable this if you need Option for typing accented characters or special symbols.

| Value | Meaning |
|---|---|
| `true` | Option key sends Meta (ESC prefix) |
| `false` | Option key inserts special characters (default macOS behavior) |

---

#### Clickable File Paths

| Property | Value |
|---|---|
| **Key** | `term:filelinks` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Detect and underline file paths in terminal output, making them clickable. Clicking a detected file path opens it in the Wave file preview. Ctrl+clicking (Cmd+click on macOS) opens it in your configured external editor. Disable this if path detection interferes with your terminal output or if you find the underlines distracting.

| Value | Meaning |
|---|---|
| `true` | File paths are detected, underlined, and clickable |
| `false` | File paths are rendered as plain text |

---

#### External Editor

| Property | Value |
|---|---|
| **Key** | `term:externaleditor` |
| **Type** | string |
| **Default** | `""` (use OS default handler) |
| **Requires Restart** | No |

The executable path or command for the external editor opened when you Ctrl+click (Cmd+click on macOS) a file link in the terminal. Leave empty to use your operating system's default file handler. Examples: `code` (VS Code), `notepad++`, `vim`, `subl` (Sublime Text).

---

### Shell

#### Local Shell Path

| Property | Value |
|---|---|
| **Key** | `term:localshellpath` |
| **Type** | string |
| **Default** | `""` (system default shell) |
| **Requires Restart** | No |

Path to the shell executable to use for local terminal sessions. Leave empty to use the system default shell (typically `$SHELL` on macOS/Linux or PowerShell on Windows). Examples: `/bin/zsh`, `/usr/bin/fish`, `C:\Program Files\PowerShell\7\pwsh.exe`.

---

#### Local Shell Options

| Property | Value |
|---|---|
| **Key** | `term:localshellopts` |
| **Type** | string[] (array of strings) |
| **Default** | `[]` |
| **Requires Restart** | No |

Command-line arguments passed to the local shell when it starts. For example, you might pass `["--login"]` to start a login shell, or `["-c", "tmux"]` to launch tmux automatically. Leave empty for default shell behavior.

---

#### Git Bash Path (Windows)

| Property | Value |
|---|---|
| **Key** | `term:gitbashpath` |
| **Type** | string |
| **Default** | `""` (auto-detect) |
| **Platform** | Windows only |
| **Requires Restart** | No |

Path to the Git Bash executable on Windows. Wave Terminal can auto-detect the default Git Bash installation location. Only set this if Git Bash is installed in a non-standard location. Example: `C:\Program Files\Git\bin\bash.exe`.

---

### Performance

#### Disable WebGL

| Property | Value |
|---|---|
| **Key** | `term:disablewebgl` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | Yes |

Disable WebGL-based rendering for the terminal. The terminal normally uses WebGL for hardware-accelerated rendering, which is faster. If you experience visual glitches, blank terminals, or GPU-related crashes, enabling this falls back to a canvas-based renderer. See also `window:disablehardwareacceleration` for application-wide GPU settings.

| Value | Meaning |
|---|---|
| `true` | Terminal uses slower but more compatible canvas rendering |
| `false` | Terminal uses fast WebGL rendering (recommended) |

---

### Advanced

#### Report Focus Events

| Property | Value |
|---|---|
| **Key** | `term:reportfocus` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Enable DEC mode 1004 focus reporting. When enabled, the terminal sends escape sequences to running programs when it gains or loses focus, allowing applications to react to focus changes. Some applications (notably Claude Code) may exhibit UI corruption when this is enabled. Only enable this if you need focus tracking for specific applications like vim or tmux.

| Value | Meaning |
|---|---|
| `true` | Applications receive focus/unfocus escape sequences |
| `false` | Focus changes are not reported to applications |

---

### Prompt Compatibility

#### Oh-My-Posh Theme

| Property | Value |
|---|---|
| **Key** | `term:omptheme` |
| **Type** | string |
| **Default** | `""` |
| **Requires Restart** | No |

Browse and select an Oh-My-Posh theme for your terminal prompt. After selecting a theme here, you need to configure Oh-My-Posh in your shell profile to use the selected theme file. This setting provides a visual theme browser within Wave; it does not automatically apply the theme.

---

#### Oh-My-Posh Palette Export

| Property | Value |
|---|---|
| **Key** | `term:ompexport` |
| **Type** | string |
| **Default** | `null` |
| **Requires Restart** | No |

Export your current terminal Color Scheme as an Oh-My-Posh palette configuration. This generates a palette block you can copy and paste into your OMP config file so that your prompt colors match your terminal theme. This is a utility setting that produces output rather than storing a persistent value.

---

#### Prompt Compatibility Help

| Property | Value |
|---|---|
| **Key** | `term:promptcompat` |
| **Type** | string |
| **Default** | `null` |
| **Requires Restart** | No |

A help panel that explains how to configure custom prompt frameworks (Oh-My-Posh, Starship, Powerlevel10k) to work with Wave Terminal's theming system. This is an informational panel, not a stored setting.

---

## Editor

Code editor settings for the built-in file editor.

### Appearance

#### Font Size

| Property | Value |
|---|---|
| **Key** | `editor:fontsize` |
| **Type** | number |
| **Default** | `12` |
| **Range** | 8 - 24 (step 1) |
| **Requires Restart** | No |

The font size for text in the built-in code editor, measured in pixels. This is independent of the terminal font size and AI panel font size.

---

#### Show Minimap

| Property | Value |
|---|---|
| **Key** | `editor:minimapenabled` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Display a minimap (a zoomed-out overview of the file) on the right side of the editor. The minimap helps with navigation in large files. Disable it to reclaim horizontal space.

| Value | Meaning |
|---|---|
| `true` | Minimap is visible on the right side |
| `false` | Minimap is hidden |

---

### Behavior

#### Sticky Scroll

| Property | Value |
|---|---|
| **Key** | `editor:stickyscrollenabled` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Keep the current scope (function, class, block) pinned at the top of the editor as you scroll down through a file. This helps maintain context when reading long functions or deeply nested code.

| Value | Meaning |
|---|---|
| `true` | Current scope headers stick to the top while scrolling |
| `false` | Normal scrolling behavior |

---

#### Word Wrap

| Property | Value |
|---|---|
| **Key** | `editor:wordwrap` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Wrap long lines to fit within the editor's visible width. When disabled, long lines extend beyond the viewport and require horizontal scrolling. Enable this for prose-heavy files like Markdown or log files.

| Value | Meaning |
|---|---|
| `true` | Long lines wrap to the next visual line |
| `false` | Long lines require horizontal scrolling |

---

#### Inline Diff

| Property | Value |
|---|---|
| **Key** | `editor:inlinediff` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Show inline diff view for AI-generated code changes. When the AI assistant suggests code modifications, this setting controls whether the diff is displayed inline within the editor rather than in a separate view.

| Value | Meaning |
|---|---|
| `true` | AI code changes are shown as inline diffs |
| `false` | Default diff presentation |

---

## Window

Window appearance, layout, and behavior settings.

### Appearance

#### Transparent Window

| Property | Value |
|---|---|
| **Key** | `window:transparent` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | Yes |

Enable window transparency for the entire application window. This is a prerequisite for terminal transparency (`term:transparency`). Without this enabled, the terminal transparency slider has no visible effect. Transparency support depends on your operating system and compositor.

| Value | Meaning |
|---|---|
| `true` | Window supports transparency effects |
| `false` | Window is fully opaque |

---

#### Background Blur

| Property | Value |
|---|---|
| **Key** | `window:blur` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Apply a blur effect to the transparent window background. This creates a frosted-glass appearance where the content behind the window is blurred rather than being clearly visible. Requires `window:transparent` to be enabled.

| Value | Meaning |
|---|---|
| `true` | Background behind the window is blurred |
| `false` | Background is either opaque or transparent without blur |

---

#### Window Opacity

| Property | Value |
|---|---|
| **Key** | `window:opacity` |
| **Type** | number |
| **Default** | `1` |
| **Range** | 0.1 - 1.0 (step 0.05) |
| **Requires Restart** | No |

The overall opacity of the application window when transparency is enabled. A value of `1` is fully opaque, and `0.1` is nearly invisible. Requires `window:transparent` to be enabled. This affects the entire window, including UI chrome, not just the terminal area.

---

#### Background Color

| Property | Value |
|---|---|
| **Key** | `window:bgcolor` |
| **Type** | string |
| **Default** | `""` (use theme default) |
| **Requires Restart** | No |

A custom background color for the window, specified as a CSS color value (e.g., `#1e1e2e`, `rgb(30, 30, 46)`, `rgba(0,0,0,0.5)`). Leave empty to use the color defined by the current theme. Useful for matching a specific desktop aesthetic or for use with transparency.

---

#### Show Menu Bar (Linux)

| Property | Value |
|---|---|
| **Key** | `window:showmenubar` |
| **Type** | boolean |
| **Default** | `false` |
| **Platform** | Linux only |
| **Requires Restart** | No |

Display the application menu bar on Linux. On macOS the menu bar is always in the system menu bar. On Windows the menu bar is integrated into the title bar. On Linux, this controls whether a traditional menu bar is shown at the top of the window.

| Value | Meaning |
|---|---|
| `true` | Menu bar is visible |
| `false` | Menu bar is hidden (use keyboard shortcuts or right-click menus) |

---

#### Native Title Bar

| Property | Value |
|---|---|
| **Key** | `window:nativetitlebar` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | Yes |

Use the operating system's native title bar instead of Wave Terminal's custom title bar. The native title bar integrates better with your OS window management (snap, tile, etc.) but lacks Wave-specific controls. The custom title bar provides a more integrated look.

| Value | Meaning |
|---|---|
| `true` | Use OS native title bar |
| `false` | Use Wave's custom title bar |

---

#### Interface Zoom

| Property | Value |
|---|---|
| **Key** | `window:zoom` |
| **Type** | number |
| **Default** | `1` |
| **Range** | 0.5 - 2.0 (step 0.1) |
| **Requires Restart** | No |

Zoom level for the entire application interface. A value of `1` is 100% (normal size). Values below 1 shrink the interface, and values above 1 enlarge it. This affects all UI elements including menus, tabs, and panels, not just terminal or editor text.

---

### Layout

#### Tile Gap Size

| Property | Value |
|---|---|
| **Key** | `window:tilegapsize` |
| **Type** | number |
| **Default** | `3` |
| **Range** | 0 - 20 |
| **Requires Restart** | No |

The gap between tiled blocks (panes) in pixels. Set to `0` for no gap between blocks, or increase for more visual separation. This is a cosmetic preference that does not affect block content.

---

#### Default Dimensions

| Property | Value |
|---|---|
| **Key** | `window:dimensions` |
| **Type** | string |
| **Default** | `""` (system default) |
| **Format** | `WIDTHxHEIGHT` (e.g., `1200x800`) |
| **Requires Restart** | No |

Default window dimensions for new windows, specified as `WIDTHxHEIGHT` in pixels (e.g., `1200x800`, `1920x1080`). Leave empty to use the system default or the last saved window size. This only affects new windows when `window:savelastwindow` is disabled.

---

### Behavior

#### Fullscreen on Launch

| Property | Value |
|---|---|
| **Key** | `window:fullscreenonlaunch` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Start the application in fullscreen mode every time it launches. Useful if you always want Wave Terminal to take up the entire screen.

| Value | Meaning |
|---|---|
| `true` | Application launches in fullscreen |
| `false` | Application launches in a normal window |

---

#### Confirm Close

| Property | Value |
|---|---|
| **Key** | `window:confirmclose` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Show a confirmation dialog before closing the application window. This helps prevent accidentally closing Wave Terminal when you have active terminal sessions or unsaved work.

| Value | Meaning |
|---|---|
| `true` | A confirmation prompt appears before the window closes |
| `false` | The window closes immediately without confirmation |

---

#### Save Last Window

| Property | Value |
|---|---|
| **Key** | `window:savelastwindow` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Remember and restore the last window position and size when the application is reopened. Disable this if you want Wave Terminal to always open with default or specified dimensions.

| Value | Meaning |
|---|---|
| `true` | Window position and size are saved and restored on next launch |
| `false` | Window opens with default dimensions each time |

---

#### Reduced Motion

| Property | Value |
|---|---|
| **Key** | `window:reducedmotion` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Minimize animations throughout the application. Enable this if you prefer a less animated interface or if animations cause discomfort. This is an accessibility setting.

| Value | Meaning |
|---|---|
| `true` | Most animations are disabled or reduced |
| `false` | Normal animation behavior |

---

#### Confirm Tab Close

| Property | Value |
|---|---|
| **Key** | `tab:confirmclose` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Show a confirmation dialog before closing a tab. This protects against accidental tab closure from middle-clicking, the close button, or keyboard shortcuts.

| Value | Meaning |
|---|---|
| `true` | A confirmation prompt appears before a tab is closed |
| `false` | Tabs close immediately without confirmation |

---

#### Confirm Terminal Close

| Property | Value |
|---|---|
| **Key** | `block:confirmclose` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Show a confirmation dialog before closing a terminal block, even when no process is running. Terminal blocks that have a running process always prompt for confirmation regardless of this setting.

| Value | Meaning |
|---|---|
| `true` | All terminal blocks prompt before closing |
| `false` | Only terminal blocks with running processes prompt |

---

### Performance

#### Disable Hardware Acceleration

| Property | Value |
|---|---|
| **Key** | `window:disablehardwareacceleration` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | Yes |

Disable GPU hardware acceleration for the entire application. This forces software rendering, which is slower but can resolve graphical glitches, crashes, or high GPU usage on some systems. See also `term:disablewebgl` for terminal-specific GPU settings. Try disabling WebGL first before disabling all hardware acceleration.

| Value | Meaning |
|---|---|
| `true` | Application uses software rendering (slower but more compatible) |
| `false` | Application uses GPU acceleration (recommended) |

---

#### Max Tab Cache Size

| Property | Value |
|---|---|
| **Key** | `window:maxtabcachesize` |
| **Type** | number |
| **Default** | `10` |
| **Range** | 1 - 50 |
| **Requires Restart** | No |

Maximum number of inactive tabs kept in memory for quick switching. Cached tabs switch instantly because their content is already loaded. Higher values use more memory but make tab switching faster. Lower values save memory at the cost of reload time when switching to uncached tabs.

---

### Magnification

These settings control the appearance of blocks when using the magnification (zoom-in) feature.

#### Magnified Block Opacity

| Property | Value |
|---|---|
| **Key** | `window:magnifiedblockopacity` |
| **Type** | number |
| **Default** | `0.6` |
| **Range** | 0 - 1 (step 0.1) |
| **Requires Restart** | No |

The opacity of non-magnified blocks when a block is magnified. Lower values make the surrounding blocks more faded, drawing more attention to the magnified block.

---

#### Magnified Block Size

| Property | Value |
|---|---|
| **Key** | `window:magnifiedblocksize` |
| **Type** | number |
| **Default** | `0.9` |
| **Range** | 0.5 - 1.0 (step 0.05) |
| **Requires Restart** | No |

Size multiplier for magnified blocks relative to the available space. A value of `1.0` means the magnified block takes up the full available area, while lower values leave some margin.

---

#### Magnified Block Blur (Primary)

| Property | Value |
|---|---|
| **Key** | `window:magnifiedblockblurprimarypx` |
| **Type** | number |
| **Default** | `10` |
| **Range** | 0 - 50 |
| **Requires Restart** | No |

The blur amount in pixels applied to the primary magnified block's background. Higher values create a stronger blur effect.

---

#### Magnified Block Blur (Secondary)

| Property | Value |
|---|---|
| **Key** | `window:magnifiedblockblursecondarypx` |
| **Type** | number |
| **Default** | `2` |
| **Range** | 0 - 50 |
| **Requires Restart** | No |

The blur amount in pixels applied to secondary (non-focused) magnified blocks. Typically set lower than the primary blur to create a visual hierarchy.

---

## AI

AI assistant configuration settings.

### Configuration

#### AI Preset

| Property | Value |
|---|---|
| **Key** | `ai:preset` |
| **Type** | string |
| **Default** | `"ai@global"` |
| **Requires Restart** | No |

The AI configuration preset to use. Presets bundle together API type, model, token, and other settings into a single named configuration. The available presets are populated dynamically based on your configured AI profiles.

---

#### API Type

| Property | Value |
|---|---|
| **Key** | `ai:apitype` |
| **Type** | string |
| **Default** | `""` |
| **Requires Restart** | No |

The type of AI API backend to use. This determines the protocol and authentication method for communicating with the AI service.

| Value | Description |
|---|---|
| `openai` | OpenAI API (auto-detects chat vs responses) |
| `anthropic` | Anthropic Claude API |
| `azure` | Azure OpenAI Service |
| `google-gemini` | Google Gemini API |
| `openai-responses` | OpenAI Responses API (explicit) |
| `openai-chat` | OpenAI Chat Completions API (explicit) |

---

#### Base URL

| Property | Value |
|---|---|
| **Key** | `ai:baseurl` |
| **Type** | string |
| **Default** | `""` (use provider default) |
| **Requires Restart** | No |

Custom base URL for the AI API endpoint. Use this when connecting to a self-hosted model server, a proxy, or a compatible third-party API. Leave empty to use the default endpoint for the selected API type. Example: `http://localhost:11434/v1` for a local Ollama instance.

---

#### API Token

| Property | Value |
|---|---|
| **Key** | `ai:apitoken` |
| **Type** | string (sensitive) |
| **Default** | `""` |
| **Requires Restart** | No |

API token (key) for authenticating with the AI service. This value is stored in your settings file and is treated as sensitive data. For OpenAI, this is your `sk-...` key. For Anthropic, this is your `sk-ant-...` key. For Azure, this is your deployment key.

---

#### Model

| Property | Value |
|---|---|
| **Key** | `ai:model` |
| **Type** | string |
| **Default** | `"gpt-5-mini"` |
| **Requires Restart** | No |

The AI model identifier to use for completions. The available models depend on your chosen API type and provider. Examples: `gpt-5-mini`, `gpt-4o`, `claude-sonnet-4-20250514`, `gemini-pro`.

---

#### AI Name

| Property | Value |
|---|---|
| **Key** | `ai:name` |
| **Type** | string |
| **Default** | `""` |
| **Requires Restart** | No |

A custom display name for the AI assistant shown in the chat panel. Leave empty to use the default name.

---

#### Organization ID

| Property | Value |
|---|---|
| **Key** | `ai:orgid` |
| **Type** | string |
| **Default** | `""` |
| **Requires Restart** | No |

Organization ID for the AI API, if required by your provider. Some OpenAI accounts require an organization ID to route requests to the correct billing account.

---

#### API Version

| Property | Value |
|---|---|
| **Key** | `ai:apiversion` |
| **Type** | string |
| **Default** | `""` |
| **Requires Restart** | No |

API version string, primarily used for Azure OpenAI deployments. Azure requires a specific API version in each request (e.g., `2024-02-15-preview`). Leave empty for non-Azure providers.

---

#### Show Cloud Modes

| Property | Value |
|---|---|
| **Key** | `waveai:showcloudmodes` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Show Wave AI cloud modes in the AI mode selector. Disable this if you only want to use your own API keys and do not want to see Wave-hosted AI options.

| Value | Meaning |
|---|---|
| `true` | Wave cloud AI modes are shown in the selector |
| `false` | Only custom/local modes are shown |

---

#### Default Mode

| Property | Value |
|---|---|
| **Key** | `waveai:defaultmode` |
| **Type** | string |
| **Default** | `"waveai@balanced"` |
| **Requires Restart** | No |

The default AI mode selected when opening a new AI chat panel. Available modes are populated dynamically and may include Wave cloud modes and your custom presets.

---

### Limits

#### Max Tokens

| Property | Value |
|---|---|
| **Key** | `ai:maxtokens` |
| **Type** | number |
| **Default** | `4000` |
| **Range** | 100 - 100,000 |
| **Requires Restart** | No |

Maximum number of tokens the AI can generate in a single response. Higher values allow longer responses but cost more and take longer. The effective maximum depends on the model you are using.

---

#### Timeout (ms)

| Property | Value |
|---|---|
| **Key** | `ai:timeoutms` |
| **Type** | number |
| **Default** | `60000` (60 seconds) |
| **Range** | 5,000 - 300,000 |
| **Requires Restart** | No |

Timeout for AI requests in milliseconds. If the AI service does not respond within this time, the request is cancelled. Increase this for slower connections or models that take longer to respond.

---

### Network

#### Proxy URL

| Property | Value |
|---|---|
| **Key** | `ai:proxyurl` |
| **Type** | string |
| **Default** | `""` |
| **Requires Restart** | No |

A proxy URL for routing AI API requests. Use this if your network requires a proxy to reach external APIs. Example: `http://proxy.example.com:8080`. Leave empty for direct connections.

---

### Appearance

#### AI Panel Font Size

| Property | Value |
|---|---|
| **Key** | `ai:fontsize` |
| **Type** | number |
| **Default** | `14` |
| **Range** | 10 - 24 (step 1) |
| **Requires Restart** | No |

Font size for the prose text in the AI chat panel, measured in pixels. This is separate from the terminal and editor font sizes.

---

#### AI Panel Code Font Size

| Property | Value |
|---|---|
| **Key** | `ai:fixedfontsize` |
| **Type** | number |
| **Default** | `12` |
| **Range** | 8 - 20 (step 1) |
| **Requires Restart** | No |

Font size for code blocks displayed in the AI chat panel, measured in pixels. This controls only the monospace code portions, not the surrounding prose text.

---

## Web

Built-in web browser settings.

#### Open Links Internally

| Property | Value |
|---|---|
| **Key** | `web:openlinksinternally` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

When enabled, clicking links opens them in Wave Terminal's built-in browser instead of your system's default browser. Useful if you prefer keeping everything within Wave.

| Value | Meaning |
|---|---|
| `true` | Links open in Wave's built-in browser |
| `false` | Links open in the system default browser |

---

#### Default URL

| Property | Value |
|---|---|
| **Key** | `web:defaulturl` |
| **Type** | string |
| **Default** | `"https://github.com/wavetermdev/waveterm"` |
| **Requires Restart** | No |

The URL loaded when you open a new web browser block. Change this to your preferred homepage, documentation site, or internal tool.

---

#### Default Search Engine

| Property | Value |
|---|---|
| **Key** | `web:defaultsearch` |
| **Type** | string |
| **Default** | `"https://www.google.com/search?q={query}"` |
| **Requires Restart** | No |

The search engine URL used when you type a search query (rather than a URL) in the web browser's address bar. Use `{query}` as the placeholder for the search terms. Examples:
- Google: `https://www.google.com/search?q={query}`
- DuckDuckGo: `https://duckduckgo.com/?q={query}`
- Bing: `https://www.bing.com/search?q={query}`

---

## Connections

Remote connection settings.

#### Enable WSH

| Property | Value |
|---|---|
| **Key** | `conn:wshenabled` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Enable the Wave Shell Helper (wsh) on remote connections. WSH provides enhanced features on remote machines including file browsing, previews, and bidirectional communication with Wave Terminal. Disabling this makes remote connections behave like plain SSH sessions.

| Value | Meaning |
|---|---|
| `true` | WSH is enabled and will be installed on remote machines |
| `false` | Remote connections work as plain SSH without WSH features |

---

#### Ask Before Installing WSH

| Property | Value |
|---|---|
| **Key** | `conn:askbeforewshinstall` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Prompt for confirmation before installing the wsh helper binary on a remote system. This only applies when `conn:wshenabled` is turned on. Disable this to allow automatic WSH installation without prompts.

| Value | Meaning |
|---|---|
| `true` | You are asked before wsh is installed on a remote machine |
| `false` | wsh is installed automatically when connecting |

---

## Shell

Local shell profile settings.

#### Default Shell

| Property | Value |
|---|---|
| **Key** | `shell:default` |
| **Type** | string |
| **Default** | `""` (system default) |
| **Requires Restart** | No |

The default shell profile to use for new terminal blocks. This is managed through the shell selector in the UI. Leave empty to use the system default shell.

---

#### Shell Profiles

| Property | Value |
|---|---|
| **Key** | `shell:profiles` |
| **Type** | object (map of profile definitions) |
| **Default** | `{}` |
| **Requires Restart** | No |

Custom shell profile definitions for local shells. Each profile can specify a shell executable, arguments, environment variables, and a display name. Profiles appear in the shell selector dropdown. This is typically configured through the UI rather than edited manually. Supported shells include cmd, PowerShell, bash, zsh, fish, and WSL distributions.

---

## App

General application settings.

#### Global Hotkey

| Property | Value |
|---|---|
| **Key** | `app:globalhotkey` |
| **Type** | string |
| **Default** | `""` (no hotkey) |
| **Requires Restart** | No |

A global keyboard shortcut to show or hide the Wave Terminal window from anywhere on your desktop. The shortcut works even when Wave is not focused. Use Electron accelerator format, e.g., `Ctrl+Shift+W`, `Alt+Space`, `CommandOrControl+Shift+T`. Leave empty to disable the global hotkey.

---

#### Default New Block

| Property | Value |
|---|---|
| **Key** | `app:defaultnewblock` |
| **Type** | string |
| **Default** | `"term"` |
| **Requires Restart** | No |

The default block type created when you add a new block.

| Value | Description |
|---|---|
| `term` | A new terminal session |
| `preview` | A file preview/editor block |
| `web` | A web browser block |

---

#### Show Block Numbers

| Property | Value |
|---|---|
| **Key** | `app:showoverlayblocknums` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Display block numbers as an overlay when hovering over blocks. These numbers correspond to keyboard shortcuts for switching between blocks.

| Value | Meaning |
|---|---|
| `true` | Block number overlays are shown on hover |
| `false` | Block numbers are hidden |

---

#### Ctrl+V to Paste (Windows)

| Property | Value |
|---|---|
| **Key** | `app:ctrlvpaste` |
| **Type** | boolean |
| **Default** | `false` |
| **Platform** | Windows only |
| **Requires Restart** | No |

Use Ctrl+V for paste in the terminal instead of passing it through to the running program. By default, Ctrl+V is sent to the terminal as a control character. Enable this if you prefer Ctrl+V to always paste from the clipboard on Windows.

| Value | Meaning |
|---|---|
| `true` | Ctrl+V pastes from clipboard |
| `false` | Ctrl+V is sent to the terminal as a control character |

---

#### Dismiss Architecture Warning

| Property | Value |
|---|---|
| **Key** | `app:dismissarchitecturewarning` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Dismiss the warning that appears when running Wave Terminal on a non-native architecture (e.g., running x64 on Apple Silicon via Rosetta). Once dismissed, the warning will not appear again.

| Value | Meaning |
|---|---|
| `true` | Architecture mismatch warning is suppressed |
| `false` | Warning is shown when applicable |

---

### Appearance

#### UI Theme

| Property | Value |
|---|---|
| **Key** | `app:theme` |
| **Type** | string |
| **Default** | `"dark"` |
| **Requires Restart** | No |

The overall color theme for the application UI (not the terminal, which has its own color scheme).

| Value | Description |
|---|---|
| `dark` | Dark background with light text |
| `light` | Light background with dark text |
| `system` | Follow the operating system's dark/light mode setting |

---

#### Accent Theme

| Property | Value |
|---|---|
| **Key** | `app:accent` |
| **Type** | string |
| **Default** | `"green"` |
| **Requires Restart** | No |

The accent color palette used for buttons, highlights, focus indicators, and other interactive UI elements.

| Value | Description |
|---|---|
| `green` | Green accent (default) |
| `warm` | Warm orange/amber accent |
| `blue` | Blue accent |
| `purple` | Purple accent |
| `teal` | Teal accent |

---

#### Theme Overrides

| Property | Value |
|---|---|
| **Key** | `app:themeoverrides` |
| **Type** | object (map of CSS variable overrides) |
| **Default** | `{}` |
| **Requires Restart** | No |

CSS variable overrides applied on top of the current theme and accent. This allows fine-grained customization of individual colors without creating a full custom theme. Keys are CSS variable names and values are CSS color values.

---

#### Custom Accents

| Property | Value |
|---|---|
| **Key** | `app:customaccents` |
| **Type** | object (map of named accent definitions) |
| **Default** | `{}` |
| **Requires Restart** | No |

Named custom accent themes with saved CSS variable override maps. Each entry defines a reusable accent palette that can be selected alongside the built-in accents.

---

### Tabs

#### Tab Preset

| Property | Value |
|---|---|
| **Key** | `tab:preset` |
| **Type** | string |
| **Default** | `""` |
| **Requires Restart** | No |

The default preset layout applied to new tabs. Presets define the initial block arrangement when a new tab is created. Available presets are populated dynamically. Leave empty for a single-block default.

---

## Auto Update

Automatic update settings.

#### Auto Update

| Property | Value |
|---|---|
| **Key** | `autoupdate:enabled` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Automatically check for and download updates in the background. When a new version is available, you will be notified. Disable this to manage updates manually.

| Value | Meaning |
|---|---|
| `true` | Wave Terminal checks for updates automatically |
| `false` | No automatic update checks |

---

#### Install on Quit

| Property | Value |
|---|---|
| **Key** | `autoupdate:installonquit` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

When a downloaded update is available, install it automatically when you quit the application. Disable this if you prefer to install updates manually at a time of your choosing.

| Value | Meaning |
|---|---|
| `true` | Downloaded updates are installed when the app exits |
| `false` | Updates are downloaded but not installed automatically |

---

#### Check Interval (ms)

| Property | Value |
|---|---|
| **Key** | `autoupdate:intervalms` |
| **Type** | number |
| **Default** | `3600000` (1 hour) |
| **Range** | 60,000 (1 minute) - 86,400,000 (24 hours) |
| **Requires Restart** | No |

How often Wave Terminal checks for updates, in milliseconds. The default is once per hour. Set to a higher value if you want less frequent checks, or lower for faster notification of new releases.

---

#### Update Channel

| Property | Value |
|---|---|
| **Key** | `autoupdate:channel` |
| **Type** | string |
| **Default** | `"stable"` |
| **Requires Restart** | No |

The release channel to receive updates from.

| Value | Description |
|---|---|
| `stable` | Production releases, most thoroughly tested |
| `beta` | Pre-release versions with new features, may have minor issues |
| `nightly` | Daily development builds, may be unstable |

---

## Preview

File preview settings.

#### Show Hidden Files

| Property | Value |
|---|---|
| **Key** | `preview:showhiddenfiles` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Show hidden files and directories (those starting with a dot) in the file preview browser. Enable this to see configuration files and other hidden items.

| Value | Meaning |
|---|---|
| `true` | Hidden files are visible in the file browser |
| `false` | Hidden files are not shown |

---

#### Max File Size (MB)

| Property | Value |
|---|---|
| **Key** | `preview:maxfilesize` |
| **Type** | number |
| **Default** | `10` |
| **Range** | 0 - 1,000 |
| **Requires Restart** | No |

Maximum file size in megabytes that can be opened in the file preview. Files larger than this limit display an error message instead of loading. This prevents accidentally opening very large files that could freeze the application. Set to `0` to disable the limit (not recommended).

---

#### Max CSV Size (MB)

| Property | Value |
|---|---|
| **Key** | `preview:maxcsvsize` |
| **Type** | number |
| **Default** | `1` |
| **Range** | 0 - 100 |
| **Requires Restart** | No |

Maximum CSV file size in megabytes that can be previewed in the interactive table view. CSV rendering is more memory-intensive than plain text because the entire file is parsed into a data grid. CSV files exceeding this limit fall back to the text editor view instead.

---

## Markdown

Markdown viewer settings.

#### Font Size

| Property | Value |
|---|---|
| **Key** | `markdown:fontsize` |
| **Type** | number |
| **Default** | `14` |
| **Range** | 10 - 24 (step 1) |
| **Requires Restart** | No |

Font size for rendered Markdown prose text in pixels. Adjust this for comfortable reading in Markdown preview blocks.

---

#### Code Font Size

| Property | Value |
|---|---|
| **Key** | `markdown:fixedfontsize` |
| **Type** | number |
| **Default** | `12` |
| **Range** | 8 - 20 (step 1) |
| **Requires Restart** | No |

Font size for code blocks within rendered Markdown, in pixels. This only affects the monospace code portions, not the surrounding prose.

---

## Widget

Widget launcher and pop-out settings.

#### Show Help

| Property | Value |
|---|---|
| **Key** | `widget:showhelp` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Show help text and descriptions for widgets in the launcher panel.

| Value | Meaning |
|---|---|
| `true` | Help text is displayed alongside widgets |
| `false` | Help text is hidden for a more compact view |

---

### Pop-Out

#### Enable Pop-Out

| Property | Value |
|---|---|
| **Key** | `widget:popoutenabled` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Allow blocks to be popped out (detached) into standalone floating windows via the title bar button. When disabled, the pop-out button is not shown on block headers.

| Value | Meaning |
|---|---|
| `true` | Blocks can be popped out into separate windows |
| `false` | Pop-out feature is disabled |

---

#### Pop-Out Always on Top

| Property | Value |
|---|---|
| **Key** | `widget:popoutalwaysontop` |
| **Type** | boolean |
| **Default** | `true` |
| **Requires Restart** | No |

Keep popped-out block windows always on top of all other windows. Useful for keeping a terminal or preview visible while working in another application.

| Value | Meaning |
|---|---|
| `true` | Popped-out windows float above all other windows |
| `false` | Popped-out windows behave like normal windows |

---

#### Tab Hover Switch Delay (ms)

| Property | Value |
|---|---|
| **Key** | `widget:poptabhoverms` |
| **Type** | number |
| **Default** | `800` |
| **Range** | 200 - 5,000 |
| **Requires Restart** | No |

The number of milliseconds you must hover over a tab while dragging a popped-out block before the tab switches. Lower values make tab switching faster during drag operations; higher values prevent accidental tab switches.

---

## Block Header

Block header display settings.

#### Show Block IDs

| Property | Value |
|---|---|
| **Key** | `blockheader:showblockids` |
| **Type** | boolean |
| **Default** | `false` |
| **Requires Restart** | No |

Display the internal block ID in each block's header. This is primarily useful for debugging or development purposes and is not needed for normal use.

| Value | Meaning |
|---|---|
| `true` | Block IDs are shown in headers |
| `false` | Block IDs are hidden |

---

## Debug

Debugging and development options. These settings are intended for developers and troubleshooting. Most users should leave them at their defaults.

#### pprof Port

| Property | Value |
|---|---|
| **Key** | `debug:pprofport` |
| **Type** | number |
| **Default** | `null` (disabled) |
| **Range** | 1,024 - 65,535 |
| **Requires Restart** | No |

Port number for the Go pprof debugging HTTP server. When set, Wave Terminal exposes a pprof endpoint on this port for CPU and memory profiling. Leave unset to disable the pprof server.

---

#### pprof Memory Profile Rate

| Property | Value |
|---|---|
| **Key** | `debug:pprofmemprofilerate` |
| **Type** | number |
| **Default** | `null` (Go default) |
| **Range** | 0 - 1,000,000 |
| **Requires Restart** | No |

Memory profiling sample rate for pprof. Controls how frequently memory allocations are sampled. A value of `0` disables memory profiling. Lower values mean more frequent sampling (higher overhead but more accurate profiles).

---

## Backend-Only Settings

The following settings appear in the backend defaults (`settings.json`) but are not exposed in the Settings UI. They can be set manually by editing the settings file.

#### Bell Sound

| Property | Value |
|---|---|
| **Key** | `term:bellsound` |
| **Type** | boolean |
| **Default** | `false` |

Whether the terminal plays an audible bell sound when a BEL character is received. Disabled by default to avoid unexpected sounds.

---

#### Bell Indicator

| Property | Value |
|---|---|
| **Key** | `term:bellindicator` |
| **Type** | boolean |
| **Default** | `true` |

Whether a visual indicator is shown in the block header when a BEL character is received. This provides a silent notification that a bell event occurred.

---

#### Durable Terminal

| Property | Value |
|---|---|
| **Key** | `term:durable` |
| **Type** | boolean |
| **Default** | `false` |

Enable durable terminal sessions that persist across application restarts. When enabled, terminal sessions are saved and restored so that running processes survive a Wave Terminal restart.

---

#### Telemetry Enabled

| Property | Value |
|---|---|
| **Key** | `telemetry:enabled` |
| **Type** | boolean |
| **Default** | Not set (opt-in) |

Controls whether anonymous telemetry data is sent. This setting is managed through the backend and may be presented during initial setup.

---

#### Local Host Display Name

| Property | Value |
|---|---|
| **Key** | `conn:localhostdisplayname` |
| **Type** | string |
| **Default** | Not set (uses system hostname) |

A custom display name for the local machine shown in the connection selector. Set this to override the system hostname with a friendlier label.
