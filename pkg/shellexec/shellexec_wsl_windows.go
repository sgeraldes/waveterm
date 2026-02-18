
package shellexec

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
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

func StartWslLocalShellProc(logCtx context.Context, termSize waveobj.TermSize, cmdStr string, cmdOpts CommandOptsType, wslDistro string) (*ShellProc, error) {
	if wslDistro == "" {
		return nil, fmt.Errorf("WSL distro name is required")
	}
	if !wslDistroPattern.MatchString(wslDistro) {
		return nil, fmt.Errorf("invalid WSL distro name: %q", wslDistro)
	}
	shellutil.InitCustomShellStartupFiles()

	var ecmd *exec.Cmd
	if cmdStr == "" {
		ecmd = exec.Command("wsl.exe", "-d", wslDistro, "--", "bash", "--login", "-i")
		blocklogger.Debugf(logCtx, "[conndebug] starting WSL shell: wsl.exe -d %s -- bash --login -i\n", wslDistro)
	} else {
		ecmd = exec.Command("wsl.exe", "-d", wslDistro, "--", "bash", "-c", cmdStr)
		blocklogger.Debugf(logCtx, "[conndebug] starting WSL command: wsl.exe -d %s -- bash -c %q\n", wslDistro, cmdStr)
	}
	ecmd.Env = os.Environ()

	packedToken, err := cmdOpts.SwapToken.PackForClient()
	if err != nil {
		blocklogger.Infof(logCtx, "error packing swap token: %v", err)
	} else {
		blocklogger.Debugf(logCtx, "packed swaptoken %s\n", packedToken)
		shellutil.UpdateCmdEnv(ecmd, map[string]string{wavebase.WaveSwapTokenVarName: packedToken})
	}
	jwtToken := cmdOpts.SwapToken.Env[wavebase.WaveJwtTokenVarName]
	if jwtToken != "" {
		blocklogger.Debugf(logCtx, "adding JWT token to WSL environment\n")
		shellutil.UpdateCmdEnv(ecmd, map[string]string{wavebase.WaveJwtTokenVarName: jwtToken})
	}

	envToAdd := shellutil.WaveshellLocalEnvVars(shellutil.DefaultTermType)
	if os.Getenv("LANG") == "" {
		envToAdd["LANG"] = wavebase.DetermineLang()
	}
	shellutil.UpdateCmdEnv(ecmd, envToAdd)

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

	if err := installWshInWsl(installCtx, logCtx, wslDistro); err != nil {
		blocklogger.Infof(logCtx, "[conndebug] wsh installation failed for WSL distro %s (non-fatal, continuing without wsh): %v\n", wslDistro, err)
	}

	return StartWslLocalShellProc(logCtx, termSize, cmdStr, cmdOpts, wslDistro)
}
