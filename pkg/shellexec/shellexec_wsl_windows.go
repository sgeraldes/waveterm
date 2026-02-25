
package shellexec

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/wavetermdev/waveterm/pkg/blocklogger"
	"github.com/wavetermdev/waveterm/pkg/genconn"
	"github.com/wavetermdev/waveterm/pkg/util/shellutil"
	"github.com/wavetermdev/waveterm/pkg/util/wslpath"
	"github.com/wavetermdev/waveterm/pkg/wavebase"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wsl"
	"github.com/wavetermdev/waveterm/pkg/wslutil"
)

var wslDistroPattern = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)

var wslInstallLocks sync.Map

// wslExePath returns the absolute path to wsl.exe to avoid PATH-based lookups.
func wslExePath() string {
	return filepath.Join(os.Getenv("SystemRoot"), "System32", "wsl.exe")
}

func getWslInstallLock(distro string) *sync.Mutex {
	val, _ := wslInstallLocks.LoadOrStore(distro, &sync.Mutex{})
	return val.(*sync.Mutex)
}

func DetectWslShellAndHome(wslDistro string) (shellPath string, homeDir string) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, wslExePath(), "-d", wslDistro, "--", "sh", "-c",
		"getent passwd $(whoami) | cut -d: -f6,7").Output()
	if err != nil {
		log.Printf("DetectWslShellAndHome: error detecting shell for WSL distro %q: %v\n", wslDistro, err)
		return "", ""
	}
	line := strings.TrimSpace(string(out))
	parts := strings.SplitN(line, ":", 2)
	if len(parts) == 2 {
		homeDir = parts[0]
		shellPath = parts[1]
	}
	if homeDir == "" {
		homeDir = "/root"
	}
	if shellPath == "" {
		shellPath = "/bin/bash"
	}
	return shellPath, homeDir
}

func StartWslLocalShellProc(logCtx context.Context, termSize waveobj.TermSize, cmdStr string, cmdOpts CommandOptsType, wslDistro string) (*ShellProc, error) {
	if wslDistro == "" {
		return nil, fmt.Errorf("WSL distro name is required")
	}
	if !wslDistroPattern.MatchString(wslDistro) {
		return nil, fmt.Errorf("invalid WSL distro name: %q", wslDistro)
	}
	shellutil.InitCustomShellStartupFiles()

	shellPath := cmdOpts.ShellPath
	if shellPath == "" {
		shellPath = "/bin/bash"
	}
	shellType := shellutil.GetShellTypeFromShellPath(shellPath)

	wslCwd := ""
	if cmdOpts.Cwd != "" {
		if linuxPath, ok := wslpath.WindowsToMnt(cmdOpts.Cwd); ok {
			wslCwd = linuxPath
			blocklogger.Debugf(logCtx, "[conndebug] converted Windows cwd %q to WSL path %q\n", cmdOpts.Cwd, wslCwd)
		} else {
			wslCwd = cmdOpts.Cwd
		}
	}

	var envVars []string
	packedToken, err := cmdOpts.SwapToken.PackForClient()
	if err != nil {
		blocklogger.Infof(logCtx, "error packing swap token: %v", err)
	} else {
		blocklogger.Debugf(logCtx, "packed swaptoken %s\n", packedToken)
		envVars = append(envVars, wavebase.WaveSwapTokenVarName+"="+packedToken)
	}
	jwtToken := cmdOpts.SwapToken.Env[wavebase.WaveJwtTokenVarName]
	if jwtToken != "" {
		blocklogger.Debugf(logCtx, "adding JWT token to WSL environment\n")
		envVars = append(envVars, wavebase.WaveJwtTokenVarName+"="+jwtToken)
	}
	envToAdd := shellutil.WaveshellLocalEnvVars(shellutil.DefaultTermType)
	if os.Getenv("LANG") == "" {
		envToAdd["LANG"] = wavebase.DetermineLang()
	}
	for k, v := range envToAdd {
		envVars = append(envVars, k+"="+v)
	}

	var cmdArgs []string
	cmdArgs = append(cmdArgs, "-d", wslDistro)
	if wslCwd != "" {
		cmdArgs = append(cmdArgs, "--cd", wslCwd)
	}
	cmdArgs = append(cmdArgs, "--")

	if cmdStr == "" {
		waveHomeLinux := ""
		if cmdOpts.HomeDir != "" {
			waveHomeLinux = cmdOpts.HomeDir + "/.waveterm"
		}

		var shellArgs []string
		switch shellType {
		case shellutil.ShellType_bash:
			shellArgs = append(shellArgs, shellPath)
			if waveHomeLinux != "" {
				shellArgs = append(shellArgs, "--rcfile", waveHomeLinux+"/shell/bash/.bashrc")
			} else {
				shellArgs = append(shellArgs, "--login")
			}
			shellArgs = append(shellArgs, "-i")
		case shellutil.ShellType_zsh:
			if waveHomeLinux != "" {
				envVars = append(envVars, "ZDOTDIR="+waveHomeLinux+"/shell/zsh")
			}
			shellArgs = append(shellArgs, shellPath, "--login", "-i")
		case shellutil.ShellType_fish:
			shellArgs = append(shellArgs, shellPath, "-l")
			if waveHomeLinux != "" {
				fishPath := shellutil.HardQuoteFish(waveHomeLinux + "/shell/fish/wave.fish")
				shellArgs = append(shellArgs, "-C", "source "+fishPath)
			}
		case shellutil.ShellType_pwsh:
			if waveHomeLinux != "" {
				pwshPath := waveHomeLinux + "/shell/pwsh/wavepwsh.ps1"
				shellArgs = append(shellArgs, shellPath, "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit", "-File", pwshPath)
			} else {
				shellArgs = append(shellArgs, shellPath, "-NoProfile", "-NoExit")
			}
		default:
			shellArgs = append(shellArgs, shellPath, "--login", "-i")
		}

		cmdArgs = append(cmdArgs, "env")
		cmdArgs = append(cmdArgs, envVars...)
		cmdArgs = append(cmdArgs, shellArgs...)
		blocklogger.Debugf(logCtx, "[conndebug] starting WSL shell: wsl.exe -d %s -- env [...] %s\n", wslDistro, strings.Join(shellArgs, " "))
	} else {
		cmdArgs = append(cmdArgs, "env")
		cmdArgs = append(cmdArgs, envVars...)
		cmdArgs = append(cmdArgs, shellPath, "-c", cmdStr)
		blocklogger.Debugf(logCtx, "[conndebug] starting WSL command: wsl.exe -d %s -- env [...] %s -c ...\n", wslDistro, shellPath)
	}

	ecmd := exec.Command(wslExePath(), cmdArgs...)
	ecmd.Env = os.Environ()

	if termSize.Rows == 0 || termSize.Cols == 0 {
		termSize.Rows = shellutil.DefaultTermRows
		termSize.Cols = shellutil.DefaultTermCols
	}
	if termSize.Rows <= 0 || termSize.Cols <= 0 {
		return nil, fmt.Errorf("invalid term size: %v", termSize)
	}
	shellutil.AddTokenSwapEntry(cmdOpts.SwapToken)
	cmdPty, err := pty.StartWithSize(ecmd, &pty.Winsize{Rows: uint16(termSize.Rows), Cols: uint16(termSize.Cols)})
	if err != nil {
		return nil, fmt.Errorf("error starting WSL shell proc: %w", err)
	}
	connName := "wsl:" + wslDistro
	cmdWrap := MakeCmdWrap(ecmd, cmdPty)
	return &ShellProc{Cmd: cmdWrap, ConnName: connName, CloseOnce: &sync.Once{}, DoneCh: make(chan any)}, nil
}

