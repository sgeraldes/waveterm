
package wslutil

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"text/template"
	"time"

	"github.com/wavetermdev/waveterm/pkg/blocklogger"
	"github.com/wavetermdev/waveterm/pkg/genconn"
	"github.com/wavetermdev/waveterm/pkg/panichandler"
	"github.com/wavetermdev/waveterm/pkg/util/shellutil"
	"github.com/wavetermdev/waveterm/pkg/wavebase"
	"github.com/wavetermdev/waveterm/pkg/wconfig"
	"github.com/wavetermdev/waveterm/pkg/wsl"
)

func hasBashInstalled(ctx context.Context, client *wsl.Distro) (bool, error) {
	cmd := client.WslCommand(ctx, "which bash")
	out, whichErr := cmd.Output()
	if whichErr == nil && len(out) != 0 {
		return true, nil
	}

	cmd = client.WslCommand(ctx, "where.exe bash")
	out, whereErr := cmd.Output()
	if whereErr == nil && len(out) != 0 {
		return true, nil
	}

	return false, nil
}

func normalizeOs(osStr string) string {
	osStr = strings.ToLower(strings.TrimSpace(osStr))
	return osStr
}

func normalizeArch(arch string) string {
	arch = strings.ToLower(strings.TrimSpace(arch))
	switch arch {
	case "x86_64", "amd64":
		arch = "x64"
	case "arm64", "aarch64":
		arch = "arm64"
	}
	return arch
}

func GetClientPlatform(ctx context.Context, shell genconn.ShellClient) (string, string, error) {
	blocklogger.Infof(ctx, "[conndebug] running `uname -sm` to detect client platform\n")
	stdout, stderr, err := genconn.RunSimpleCommand(ctx, shell, genconn.CommandSpec{
		Cmd: "uname -sm",
	})
	if err != nil {
		return "", "", fmt.Errorf("error running uname -sm: %w, stderr: %s", err, stderr)
	}
	parts := strings.Fields(strings.ToLower(strings.TrimSpace(stdout)))
	if len(parts) != 2 {
		return "", "", fmt.Errorf("unexpected output from uname: %s", stdout)
	}
	osStr, arch := normalizeOs(parts[0]), normalizeArch(parts[1])
	if err := wavebase.ValidateWshSupportedArch(osStr, arch); err != nil {
		return "", "", err
	}
	return osStr, arch, nil
}

func GetClientPlatformFromOsArchStr(ctx context.Context, osArchStr string) (string, string, error) {
	parts := strings.Fields(strings.TrimSpace(osArchStr))
	if len(parts) != 2 {
		return "", "", fmt.Errorf("unexpected output from uname: %s", osArchStr)
	}
	osStr, arch := normalizeOs(parts[0]), normalizeArch(parts[1])
	if err := wavebase.ValidateWshSupportedArch(osStr, arch); err != nil {
		return "", "", err
	}
	return osStr, arch, nil
}

type cancellableCmd struct {
	Cmd    *wsl.WslCmd
	Cancel func()
}

var installTemplatesRawBash = map[string]string{
	"mkdir": `bash -c 'mkdir -p {{.installDir}}'`,
	"cat":   `bash -c 'cat > {{.tempPath}}'`,
	"mv":    `bash -c 'mv {{.tempPath}} {{.installPath}}'`,
	"chmod": `bash -c 'chmod a+x {{.installPath}}'`,
}

var installTemplatesRawDefault = map[string]string{
	"mkdir": `mkdir -p {{.installDir}}`,
	"cat":   `cat > {{.tempPath}}`,
	"mv":    `mv {{.tempPath}} {{.installPath}}`,
	"chmod": `chmod a+x {{.installPath}}`,
}

func makeCancellableCommand(ctx context.Context, client *wsl.Distro, cmdTemplateRaw string, words map[string]string) (*cancellableCmd, error) {
	cmdContext, cmdCancel := context.WithCancel(ctx)

	cmdStr := &bytes.Buffer{}
	cmdTemplate, err := template.New("").Parse(cmdTemplateRaw)
	if err != nil {
		cmdCancel()
		return nil, err
	}
	if err := cmdTemplate.Execute(cmdStr, words); err != nil {
		cmdCancel()
		return nil, fmt.Errorf("template execution failed: %w", err)
	}

	cmd := client.WslCommand(cmdContext, cmdStr.String())
	return &cancellableCmd{cmd, cmdCancel}, nil
}

