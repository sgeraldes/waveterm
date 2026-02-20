
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
	"github.com/wavetermdev/waveterm/pkg/aiusechat"
	"github.com/wavetermdev/waveterm/pkg/authkey"
	"github.com/wavetermdev/waveterm/pkg/blockcontroller"
	"github.com/wavetermdev/waveterm/pkg/blocklogger"
	"github.com/wavetermdev/waveterm/pkg/filebackup"
	"github.com/wavetermdev/waveterm/pkg/filestore"
	"github.com/wavetermdev/waveterm/pkg/jobcontroller"
	"github.com/wavetermdev/waveterm/pkg/panichandler"
	"github.com/wavetermdev/waveterm/pkg/remote/conncontroller"
	"github.com/wavetermdev/waveterm/pkg/remote/fileshare/wshfs"
	"github.com/wavetermdev/waveterm/pkg/secretstore"
	"github.com/wavetermdev/waveterm/pkg/service"
	"github.com/wavetermdev/waveterm/pkg/util/envutil"
	"github.com/wavetermdev/waveterm/pkg/util/shellutil"
	"github.com/wavetermdev/waveterm/pkg/util/sigutil"
	"github.com/wavetermdev/waveterm/pkg/wavebase"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wcloud"
	"github.com/wavetermdev/waveterm/pkg/wconfig"
	"github.com/wavetermdev/waveterm/pkg/wcore"
	"github.com/wavetermdev/waveterm/pkg/web"
	"github.com/wavetermdev/waveterm/pkg/wps"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshremote"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshserver"
	"github.com/wavetermdev/waveterm/pkg/wshutil"
	"github.com/wavetermdev/waveterm/pkg/wstore"

	"net/http"
	_ "net/http/pprof"
)

var WaveVersion = "0.0.0"
var BuildTime = "0"

const BackupCleanupTick = 2 * time.Minute
const BackupCleanupInterval = 4 * time.Hour
const InitialDiagnosticWait = 5 * time.Minute
const DiagnosticTick = 10 * time.Minute

var shutdownOnce sync.Once

var _ = secretstore.CountSecrets
var _ = conncontroller.GetNumSSHHasConnected

func init() {
	envFilePath := os.Getenv("WAVETERM_ENVFILE")
	if envFilePath != "" {
		log.Printf("applying env file: %s\n", envFilePath)
		_ = godotenv.Load(envFilePath)
	}
}

func doShutdown(reason string) {
	shutdownOnce.Do(func() {
		log.Printf("shutting down: %s\n", reason)
		ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelFn()
		go blockcontroller.StopAllBlockControllersForShutdown()
		clearTempFiles()
		filestore.WFS.FlushCache(ctx)
		watcher := wconfig.GetWatcher()
		if watcher != nil {
			watcher.Close()
		}
		time.Sleep(500 * time.Millisecond)
		log.Printf("shutdown complete\n")
		os.Exit(0)
	})
}

func stdinReadWatch() {
	defer func() {
		panichandler.PanicHandler("stdinReadWatch", recover())
	}()
	buf := make([]byte, 1024)
	for {
		_, err := os.Stdin.Read(buf)
		if err != nil {
			doShutdown(fmt.Sprintf("stdin closed/error (%v)", err))
			break
		}
	}
}

func startConfigWatcher() {
	watcher := wconfig.GetWatcher()
	if watcher != nil {
		watcher.Start()
	}
}

func diagnosticLoop() {
	defer func() {
		panichandler.PanicHandler("diagnosticLoop", recover())
	}()
	if os.Getenv("WAVETERM_NOPING") != "" {
		log.Printf("WAVETERM_NOPING set, disabling diagnostic ping\n")
		return
	}
	var lastSentDate string
	time.Sleep(InitialDiagnosticWait)
	for {
		currentDate := time.Now().Format("2006-01-02")
		if lastSentDate == "" || lastSentDate != currentDate {
			if sendDiagnosticPing() {
				lastSentDate = currentDate
			}
		}
		time.Sleep(DiagnosticTick)
	}
}