func getWslHomeDir(ctx context.Context, distro *wsl.Distro) (string, error) {
	cmd := distro.WslCommand(ctx, "echo $HOME")
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("error getting WSL home dir: %w", err)
	}
	homeDir := string(out)
	for len(homeDir) > 0 && (homeDir[len(homeDir)-1] == '\n' || homeDir[len(homeDir)-1] == '\r' || homeDir[len(homeDir)-1] == ' ') {
		homeDir = homeDir[:len(homeDir)-1]
	}
	if homeDir == "" {
		homeDir = "/root"
	}
	return homeDir, nil
}

func installWshInWsl(ctx context.Context, logCtx context.Context, distroName string) error {
	distro, err := wsl.GetDistro(ctx, wsl.WslName{Distro: distroName})
	if err != nil {
		return fmt.Errorf("error getting WSL distro %q: %w", distroName, err)
	}

	shellClient := genconn.MakeWSLShellClient(distro)
	clientOs, clientArch, err := wslutil.GetClientPlatform(logCtx, shellClient)
	if err != nil {
		return fmt.Errorf("error detecting WSL platform for %q: %w", distroName, err)
	}
	blocklogger.Infof(logCtx, "[conndebug] WSL distro %s platform: %s/%s\n", distroName, clientOs, clientArch)

	homeDir, err := getWslHomeDir(ctx, distro)
	if err != nil {
		return fmt.Errorf("error getting WSL home dir for %q: %w", distroName, err)
	}
	blocklogger.Infof(logCtx, "[conndebug] WSL home dir: %s\n", homeDir)

	waveHomeDirLinux := homeDir + "/.waveterm"
	waveHomeDirUNC := wslpath.LinuxToUNC(distroName, waveHomeDirLinux)
	wshBinDirUNC := filepath.Join(waveHomeDirUNC, "bin")

	if err := shellutil.InitRcFiles(waveHomeDirUNC, wshBinDirUNC); err != nil {
		return fmt.Errorf("error installing shell integration files to WSL %q: %w", distroName, err)
	}
	blocklogger.Infof(logCtx, "[conndebug] WSL shell integration files installed at %s\n", waveHomeDirUNC)

	if err := wslutil.CpWshToRemote(ctx, distro, clientOs, clientArch); err != nil {
		return fmt.Errorf("error installing wsh to WSL distro %q: %w", distroName, err)
	}
	blocklogger.Infof(logCtx, "[conndebug] wsh binary installed in WSL distro %s\n", distroName)

	return nil
}

func StartWslLocalShellProcWithWsh(logCtx context.Context, termSize waveobj.TermSize, cmdStr string, cmdOpts CommandOptsType, wslDistro string) (*ShellProc, error) {
	installCtx, cancelFn := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancelFn()

	mu := getWslInstallLock(wslDistro)
	mu.Lock()
	defer mu.Unlock()
	if err := installWshInWsl(installCtx, logCtx, wslDistro); err != nil {
		blocklogger.Infof(logCtx, "[conndebug] wsh installation failed for WSL distro %s (non-fatal, continuing without wsh): %v\n", wslDistro, err)
	}

	return StartWslLocalShellProc(logCtx, termSize, cmdStr, cmdOpts, wslDistro)
}
