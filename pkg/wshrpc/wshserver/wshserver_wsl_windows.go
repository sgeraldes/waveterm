
package wshserver

import (
	"context"
	"os"

	"github.com/wavetermdev/waveterm/pkg/util/wslpath"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

func (ws *WshServer) WslPathStatCommand(ctx context.Context, data wshrpc.WslPathStatRequest) (*wshrpc.WslPathStatResponse, error) {
	if data.Distro == "" || data.Path == "" {
		return &wshrpc.WslPathStatResponse{Exists: false}, nil
	}
	uncPath := wslpath.LinuxToUNC(data.Distro, data.Path)
	info, err := os.Stat(uncPath)
	if err != nil {
		if os.IsNotExist(err) {
			return &wshrpc.WslPathStatResponse{Exists: false}, nil
		}
		uncPathFallback := `\\wsl$\` + data.Distro + uncPath[len(`\\wsl.localhost\`+data.Distro):]
		info, err = os.Stat(uncPathFallback)
		if err != nil {
			return &wshrpc.WslPathStatResponse{Exists: false}, nil
		}
	}
	return &wshrpc.WslPathStatResponse{
		Exists:  true,
		IsDir:   info.IsDir(),
		Size:    info.Size(),
		ModTime: info.ModTime().UnixMilli(),
	}, nil
}
