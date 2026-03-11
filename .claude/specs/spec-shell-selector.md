# Shell Feature Specification

## Status: IMPLEMENTED

This spec documents the Shell system as built. It replaced the legacy "Connections" concept for local shells. Items marked `[x]` are implemented; items marked `[ ]` are future enhancements.

## Problem Statement

The original architecture conflated two fundamentally different concepts:

1. **Connections**: Remote hosts you SSH into (actual network connections)
2. **Shell Profiles**: Local shell binaries that get spawned (not connections)

This caused UX confusion: WSL, CMD, PowerShell, Git Bash appeared in the same dropdown as SSH remotes, with connection status indicators that made no sense for local shells.

## Key Insight

**Shells are NOT connections:**

| Concept        | What it is                               | Examples                       | Has network state? |
| -------------- | ---------------------------------------- | ------------------------------ | ------------------ |
| **Shell**      | A local process that runs a shell binary | cmd, pwsh, bash, git-bash, wsl | No                 |
| **Connection** | A remote host accessed over network      | SSH remotes                    | Yes                |

Even WSL is just a spawned process — you don't connect/disconnect from WSL, you just run it.

## Architecture

### Data Model

Shell profiles are stored in `settings.json` under `shell:profiles`:

```json
{
  "shell:default": "pwsh-a1b2c3d4",
  "shell:profiles": {
    "pwsh-a1b2c3d4": {
      "display:name": "PowerShell 7.5",
      "display:icon": "solid@terminal",
      "shell:path": "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      "shell:type": "pwsh",
      "autodetected": true,
      "source": "file"
    },
    "wsl:Ubuntu": {
      "display:name": "WSL: Ubuntu",
      "display:icon": "brands@ubuntu",
      "shell:iswsl": true,
      "shell:wsldistro": "Ubuntu",
      "autodetected": true,
      "source": "wsl"
    }
  }
}
```

**Go type:** `wconfig.ShellProfileType` in `pkg/wconfig/settingsconfig.go`

**TypeScript type:** `ShellProfileType` in `frontend/types/gotypes.d.ts`

### Block Metadata

Terminal blocks use `shell:profile` metadata (not `connection`) for local shells:

```typescript
interface TerminalBlockMeta {
  "shell:profile"?: string; // "pwsh-a1b2c3d4", "wsl:Ubuntu"
  connection?: string; // Only for SSH remotes
}
```

When `shell:profile` is set → spawn that shell.
When `connection` is set → SSH to that remote.
When neither → use `shell:default` from settings.

### Metadata Constants

- `MetaKey_ShellProfile = "shell:profile"` — block metadata key (`pkg/waveobj/metaconsts.go`)
- `ConfigKey_ShellProfiles = "shell:profiles"` — settings key (`pkg/wconfig/metaconsts.go`)
- `ConfigKey_ShellDefault = "shell:default"` — default shell setting

## Backend: Shell Detection

### RPC Commands

| Command                        | File               | Purpose                                   |
| ------------------------------ | ------------------ | ----------------------------------------- |
| `DetectAvailableShellsCommand` | `wshserver.go:747` | Detect all available shells on the system |
| `SetShellProfileCommand`       | `wshserver.go:784` | Create or update a shell profile          |
| `DeleteShellProfileCommand`    | `wshserver.go:805` | Remove a shell profile                    |
| `MergeShellProfilesCommand`    | `wshserver.go:812` | Detect + merge into existing profiles     |

### Request/Response Types