func sendDiagnosticPing() bool {
	ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelFn()

	rpcClient := wshclient.GetBareRpcClient()
	isOnline, err := wshclient.NetworkOnlineCommand(rpcClient, &wshrpc.RpcOpts{Route: "electron", Timeout: 2000})
	if err != nil || !isOnline {
		return false
	}
	clientId := wstore.GetClientId()
	wcloud.SendDiagnosticPing(ctx, clientId)
	return true
}

func backupCleanupLoop() {
	defer func() {
		panichandler.PanicHandler("backupCleanupLoop", recover())
	}()
	var nextCleanup int64
	for {
		if time.Now().Unix() > nextCleanup {
			nextCleanup = time.Now().Add(BackupCleanupInterval).Unix()
			err := filebackup.CleanupOldBackups()
			if err != nil {
				log.Printf("error cleaning up old backups: %v\n", err)
			}
		}
		time.Sleep(BackupCleanupTick)
	}
}

func createMainWshClient() {
	rpc := wshserver.GetMainRpcClient()
	wshfs.RpcClient = rpc
	wshutil.DefaultRouter.RegisterTrustedLeaf(rpc, wshutil.DefaultRoute)
	wps.Broker.SetClient(wshutil.DefaultRouter)
	localInitialEnv := envutil.PruneInitialEnv(envutil.SliceToMap(os.Environ()))
	sockName := wavebase.GetDomainSocketName()
	remoteImpl := wshremote.MakeRemoteRpcServerImpl(nil, wshutil.DefaultRouter, wshclient.GetBareRpcClient(), true, localInitialEnv, sockName)
	localConnWsh := wshutil.MakeWshRpc(wshrpc.RpcContext{Conn: wshrpc.LocalConnName}, remoteImpl, "conn:local")
	go wshremote.RunSysInfoLoop(localConnWsh, wshrpc.LocalConnName)
	wshutil.DefaultRouter.RegisterTrustedLeaf(localConnWsh, wshutil.MakeConnectionRouteId(wshrpc.LocalConnName))
}

func grabAndRemoveEnvVars() error {
	err := authkey.SetAuthKeyFromEnv()
	if err != nil {
		return fmt.Errorf("setting auth key: %v", err)
	}
	err = wavebase.CacheAndRemoveEnvVars()
	if err != nil {
		return err
	}
	err = wcloud.CacheAndRemoveEnvVars()
	if err != nil {
		return err
	}

	os.Unsetenv("WAVETERM_CLIENTID")
	os.Unsetenv("WAVETERM_WORKSPACEID")
	os.Unsetenv("WAVETERM_TABID")
	os.Unsetenv("WAVETERM_BLOCKID")
	os.Unsetenv("WAVETERM_CONN")
	os.Unsetenv("WAVETERM_JWT")
	os.Unsetenv("WAVETERM_VERSION")

	return nil
}

func clearTempFiles() error {
	ctx, cancelFn := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancelFn()
	client, err := wstore.DBGetSingleton[*waveobj.Client](ctx)
	if err != nil {
		return fmt.Errorf("error getting client: %v", err)
	}
	filestore.WFS.DeleteZone(ctx, client.TempOID)
	return nil
}

func maybeStartPprofServer() {
	settings := wconfig.GetWatcher().GetFullConfig().Settings
	if settings.DebugPprofMemProfileRate != nil {
		runtime.MemProfileRate = *settings.DebugPprofMemProfileRate
		log.Printf("set runtime.MemProfileRate to %d\n", runtime.MemProfileRate)
	}
	if settings.DebugPprofPort == nil {
		return
	}
	pprofPort := *settings.DebugPprofPort
	if pprofPort < 1 || pprofPort > 65535 {
		log.Printf("[error] debug:pprofport must be between 1 and 65535, got %d\n", pprofPort)
		return
	}
	go func() {
		addr := fmt.Sprintf("localhost:%d", pprofPort)
		log.Printf("starting pprof server on %s\n", addr)
		if err := http.ListenAndServe(addr, nil); err != nil {
			log.Printf("[error] pprof server failed: %v\n", err)
		}
	}()
}