// DistroExists checks if a WSL distribution is registered on the system
func DistroExists(ctx context.Context, distroName string) (bool, error) {
	distros, err := wsl.RegisteredDistros(ctx)
	if err != nil {
		return false, fmt.Errorf("failed to list WSL distributions: %w", err)
	}
	for _, distro := range distros {
		if distro.Name() == distroName {
			return true, nil
		}
	}
	return false, nil
}

// CheckWslShellProfileExists verifies a shell profile references an existing WSL distribution
func CheckWslShellProfileExists(ctx context.Context, profile *wconfig.ShellProfileType) error {
	if profile == nil || !profile.IsWsl || profile.WslDistro == "" {
		return nil
	}
	exists, err := DistroExists(ctx, profile.WslDistro)
	if err != nil {
		return fmt.Errorf("failed to check WSL distribution %q: %w", profile.WslDistro, err)
	}
	if !exists {
		return fmt.Errorf("WSL distribution %q not found (may have been uninstalled)", profile.WslDistro)
	}
	return nil
}

func CpWshToRemote(ctx context.Context, client *wsl.Distro, clientOs string, clientArch string) error {
	wshLocalPath, err := shellutil.GetLocalWshBinaryPath(wavebase.WaveVersion, clientOs, clientArch)
	if err != nil {
		return err
	}
	bashInstalled, err := hasBashInstalled(ctx, client)
	if err != nil {
		return err
	}

	var selectedTemplatesRaw map[string]string
	if bashInstalled {
		selectedTemplatesRaw = installTemplatesRawBash
	} else {
		log.Printf("bash is not installed on remote. attempting with default shell")
		selectedTemplatesRaw = installTemplatesRawDefault
	}

	var installWords = map[string]string{
		"installDir":  filepath.ToSlash(filepath.Dir(wavebase.RemoteFullWshBinPath)),
		"tempPath":    wavebase.RemoteFullWshBinPath + ".temp",
		"installPath": wavebase.RemoteFullWshBinPath,
	}

	blocklogger.Infof(ctx, "[conndebug] copying %q to remote server %q\n", wshLocalPath, wavebase.RemoteFullWshBinPath)
	installStepCmds := make(map[string]*cancellableCmd)
	for cmdName, selectedTemplateRaw := range selectedTemplatesRaw {
		cancellableCmd, err := makeCancellableCommand(ctx, client, selectedTemplateRaw, installWords)
		if err != nil {
			return err
		}
		installStepCmds[cmdName] = cancellableCmd
	}

	_, err = installStepCmds["mkdir"].Cmd.Output()
	if err != nil {
		return err
	}

	catCmd := installStepCmds["cat"].Cmd
	catStdin, err := catCmd.StdinPipe()
	if err != nil {
		return err
	}
	err = catCmd.Start()
	if err != nil {
		return err
	}
	input, err := os.Open(wshLocalPath)
	if err != nil {
		return fmt.Errorf("cannot open local file %s to send to host: %v", wshLocalPath, err)
	}
	go func() {
		defer func() {
			panichandler.PanicHandler("wslutil:cpHostToRemote:catStdin", recover())
		}()
		io.Copy(catStdin, input)
		installStepCmds["cat"].Cancel()

		time.Sleep(time.Second * 1)
		process := catCmd.GetProcess()
		if process != nil {
			process.Kill()
		}
	}()
	catErr := catCmd.Wait()
	if catErr != nil && !errors.Is(catErr, context.Canceled) {
		return catErr
	}

	_, err = installStepCmds["mv"].Cmd.Output()
	if err != nil {
		return err
	}

	_, err = installStepCmds["chmod"].Cmd.Output()
	if err != nil {
		return err
	}

	return nil
}