```go
// pkg/wshrpc/wshrpctypes.go
type DetectShellsRequest struct {
    ConnectionName string `json:"connectionname,omitempty"` // Empty = local
    Rescan         bool   `json:"rescan,omitempty"`         // Force cache refresh
}

type DetectShellsResponse struct {
    Shells []DetectedShell `json:"shells"`
    Error  string          `json:"error,omitempty"`
}

type DetectedShell struct {
    ID        string `json:"id"`                  // "pwsh-a1b2c3d4" (SHA256 hash of path)
    Name      string `json:"name"`                // "PowerShell 7.5"
    ShellPath string `json:"shellpath"`           // Full path to executable
    ShellType string `json:"shelltype"`           // "pwsh", "bash", "zsh", "fish", "cmd"
    Version   string `json:"version,omitempty"`   // "7.5"
    Source    string `json:"source"`              // "file", "wsl", "etc-shells", "homebrew", "static", "path"
    Icon      string `json:"icon,omitempty"`      // "solid@terminal", "brands@linux", etc.
    IsDefault bool   `json:"isdefault,omitempty"` // True if system default
    WslDistro string `json:"wsldistro,omitempty"` // Raw WSL distro name
}
```

### ID Generation

Deterministic hash of shell path:

```go
func GenerateShellID(shellType, shellPath string) string {
    hash := sha256.Sum256([]byte(shellPath))
    return fmt.Sprintf("%s-%x", shellType, hash[:4]) // e.g., "pwsh-a1b2c3d4"
}
```

### Platform-Specific Detection

**Windows** (`pkg/util/shellutil/shelldetect_windows.go`):

