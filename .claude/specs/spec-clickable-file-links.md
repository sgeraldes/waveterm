# Spec: Clickable File Paths in Terminal Output

**Date:** 2026-03-25
**Status:** Draft
**Goal:** Make file paths appearing in terminal output clickable, opening the referenced file in a Wave preview block — matching the behavior VS Code provides for its integrated terminal.

---

## 1. Scope

This spec covers detection and click handling for file system paths printed in terminal output. It does not cover HTTP/HTTPS URLs (already handled by `WebLinksAddon`), nor OSC 8 hyperlinks, nor path completion in the shell input line.

**In scope:**
- Absolute Unix paths: `/home/user/file.txt`, `/usr/local/lib/node_modules/foo/index.js`
- Relative paths (resolved against `cmd:cwd`): `./src/main.go`, `src/components/app.tsx`
- Paths with line/column suffixes (compiler output format): `/path/to/file.go:42`, `/path/to/file.ts:10:5`
- Windows absolute paths when terminal connection is Windows: `C:\Users\foo\bar.txt`
- Remote connection awareness: paths on SSH-connected blocks resolve via `RemoteFileInfoCommand`
- A new setting `term:filelinks` to enable/disable the feature (default: `true`)
- Context menu item for right-clicking selected text that looks like a path

**Out of scope:**
- `~`-prefixed paths (tilde expansion requires a shell round-trip; deferred)
- Paths inside binary/escape sequences
- Non-file:// URI schemes beyond `http`/`https`

---

## 2. Current Behavior

`termwrap.ts` loads `WebLinksAddon` at construction time (line 142). This addon registers an internal xterm.js link provider that matches `http://` and `https://` patterns only. Clicking a matched URL (with Cmd on macOS, Ctrl on other platforms) calls `openLink(uri)` from `global.ts`, which either opens a web block or the system browser.

No mechanism exists for file paths. xterm.js exposes `terminal.registerLinkProvider(ILinkProvider)` as a first-class API for custom link detection, which the `WebLinksAddon` itself uses internally.

The context menu in `term-model.ts:907-939` already has a URL-detection branch for selected text that opens a web block — it checks `new URL(trimmedSelection)` and filters for `http` protocol.

---

## 3. Proposed Behavior

**Inline link detection (hover + click):**
When the user hovers over a token in terminal output that looks like a file path, xterm.js underlines it. Two click actions are available:

| Action | Behavior |
|--------|----------|
| Click (or Cmd+click on macOS) | Open file in Wave preview block (internal viewer/editor) |
| Ctrl+Click (or Cmd+Ctrl+click on macOS) | Open file in external registered application (e.g., VS Code, Notepad++, default OS handler) |

