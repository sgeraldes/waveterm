
//go:build !windows

package shellexec

import (
	"context"
	"fmt"

	"github.com/wavetermdev/waveterm/pkg/waveobj"
)

func StartWslLocalShellProc(logCtx context.Context, termSize waveobj.TermSize, cmdStr string, cmdOpts CommandOptsType, wslDistro string) (*ShellProc, error) {
	return nil, fmt.Errorf("WSL shell processes are only supported on Windows")
}

func StartWslLocalShellProcWithWsh(logCtx context.Context, termSize waveobj.TermSize, cmdStr string, cmdOpts CommandOptsType, wslDistro string) (*ShellProc, error) {
	return nil, fmt.Errorf("WSL shell processes are only supported on Windows")
}