// migrateWslBlocks converts legacy wsl:// connection blocks to the new shell profile model.
// Blocks with connection=wsl://<distro> get connection cleared and shell:profile=wsl:<distro> set.
func migrateWslBlocks() {
	ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelFn()
	blocks, err := wstore.DBGetAllObjsByType[*waveobj.Block](ctx, waveobj.OType_Block)
	if err != nil {
		log.Printf("migrateWslBlocks: error getting blocks: %v\n", err)
		return
	}
	for _, block := range blocks {
		conn := block.Meta.GetString(waveobj.MetaKey_Connection, "")
		if len(conn) < 6 || conn[:6] != "wsl://" {
			continue
		}
		distro := conn[6:]
		if distro == "" {
			continue
		}
		profileId := "wsl:" + strings.ToLower(distro)
		oref := waveobj.ORef{OType: waveobj.OType_Block, OID: block.OID}
		newMeta := waveobj.MetaMapType{
			waveobj.MetaKey_Connection:   nil,
			waveobj.MetaKey_ShellProfile: profileId,
		}
		if err := wstore.UpdateObjectMeta(ctx, oref, newMeta, false); err != nil {
			log.Printf("migrateWslBlocks: error updating block %s: %v\n", block.OID, err)
		} else {
			log.Printf("migrateWslBlocks: migrated block %s (wsl://%s -> shell:profile=%s)\n", block.OID, distro, profileId)
		}
	}
}