If the path includes a `:line` or `:line:col` suffix, the preview block opens to that line. External apps receive the path as an argument (line number support depends on the external app's CLI flags).

**Validation before highlighting:**
Paths are only highlighted after passing two checks:
1. Synchronous regex pre-filter (cheap, no I/O).
2. Asynchronous `RemoteFileInfoCommand` / `FileInfoCommand` probe that confirms the file exists on the remote/local filesystem. If `notfound` is true, no link is shown.

**Context menu (selected text):**
When the user right-clicks with text selected that matches a path pattern, two items appear:
- "Open File in Preview" — opens in Wave's internal preview block
- "Open in External Editor" — opens in the configured external application

**External editor setting:**
`term:externaleditor` (string, default `""`) — the executable path or command for the external editor. Examples: `code`, `notepad++`, `vim`, `C:\Program Files\VS Code\code.exe`. When empty, uses the OS default handler (`electron.shell.openPath`). The setting includes a file picker button in the Settings panel.

**Setting:**
`term:filelinks` (boolean, default `true`) — when `false`, no file path links are shown.

---

## 4. Technical Design

### 4.1 Data Model Changes

**New preview meta key (required for line navigation):**

Add to `pkg/waveobj/wtypemeta.go` `MetaTSType`:
```go
PreviewLine *int64 `json:"preview:line,omitempty"`
PreviewCol  *int64 `json:"preview:col,omitempty"`
```

Run `task generate` to regenerate `metaconsts.go` and `gotypes.d.ts`.

**Frontend handling:** In `PreviewModel` initialization (or the Monaco specialized view), read `meta["preview:line"]` and call `editor.revealLineInCenter(line)` when the preview block is first mounted with this key set.

**`pkg/wconfig/settingsconfig.go` — `SettingsType` struct:**
Add two fields:
```go
TermFileLinks      *bool  `json:"term:filelinks,omitempty"`
TermExternalEditor string `json:"term:externaleditor,omitempty"`
```

**`pkg/wconfig/metaconsts.go`:**
Add constant (via `task generate`):
```go
ConfigKey_TermFileLinks = "term:filelinks"
```

**`schema/settings.json`:**
Add `"term:filelinks"` as a boolean property with description.

No database migrations are required; this is a settings key only.

### 4.2 Frontend Changes

#### New file: `frontend/app/view/term/termlinks.ts`

This module encapsulates all file link logic, keeping `termwrap.ts` clean.

**Exports:**
```typescript
export function createFileLinkProvider(
    blockId: string,
    getConnection: () => string | undefined,
    getCwd: () => string | undefined
): TermTypes.ILinkProvider
```

**Internals:**

`FILE_PATH_REGEX` — a single compiled regex covering:
- Unix absolute: `(?:^|[\s(])(\/[^\s:'"<>()[\]{}|\\^\x00-\x1F]{2,})`
- Relative paths: `(?:^|[\s(])(\.\.?\/[^\s:'"<>()[\]{}|\\^\x00-\x1F]{1,})`
- Windows absolute: `(?:^|[\s(])([A-Za-z]:\\[^\s:'"<>()[\]]{2,})`
- Optional suffix: `(?::(\d+)(?::(\d+))?)?`

The regex is intentionally conservative. Tokens must start at a word boundary or after whitespace/open-paren to avoid false matches inside prose.

`validatePath(rawPath: string): PathValidationResult` — delegates to the existing `quickValidatePath()` from `pathutil.ts`.

`probeFileExists(path: string, connection: string | undefined): Promise<boolean>` — calls `RpcApi.RemoteFileInfoCommand(TabRpcClient, path, { route: connectionRoute })` if a connection is set, otherwise `RpcApi.FileInfoCommand(TabRpcClient, { info: { path } })`. Returns `true` when `!fileInfo.notfound`.

A simple in-memory LRU cache (capacity 200, TTL 10s) prevents redundant probes for the same path within a session.

`ILinkProvider` implementation:
- `provideLinks(bufferLineNumber, callback)`: reads the buffer line text via `terminal.buffer.active.getLine(...)`, runs `FILE_PATH_REGEX` against it, calls `quickValidatePath` synchronously, fires async `probeFileExists` for each candidate. Calls `callback` with the valid links.

`openFilePath(path: string, line: number | undefined, col: number | undefined, connection: string | undefined)`:
```typescript
const meta: MetaType = {
    view: "preview",
    file: resolvedPath,
};
if (connection) meta.connection = connection;
if (line != null) meta["preview:line"] = line;
createBlock({ meta });
```

Relative paths are resolved by prepending `getCwd()` before probing.

**Click modifiers:**
- **Click** (or Cmd+click on macOS): Opens in Wave preview block (internal)
- **Ctrl+Click** (or Cmd+Ctrl+click on macOS): Opens in external editor

`openFileExternal(path: string, connection: string | undefined)`:
```typescript
const editorSetting = globalStore.get(atoms.settingsAtom)["term:externaleditor"];
if (editorSetting) {
    // Launch external editor with path as argument
    getApi().openExternalEditor(editorSetting, resolvedPath);
} else {
    // Fall back to OS default handler
    getApi().openNativePath(resolvedPath);
}
```

This requires a new IPC handler `open-external-editor` in `emain/emain-ipc.ts` that uses `child_process.execFile(editorCmd, [path])` (NOT `exec` — prevents shell injection). The editor path and file path are passed as separate arguments to `execFile`. For local connections only — remote paths show a notification "External editor not available for remote connections."

#### Modified file: `frontend/app/view/term/termwrap.ts`

In the `TermWrap` constructor, after loading `WebLinksAddon`, register the file link provider when the feature is enabled:

```typescript
const fileLinksEnabled =
    globalStore.get(getOverrideConfigAtom(waveOptions.nodeModel?.blockId, "term:filelinks")) ?? true;
if (fileLinksEnabled) {
    this.toDispose.push(
        this.terminal.registerLinkProvider(
            createFileLinkProvider(blockId, getConnection, getCwd)
        )
    );
}
```

#### Modified file: `frontend/app/view/term/term-model.ts`

**`getContextMenuItems()`**: After the existing `selectionURL` block, add a parallel `selectionFilePath` block:

```typescript
if (selectionFilePath) {
    menu.push({ type: "separator" });
    menu.push({
        label: "Open File in Preview",
        click: () => openFilePath(selectionFilePath.path, selectionFilePath.line, undefined, connection),
    });
    menu.push({
        label: "Open in External Editor",
        click: () => openFileExternal(selectionFilePath.path, connection),
        enabled: !connection, // disabled for remote connections
    });
}
```

#### Modified file: `frontend/app/store/settings-registry.ts`

Register two new settings:
```typescript
{
    key: "term:filelinks",
    label: "Clickable File Paths",
    description: "Underline and make clickable file paths printed in terminal output",
    controlType: "toggle",
    defaultValue: true,
    type: "boolean",
    tags: ["file", "links", "path", "clickable", "terminal"],
},
{
    key: "term:externaleditor",
    label: "External Editor",
    description: "Executable path for the external editor used when Ctrl+clicking file links. Leave empty to use OS default. Examples: code, notepad++, vim",
    controlType: "text",
    defaultValue: "",
    type: "string",
    tags: ["editor", "external", "file", "links", "vscode"],
    placeholder: "e.g., code, notepad++, /usr/bin/vim",
},
```

The "External Editor" setting includes a browse button (file picker) next to the text input, allowing users to locate the executable via the OS file dialog.

### 4.3 Backend Changes

No new backend commands are required. `RemoteFileInfoCommand` and `FileInfoCommand` already return `FileInfo` with a `notfound` field.

### 4.4 RPC/API Changes

No new RPC commands. Run `task generate` after adding the settings field to `SettingsType` and the `preview:line`/`preview:col` meta keys to `MetaTSType`.

---

## 5. UI/UX Design

**Hover state:** xterm.js natively renders an underline on the matched token when the provider returns a link. No additional CSS is needed.

**Cursor:** xterm.js sets `cursor: pointer` on hovered links automatically.

**Activation modifier:** Cmd+click (macOS) / Ctrl+click (Windows/Linux). Identical to HTTP link behavior.

**Line/column navigation:** When a path like `src/main.go:42:5` is clicked, the preview block opens with `preview:line: 42`.

**No visual indicator for unresolved paths:** Paths that fail the async probe silently show no link — matches VS Code's behavior.

**Context menu:** The "Open File in Preview" item appears only when the selected text passes the quick regex and synchronous `quickValidatePath` check. No async probe before showing the menu item.

---

## 6. Dependency Order

1. **`pkg/wconfig/settingsconfig.go` + `task generate`** — Add `TermFileLinks` field. Prerequisite for frontend to read the setting.
2. **`schema/settings.json`** — Add `term:filelinks` property. Parallel with step 1.
3. **`frontend/app/view/term/termlinks.ts`** (new file) — Implement regex, probe, link provider. Depends on step 1.
4. **`frontend/app/view/term/termwrap.ts`** — Register the link provider. Depends on step 3.
5. **`frontend/app/view/term/term-model.ts`** — Add context menu path detection. Depends on step 3 for shared utilities.
6. **`frontend/app/store/settings-registry.ts`** — Register the setting in the UI. Parallel with steps 3-5.

---

## 7. Acceptance Criteria

- [ ] Absolute Unix path `/path/to/file.ext` printed in terminal output is underlined on hover
- [ ] Click on a detected path opens a preview block (internal viewer)
- [ ] Ctrl+click on a detected path opens the file in the configured external editor (or OS default if not configured)
- [ ] Path with line suffix `/path/file.ts:42` opens preview block with `preview:line: 42`
- [ ] Path with line+col suffix `/path/file.ts:42:10` opens preview block with line and col metadata
- [ ] Non-existent paths are not underlined
- [ ] Relative path `./src/main.go` is resolved using `cmd:cwd` from block metadata before probing
- [ ] On a remote-connected terminal, file probe uses the correct connection route
- [ ] `term:filelinks: false` in settings disables all file path link detection
- [ ] Right-clicking selected text that is a valid path shows "Open File in Preview" and "Open in External Editor" context menu items
- [ ] "Open in External Editor" is disabled (grayed) for remote connections
- [ ] `term:externaleditor` setting accepts an executable path and uses it for Ctrl+click and context menu "Open in External Editor"
- [ ] `term:externaleditor` setting shows a file picker (browse) button in the Settings panel
- [ ] When `term:externaleditor` is empty, Ctrl+click uses the OS default file handler
- [ ] External editor is launched via `execFile` (not `exec`) to prevent command injection
- [ ] Paths blocked by `isBlockedPath()` are never linked
- [ ] Paths containing path traversal sequences are never linked
- [ ] On a Windows terminal, `C:\Users\foo\bar.txt` printed in output is detected as a file link
- [ ] Paths starting with `~` are NOT detected as file links (out of scope)
- [ ] HTTP/HTTPS URLs continue to work identically (no regression)
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm test` passes with zero failures
- [ ] `go build ./...` passes with zero errors

### Accessibility
- [ ] File links are distinguishable from regular text for colorblind users (underline, not color-only)
- [ ] Context menu "Open File in Preview" item is keyboard-accessible
- [ ] Link activation modifier (Cmd/Ctrl+click) is documented in tooltip on hover
