
//go:build !windows

package wshserver

import (
	"context"
	"fmt"

	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

func (ws *WshServer) WslPathStatCommand(ctx context.Context, data wshrpc.WslPathStatRequest) (*wshrpc.WslPathStatResponse, error) {
	return nil, fmt.Errorf("WslPathStatCommand is only supported on Windows")
}