func main() {
	log.SetFlags(0)
	log.SetPrefix("[wavesrv] ")
	wavebase.WaveVersion = WaveVersion
	wavebase.BuildTime = BuildTime
	wshutil.DefaultRouter = wshutil.NewWshRouter()
	wshutil.DefaultRouter.SetAsRootRouter()

	err := grabAndRemoveEnvVars()
	if err != nil {
		log.Printf("[error] %v\n", err)
		return
	}
	err = service.ValidateServiceMap()
	if err != nil {
		log.Printf("error validating service map: %v\n", err)
		return
	}
	err = wavebase.EnsureWaveDataDir()
	if err != nil {
		log.Printf("error ensuring wave home dir: %v\n", err)
		return
	}
	err = wavebase.EnsureWaveDBDir()
	if err != nil {
		log.Printf("error ensuring wave db dir: %v\n", err)
		return
	}
	err = wavebase.EnsureWaveConfigDir()
	if err != nil {
		log.Printf("error ensuring wave config dir: %v\n", err)
		return
	}

	// TODO: rather than ensure this dir exists, we should let the editor recursively create parent dirs on save
	err = wavebase.EnsureWavePresetsDir()
	if err != nil {
		log.Printf("error ensuring wave presets dir: %v\n", err)
		return
	}
	err = wavebase.EnsureWaveCachesDir()
	if err != nil {
		log.Printf("error ensuring wave caches dir: %v\n", err)
		return
	}
	waveLock, err := wavebase.AcquireWaveLock()
	if err != nil {
		log.Printf("error acquiring wave lock (another instance of Wave is likely running): %v\n", err)
		return
	}
	defer func() {
		err = waveLock.Close()
		if err != nil {
			log.Printf("error releasing wave lock: %v\n", err)
		}
	}()
	log.Printf("wave version: %s (%s)\n", WaveVersion, BuildTime)
	log.Printf("wave data dir: %s\n", wavebase.GetWaveDataDir())
	log.Printf("wave config dir: %s\n", wavebase.GetWaveConfigDir())
	err = filestore.InitFilestore()
	if err != nil {
		log.Printf("error initializing filestore: %v\n", err)
		return
	}
	err = wstore.InitWStore()
	if err != nil {
		log.Printf("error initializing wstore: %v\n", err)
		return
	}
	go func() {
		defer func() {
			panichandler.PanicHandler("InitCustomShellStartupFiles", recover())
		}()
		err := shellutil.InitCustomShellStartupFiles()
		if err != nil {
			log.Printf("error initializing wsh and shell-integration files: %v\n", err)
		}
	}()
	migrateWslBlocks()
	firstLaunch, err := wcore.EnsureInitialData()
	if err != nil {
		log.Printf("error ensuring initial data: %v\n", err)
		return
	}
	if firstLaunch {
		log.Printf("first launch detected")
	}
	ctx, cancelFn := context.WithTimeout(context.Background(), 2*time.Second)
	clientData, err := wstore.DBGetSingleton[*waveobj.Client](ctx)
	cancelFn()
	if err != nil {
		log.Printf("error getting client data: %v\n", err)
		return
	}
	wstore.SetClientId(clientData.OID)
	err = clearTempFiles()
	if err != nil {
		log.Printf("error clearing temp files: %v\n", err)
		return
	}
	err = wcore.InitMainServer()
	if err != nil {
		log.Printf("error initializing mainserver: %v\n", err)
		return
	}

	err = shellutil.FixupWaveZshHistory()
	if err != nil {
		log.Printf("error fixing up wave zsh history: %v\n", err)
	}
	go func() {
		defer func() {
			panichandler.PanicHandler("AutoDetectShells", recover())
		}()
		w := wconfig.GetWatcher()
		if w == nil {
			log.Printf("warning: config watcher not available, skipping shell auto-detection")
			return
		}
		fullConfig := w.GetFullConfig()
		detectedShells, err := shellutil.DetectAllShells(&fullConfig, false)
		if err != nil {
			log.Printf("error detecting shells: %v\n", err)
			return
		}
		profiles := make([]wconfig.ShellProfileType, len(detectedShells))
		for i, shell := range detectedShells {
			profiles[i] = wconfig.ShellProfileType{
				DisplayName:  shell.Name,
				DisplayIcon:  shell.Icon,
				ShellPath:    shell.ShellPath,
				ShellType:    shell.ShellType,
				Source:       shell.Source,
				Autodetected: true,
			}
			if shell.Source == shellutil.ShellSource_Wsl {
				profiles[i].IsWsl = true
				profiles[i].WslDistro = shell.WslDistro
			}
		}
		added, err := wconfig.MergeDetectedShellProfiles(profiles)
		if err != nil {
			log.Printf("error merging shell profiles: %v\n", err)
		} else if added > 0 {
			log.Printf("auto-detected %d new shell profiles\n", added)
		}
	}()
	createMainWshClient()
	sigutil.InstallShutdownSignalHandlers(doShutdown)
	sigutil.InstallSIGUSR1Handler()
	startConfigWatcher()
	aiusechat.InitAIModeConfigWatcher()
	maybeStartPprofServer()
	go stdinReadWatch()
	go diagnosticLoop()
	go backupCleanupLoop()
	blocklogger.InitBlockLogger()
	jobcontroller.InitJobController()
	wcore.InitTabIndicatorStore()
	go func() {
		defer func() {
			panichandler.PanicHandler("GetSystemSummary", recover())
		}()
		wavebase.GetSystemSummary()
	}()

	webListener, err := web.MakeTCPListener("web")
	if err != nil {
		log.Printf("error creating web listener: %v\n", err)
		return
	}
	wsListener, err := web.MakeTCPListener("websocket")
	if err != nil {
		log.Printf("error creating websocket listener: %v\n", err)
		return
	}
	go web.RunWebSocketServer(wsListener)
	unixListener, err := web.MakeUnixListener()
	if err != nil {
		log.Printf("error creating unix listener: %v\n", err)
		return
	}
	go func() {
		if BuildTime == "" {
			BuildTime = "0"
		}
		fmt.Fprintf(os.Stderr, "WAVESRV-ESTART ws:%s web:%s version:%s buildtime:%s\n", wsListener.Addr(), webListener.Addr(), WaveVersion, BuildTime)
	}()
	go wshutil.RunWshRpcOverListener(unixListener)
	web.RunWebServer(webListener)
	runtime.KeepAlive(waveLock)
}