1. Command Prompt — `%SystemRoot%\System32\cmd.exe`
2. Windows PowerShell 5.1 — `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`
3. PowerShell Core 7+ — scans `%ProgramFiles%\PowerShell\{version}\`, Store, dotnet, Scoop
4. Git Bash — via existing `FindGitBash()` function
5. WSL Distributions — `wsl.RegisteredDistros()`, filters docker-desktop/rancher-desktop
6. Cygwin — `C:\cygwin64\bin\bash.exe`, `C:\cygwin\bin\bash.exe`

**macOS/Linux** (`pkg/util/shellutil/shelldetect_unix.go`):

1. Parse `/etc/shells` — all standard system shells
2. Homebrew shells — `/opt/homebrew/bin/`, `/usr/local/bin/` (macOS only)
3. PowerShell Core — `exec.LookPath("pwsh")` + known paths
4. Additional shells via PATH — Nushell, Elvish, Xonsh, Ion, Tcsh, Ksh

### Detection Features

- **Caching**: 5-minute TTL, `rescan: true` forces refresh
- **Deduplication**: By normalized path
- **Sorting**: By type priority (pwsh > bash > zsh > fish > cmd), WSL last
- **Default marking**: Compares against `DetectLocalShellPath()` result
- **Graceful degradation**: Individual detection failures logged but don't fail the whole operation
- **Invalid path filtering**: Visual Studio shells excluded on Windows
- **WSL distro icons**: Ubuntu, Debian, Fedora get brand icons; others get generic Linux

### Startup Auto-Detection

On app startup (`cmd/server/main-server.go:390`), the server automatically:

1. Calls `DetectAllShells()` to scan the system
2. Converts detected shells to `ShellProfileType`
3. Calls `MergeDetectedShellProfiles()` to add new shells without overwriting user customizations

## Frontend: Shell UI

### Shell Selector Modal (`frontend/app/modals/shellselector.tsx`)

Typeahead modal for switching a terminal's shell. Opened from terminal block header.

- **Groups**: "Shells" (non-WSL) and "WSL Distributions" (WSL profiles)
- **Filtering**: Real-time text filter by name or ID
- **Default indicator**: "(default)" suffix on the default shell
- **Hidden profiles**: Filtered out from display
- **Keyboard navigation**: Arrow keys, Enter to select, Escape to close
- **Shell change**: Sets `shell:profile` metadata + force-restarts the terminal

### Shell Selector Floating Window (`frontend/app/workspace/shell-selector.tsx`)

Floating menu for creating a new terminal with a specific shell. Used from the "+" button in the tab bar.

- **FloatingPortal**: Uses `@floating-ui/react` for positioning
- **Shell list**: From `shell:profiles`, sorted by `display:order`
- **Click action**: Creates a new terminal block with `shell:profile` set

### Shells Settings Page (`frontend/app/view/waveconfig/shells-content.tsx`)

Full management UI for shell profiles in Settings > Shells.

- **Shell list**: Left panel with all profiles, sorted by `display:order`
- **Shell editor**: Right panel with full edit form
- **Auto-detect button**: Wand icon, calls `MergeShellProfilesCommand`
- **Empty state**: Prominent "Detect Shells" button + "Add Shell Profile"
- **Editor fields**: Display Name, Icon, Shell Path, Arguments, Shell Type, WSL checkbox, WSL Distro, Hidden
- **Actions**: Save, Delete, Duplicate, Set as Default
- **Badges**: "autodetected", "modified" (user-customized autodetected shell)
- **Loading states**: Spinners on all async operations
- **Error handling**: Error banner with dismiss

### Terminal Header Display (`frontend/app/block/blockutil.tsx:210`)

`getShellProfileDisplayInfo()` resolves shell profile ID to display name + icon for the terminal header.
Falls back to formatting the raw ID if no profile config exists.

### Connection Dropdown Separation (`frontend/app/modals/conntypeahead.tsx:443`)

Local shell profiles are filtered OUT of the connection dropdown via `isLocalShellProfile()`:

```typescript
const remoteConnections = connList.filter((conn) => !util.isLocalShellProfile(conn, fullConfig.connections));
```

## File Map

### Backend

| File                                          | Purpose                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `pkg/util/shellutil/shelldetect.go`           | Core detection: DetectAllShells, GenerateShellID, caching, dedup, sort |
| `pkg/util/shellutil/shelldetect_windows.go`   | Windows: CMD, PowerShell, Git Bash, WSL, Cygwin                        |
| `pkg/util/shellutil/shelldetect_unix.go`      | Unix: /etc/shells, Homebrew, pwsh, additional shells                   |
| `pkg/wconfig/settingsconfig.go`               | ShellProfileType struct, CRUD functions, merge logic                   |
| `pkg/wshrpc/wshrpctypes.go`                   | RPC types: DetectedShell, ShellProfileData, request/response           |
| `pkg/wshrpc/wshserver/wshserver.go`           | RPC handlers: Detect, Set, Delete, Merge                               |
| `pkg/waveobj/metaconsts.go`                   | MetaKey_ShellProfile constant                                          |
| `pkg/wconfig/metaconsts.go`                   | ConfigKey_ShellProfiles, ConfigKey_ShellDefault                        |
| `pkg/remote/conncontroller/conncontroller.go` | IsLocalShellProfile(), IsLocalShellProfileId()                         |
| `pkg/blockcontroller/shellcontroller.go`      | Uses shell:profile metadata to launch shells                           |
| `cmd/server/main-server.go`                   | Startup auto-detection and merge                                       |
| `pkg/waveobj/validators.go`                   | ValidateShellProfileWithConfig()                                       |
| `pkg/wslutil/wslutil.go`                      | CheckWslShellProfileExists()                                           |

### Frontend

| File                                                    | Purpose                                         |
| ------------------------------------------------------- | ----------------------------------------------- |
| `frontend/app/modals/shellselector.tsx`                 | Shell selector typeahead modal                  |
| `frontend/app/workspace/shell-selector.tsx`             | Shell selector floating menu (new terminal)     |
| `frontend/app/workspace/shell-selector.test.ts`         | Unit tests for shell menu building              |
| `frontend/app/view/waveconfig/shells-content.tsx`       | Shells settings page (full CRUD + detect)       |
| `frontend/app/view/waveconfig/shells-content.scss`      | Shells settings styles                          |
| `frontend/app/view/waveconfig/shell-profile-helper.tsx` | Shell profile setup helper                      |
| `frontend/app/block/blockutil.tsx`                      | getShellProfileDisplayInfo(), getShellIcon()    |
| `frontend/app/modals/conntypeahead.tsx`                 | Filters local shells out of connection dropdown |
| `frontend/util/util.ts`                                 | isLocalShellProfile() utility                   |

## Acceptance Criteria

### Shell Profiles (Data Model)

- [x] Shell profiles are a separate concept from connections
- [x] `ShellProfileType` struct with display:name, display:icon, shell:path, shell:opts, shell:type, shell:iswsl, shell:wsldistro
- [x] Profiles stored in `shell:profiles` settings key
- [x] Default shell configurable via `shell:default` setting
- [x] Shell profiles support hide/unhide (`hidden` field)
- [x] Autodetected profiles tracked with `autodetected` field
- [x] User-modified autodetected profiles tracked with `usermodified` field

### Shell Detection (Backend)

- [x] `DetectAvailableShellsCommand` RPC implemented
- [x] **Windows**: Detects CMD, Windows PowerShell 5.1, PowerShell Core (if installed)
- [x] **Windows**: Detects WSL distributions (filters out docker-desktop, rancher-desktop)
- [x] **Windows**: Detects Git Bash using existing `FindGitBash()` function
- [x] **Windows**: Detects Cygwin bash
- [x] **macOS**: Detects shells from `/etc/shells` (bash, zsh, etc.)
- [x] **macOS**: Detects Homebrew shells (`/opt/homebrew/bin/`, `/usr/local/bin/`)
- [x] **Linux**: Detects shells from `/etc/shells`
- [x] **All platforms**: Detects PowerShell Core if installed
- [x] **All platforms**: Detects additional shells via PATH (nushell, elvish, etc.)
- [x] Each shell has a unique, deterministic ID (SHA256 hash of path)
- [x] Default shell correctly marked with `isdefault: true`
- [x] Missing shells do not cause errors (graceful degradation)
- [x] Detection results are cached with 5-minute TTL
- [x] Auto-detection runs on app startup
- [x] TypeScript bindings generated via `task generate`

### Shell UI (Terminal Header)

- [x] Terminal header shows current shell name (not connection name)
- [x] Shell icon displayed based on shell type (PowerShell, Linux, Windows, Git, etc.)
- [x] WSL distros display without "wsl://" prefix
- [x] No connection status indicators for local shells

### Shell Selector Modal

- [x] Shell selector modal shows grouped shells ("Shells" + "WSL Distributions")
- [x] Real-time text filtering by name or ID
- [x] Default shell indicated with "(default)" suffix
- [x] Hidden profiles filtered out
- [x] Keyboard navigation (Arrow keys, Enter, Escape)
- [x] Selecting a shell sets `shell:profile` metadata and restarts terminal

### Shell Selector Floating Menu (New Terminal)

- [x] Floating menu from "+" button shows available shells
- [x] Creates new terminal block with selected `shell:profile`
- [x] Inherits `tab:basedir` as `cmd:cwd`
- [x] Falls back to default terminal when no profiles configured

### Shells Settings Page

- [x] Auto-detect button visible (wand icon: `fa-wand-magic-sparkles`)
- [x] Empty state shows prominent auto-detect option
- [x] Clicking auto-detect shows loading spinner
- [x] Detected shells auto-merged into profiles (one-click flow)
- [x] Each shell shows: name, path, icon, badges
- [x] "autodetected" badge on system-discovered shells
- [x] Full editor: Display Name, Icon, Shell Path, Arguments, Shell Type, WSL, Hidden
- [x] Actions: Save, Delete, Duplicate, Set as Default
- [x] Error state shows message with dismiss button
- [x] Loading spinners on all async operations

### Connection Dropdown Separation

- [x] Connection dropdown only shows SSH remotes (local shells filtered out)
- [x] `isLocalShellProfile()` utility correctly identifies local shell profiles

## Future Enhancements

- [ ] **Shell detection selection panel**: Allow users to choose which detected shells to add instead of auto-adding all. Users can currently hide unwanted shells post-detection, but a pre-selection step could be cleaner for systems with many shells.
- [ ] **Shell profile import/export**: Import shell profiles from another Wave installation or share profiles.
- [ ] **Remote shell detection**: Detect available shells on SSH-connected remote hosts (currently local-only).
- [ ] **Shell health check**: Verify a shell profile's path still exists and is executable before showing in selector.
