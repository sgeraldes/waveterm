

package wshclient

import (
	"github.com/wavetermdev/waveterm/pkg/wshutil"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wconfig"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wps"
	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
)

func ActivityCommand(w *wshutil.WshRpc, data wshrpc.ActivityUpdate, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "activity", data, opts)
	return err
}

func AiSendMessageCommand(w *wshutil.WshRpc, data wshrpc.AiMessageData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "aisendmessage", data, opts)
	return err
}

func AuthenticateCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) (wshrpc.CommandAuthenticateRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandAuthenticateRtnData](w, "authenticate", data, opts)
	return resp, err
}

func AuthenticateJobManagerCommand(w *wshutil.WshRpc, data wshrpc.CommandAuthenticateJobManagerData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "authenticatejobmanager", data, opts)
	return err
}

func AuthenticateJobManagerVerifyCommand(w *wshutil.WshRpc, data wshrpc.CommandAuthenticateJobManagerData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "authenticatejobmanagerverify", data, opts)
	return err
}

func AuthenticateToJobManagerCommand(w *wshutil.WshRpc, data wshrpc.CommandAuthenticateToJobData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "authenticatetojobmanager", data, opts)
	return err
}

func AuthenticateTokenCommand(w *wshutil.WshRpc, data wshrpc.CommandAuthenticateTokenData, opts *wshrpc.RpcOpts) (wshrpc.CommandAuthenticateRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandAuthenticateRtnData](w, "authenticatetoken", data, opts)
	return resp, err
}

func AuthenticateTokenVerifyCommand(w *wshutil.WshRpc, data wshrpc.CommandAuthenticateTokenData, opts *wshrpc.RpcOpts) (wshrpc.CommandAuthenticateRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandAuthenticateRtnData](w, "authenticatetokenverify", data, opts)
	return resp, err
}

func BlockInfoCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) (*wshrpc.BlockInfoData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.BlockInfoData](w, "blockinfo", data, opts)
	return resp, err
}

func BlocksListCommand(w *wshutil.WshRpc, data wshrpc.BlocksListRequest, opts *wshrpc.RpcOpts) ([]wshrpc.BlocksListEntry, error) {
	resp, err := sendRpcRequestCallHelper[[]wshrpc.BlocksListEntry](w, "blockslist", data, opts)
	return resp, err
}

func CaptureBlockScreenshotCommand(w *wshutil.WshRpc, data wshrpc.CommandCaptureBlockScreenshotData, opts *wshrpc.RpcOpts) (string, error) {
	resp, err := sendRpcRequestCallHelper[string](w, "captureblockscreenshot", data, opts)
	return resp, err
}

func ConnConnectCommand(w *wshutil.WshRpc, data wshrpc.ConnRequest, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "connconnect", data, opts)
	return err
}

func ConnDisconnectCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "conndisconnect", data, opts)
	return err
}

func ConnEnsureCommand(w *wshutil.WshRpc, data wshrpc.ConnExtData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "connensure", data, opts)
	return err
}

func ConnListCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) ([]string, error) {
	resp, err := sendRpcRequestCallHelper[[]string](w, "connlist", nil, opts)
	return resp, err
}

func ConnReinstallWshCommand(w *wshutil.WshRpc, data wshrpc.ConnExtData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "connreinstallwsh", data, opts)
	return err
}

func ConnServerInitCommand(w *wshutil.WshRpc, data wshrpc.CommandConnServerInitData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "connserverinit", data, opts)
	return err
}

func ConnStatusCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) ([]wshrpc.ConnStatus, error) {
	resp, err := sendRpcRequestCallHelper[[]wshrpc.ConnStatus](w, "connstatus", nil, opts)
	return resp, err
}

func ConnUpdateWshCommand(w *wshutil.WshRpc, data wshrpc.RemoteInfo, opts *wshrpc.RpcOpts) (bool, error) {
	resp, err := sendRpcRequestCallHelper[bool](w, "connupdatewsh", data, opts)
	return resp, err
}

func ControlGetRouteIdCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (string, error) {
	resp, err := sendRpcRequestCallHelper[string](w, "controlgetrouteid", nil, opts)
	return resp, err
}

func ControllerAppendOutputCommand(w *wshutil.WshRpc, data wshrpc.CommandControllerAppendOutputData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "controllerappendoutput", data, opts)
	return err
}

func ControllerDestroyCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "controllerdestroy", data, opts)
	return err
}

func ControllerInputCommand(w *wshutil.WshRpc, data wshrpc.CommandBlockInputData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "controllerinput", data, opts)
	return err
}

func ControllerResyncCommand(w *wshutil.WshRpc, data wshrpc.CommandControllerResyncData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "controllerresync", data, opts)
	return err
}

func CreateBlockCommand(w *wshutil.WshRpc, data wshrpc.CommandCreateBlockData, opts *wshrpc.RpcOpts) (waveobj.ORef, error) {
	resp, err := sendRpcRequestCallHelper[waveobj.ORef](w, "createblock", data, opts)
	return resp, err
}

func CreateSubBlockCommand(w *wshutil.WshRpc, data wshrpc.CommandCreateSubBlockData, opts *wshrpc.RpcOpts) (waveobj.ORef, error) {
	resp, err := sendRpcRequestCallHelper[waveobj.ORef](w, "createsubblock", data, opts)
	return resp, err
}

func DeleteBlockCommand(w *wshutil.WshRpc, data wshrpc.CommandDeleteBlockData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "deleteblock", data, opts)
	return err
}

func DeleteShellProfileCommand(w *wshutil.WshRpc, data wshrpc.DeleteShellProfileRequest, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "deleteshellprofile", data, opts)
	return err
}

func DeleteSubBlockCommand(w *wshutil.WshRpc, data wshrpc.CommandDeleteBlockData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "deletesubblock", data, opts)
	return err
}

func DetectAvailableShellsCommand(w *wshutil.WshRpc, data wshrpc.DetectShellsRequest, opts *wshrpc.RpcOpts) (wshrpc.DetectShellsResponse, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.DetectShellsResponse](w, "detectavailableshells", data, opts)
	return resp, err
}

func DismissWshFailCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "dismisswshfail", data, opts)
	return err
}

func DisposeCommand(w *wshutil.WshRpc, data wshrpc.CommandDisposeData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "dispose", data, opts)
	return err
}

func DisposeSuggestionsCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "disposesuggestions", data, opts)
	return err
}

func ElectronDecryptCommand(w *wshutil.WshRpc, data wshrpc.CommandElectronDecryptData, opts *wshrpc.RpcOpts) (*wshrpc.CommandElectronDecryptRtnData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.CommandElectronDecryptRtnData](w, "electrondecrypt", data, opts)
	return resp, err
}

func ElectronEncryptCommand(w *wshutil.WshRpc, data wshrpc.CommandElectronEncryptData, opts *wshrpc.RpcOpts) (*wshrpc.CommandElectronEncryptRtnData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.CommandElectronEncryptRtnData](w, "electronencrypt", data, opts)
	return resp, err
}

func ElectronSystemBellCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "electronsystembell", nil, opts)
	return err
}

func EventPublishCommand(w *wshutil.WshRpc, data wps.WaveEvent, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "eventpublish", data, opts)
	return err
}

func EventReadHistoryCommand(w *wshutil.WshRpc, data wshrpc.CommandEventReadHistoryData, opts *wshrpc.RpcOpts) ([]*wps.WaveEvent, error) {
	resp, err := sendRpcRequestCallHelper[[]*wps.WaveEvent](w, "eventreadhistory", data, opts)
	return resp, err
}

func EventRecvCommand(w *wshutil.WshRpc, data wps.WaveEvent, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "eventrecv", data, opts)
	return err
}

func EventSubCommand(w *wshutil.WshRpc, data wps.SubscriptionRequest, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "eventsub", data, opts)
	return err
}

func EventUnsubCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "eventunsub", data, opts)
	return err
}

func EventUnsubAllCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "eventunsuball", nil, opts)
	return err
}

func FetchSuggestionsCommand(w *wshutil.WshRpc, data wshrpc.FetchSuggestionsData, opts *wshrpc.RpcOpts) (*wshrpc.FetchSuggestionsResponse, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.FetchSuggestionsResponse](w, "fetchsuggestions", data, opts)
	return resp, err
}

func FileAppendCommand(w *wshutil.WshRpc, data wshrpc.FileData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "fileappend", data, opts)
	return err
}

func FileCopyCommand(w *wshutil.WshRpc, data wshrpc.CommandFileCopyData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "filecopy", data, opts)
	return err
}

func FileCreateCommand(w *wshutil.WshRpc, data wshrpc.FileData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "filecreate", data, opts)
	return err
}

func FileDeleteCommand(w *wshutil.WshRpc, data wshrpc.CommandDeleteFileData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "filedelete", data, opts)
	return err
}

func FileInfoCommand(w *wshutil.WshRpc, data wshrpc.FileData, opts *wshrpc.RpcOpts) (*wshrpc.FileInfo, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.FileInfo](w, "fileinfo", data, opts)
	return resp, err
}

func FileJoinCommand(w *wshutil.WshRpc, data []string, opts *wshrpc.RpcOpts) (*wshrpc.FileInfo, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.FileInfo](w, "filejoin", data, opts)
	return resp, err
}

func FileListCommand(w *wshutil.WshRpc, data wshrpc.FileListData, opts *wshrpc.RpcOpts) ([]*wshrpc.FileInfo, error) {
	resp, err := sendRpcRequestCallHelper[[]*wshrpc.FileInfo](w, "filelist", data, opts)
	return resp, err
}

func FileListStreamCommand(w *wshutil.WshRpc, data wshrpc.FileListData, opts *wshrpc.RpcOpts) chan wshrpc.RespOrErrorUnion[wshrpc.CommandRemoteListEntriesRtnData] {
	return sendRpcRequestResponseStreamHelper[wshrpc.CommandRemoteListEntriesRtnData](w, "fileliststream", data, opts)
}

func FileMkdirCommand(w *wshutil.WshRpc, data wshrpc.FileData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "filemkdir", data, opts)
	return err
}

func FileMoveCommand(w *wshutil.WshRpc, data wshrpc.CommandFileCopyData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "filemove", data, opts)
	return err
}

func FileReadCommand(w *wshutil.WshRpc, data wshrpc.FileData, opts *wshrpc.RpcOpts) (*wshrpc.FileData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.FileData](w, "fileread", data, opts)
	return resp, err
}

func FileReadStreamCommand(w *wshutil.WshRpc, data wshrpc.FileData, opts *wshrpc.RpcOpts) chan wshrpc.RespOrErrorUnion[wshrpc.FileData] {
	return sendRpcRequestResponseStreamHelper[wshrpc.FileData](w, "filereadstream", data, opts)
}

func FileRestoreBackupCommand(w *wshutil.WshRpc, data wshrpc.CommandFileRestoreBackupData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "filerestorebackup", data, opts)
	return err
}

func FileWriteCommand(w *wshutil.WshRpc, data wshrpc.FileData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "filewrite", data, opts)
	return err
}

func FindGitBashCommand(w *wshutil.WshRpc, data bool, opts *wshrpc.RpcOpts) (string, error) {
	resp, err := sendRpcRequestCallHelper[string](w, "findgitbash", data, opts)
	return resp, err
}

func FocusWindowCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "focuswindow", data, opts)
	return err
}

func GetAllTabIndicatorsCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (map[string]*wshrpc.TabIndicator, error) {
	resp, err := sendRpcRequestCallHelper[map[string]*wshrpc.TabIndicator](w, "getalltabindicators", nil, opts)
	return resp, err
}

func GetAllVarsCommand(w *wshutil.WshRpc, data wshrpc.CommandVarData, opts *wshrpc.RpcOpts) ([]wshrpc.CommandVarResponseData, error) {
	resp, err := sendRpcRequestCallHelper[[]wshrpc.CommandVarResponseData](w, "getallvars", data, opts)
	return resp, err
}

func GetFullConfigCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (wconfig.FullConfigType, error) {
	resp, err := sendRpcRequestCallHelper[wconfig.FullConfigType](w, "getfullconfig", nil, opts)
	return resp, err
}

func GetJwtPublicKeyCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (string, error) {
	resp, err := sendRpcRequestCallHelper[string](w, "getjwtpublickey", nil, opts)
	return resp, err
}

func GetMetaCommand(w *wshutil.WshRpc, data wshrpc.CommandGetMetaData, opts *wshrpc.RpcOpts) (waveobj.MetaMapType, error) {
	resp, err := sendRpcRequestCallHelper[waveobj.MetaMapType](w, "getmeta", data, opts)
	return resp, err
}

func GetRTInfoCommand(w *wshutil.WshRpc, data wshrpc.CommandGetRTInfoData, opts *wshrpc.RpcOpts) (*waveobj.ObjRTInfo, error) {
	resp, err := sendRpcRequestCallHelper[*waveobj.ObjRTInfo](w, "getrtinfo", data, opts)
	return resp, err
}

func GetSecretsCommand(w *wshutil.WshRpc, data []string, opts *wshrpc.RpcOpts) (map[string]string, error) {
	resp, err := sendRpcRequestCallHelper[map[string]string](w, "getsecrets", data, opts)
	return resp, err
}

func GetSecretsLinuxStorageBackendCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (string, error) {
	resp, err := sendRpcRequestCallHelper[string](w, "getsecretslinuxstoragebackend", nil, opts)
	return resp, err
}

func GetSecretsNamesCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) ([]string, error) {
	resp, err := sendRpcRequestCallHelper[[]string](w, "getsecretsnames", nil, opts)
	return resp, err
}

func GetTabCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) (*waveobj.Tab, error) {
	resp, err := sendRpcRequestCallHelper[*waveobj.Tab](w, "gettab", data, opts)
	return resp, err
}

func GetTempDirCommand(w *wshutil.WshRpc, data wshrpc.CommandGetTempDirData, opts *wshrpc.RpcOpts) (string, error) {
	resp, err := sendRpcRequestCallHelper[string](w, "gettempdir", data, opts)
	return resp, err
}

func GetUpdateChannelCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (string, error) {
	resp, err := sendRpcRequestCallHelper[string](w, "getupdatechannel", nil, opts)
	return resp, err
}

func GetVarCommand(w *wshutil.WshRpc, data wshrpc.CommandVarData, opts *wshrpc.RpcOpts) (*wshrpc.CommandVarResponseData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.CommandVarResponseData](w, "getvar", data, opts)
	return resp, err
}

func GetWaveAIChatCommand(w *wshutil.WshRpc, data wshrpc.CommandGetWaveAIChatData, opts *wshrpc.RpcOpts) (*uctypes.UIChat, error) {
	resp, err := sendRpcRequestCallHelper[*uctypes.UIChat](w, "getwaveaichat", data, opts)
	return resp, err
}

func GetWaveAIModeConfigCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (wconfig.AIModeConfigUpdate, error) {
	resp, err := sendRpcRequestCallHelper[wconfig.AIModeConfigUpdate](w, "getwaveaimodeconfig", nil, opts)
	return resp, err
}

func GetWaveAIRateLimitCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (*uctypes.RateLimitInfo, error) {
	resp, err := sendRpcRequestCallHelper[*uctypes.RateLimitInfo](w, "getwaveairatelimit", nil, opts)
	return resp, err
}

func JobCmdExitedCommand(w *wshutil.WshRpc, data wshrpc.CommandJobCmdExitedData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "jobcmdexited", data, opts)
	return err
}

func JobControllerAttachJobCommand(w *wshutil.WshRpc, data wshrpc.CommandJobControllerAttachJobData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "jobcontrollerattachjob", data, opts)
	return err
}

func JobControllerConnectedJobsCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) ([]string, error) {
	resp, err := sendRpcRequestCallHelper[[]string](w, "jobcontrollerconnectedjobs", nil, opts)
	return resp, err
}

func JobControllerDeleteJobCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "jobcontrollerdeletejob", data, opts)
	return err
}

func JobControllerDetachJobCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "jobcontrollerdetachjob", data, opts)
	return err
}

func JobControllerDisconnectJobCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "jobcontrollerdisconnectjob", data, opts)
	return err
}

func JobControllerExitJobCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "jobcontrollerexitjob", data, opts)
	return err
}

func JobControllerListCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) ([]*waveobj.Job, error) {
	resp, err := sendRpcRequestCallHelper[[]*waveobj.Job](w, "jobcontrollerlist", nil, opts)
	return resp, err
}

func JobControllerReconnectJobCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "jobcontrollerreconnectjob", data, opts)
	return err
}

func JobControllerReconnectJobsForConnCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "jobcontrollerreconnectjobsforconn", data, opts)
	return err
}

func JobControllerStartJobCommand(w *wshutil.WshRpc, data wshrpc.CommandJobControllerStartJobData, opts *wshrpc.RpcOpts) (string, error) {
	resp, err := sendRpcRequestCallHelper[string](w, "jobcontrollerstartjob", data, opts)
	return resp, err
}

func JobInputCommand(w *wshutil.WshRpc, data wshrpc.CommandJobInputData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "jobinput", data, opts)
	return err
}

func JobPrepareConnectCommand(w *wshutil.WshRpc, data wshrpc.CommandJobPrepareConnectData, opts *wshrpc.RpcOpts) (*wshrpc.CommandJobConnectRtnData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.CommandJobConnectRtnData](w, "jobprepareconnect", data, opts)
	return resp, err
}

func JobStartStreamCommand(w *wshutil.WshRpc, data wshrpc.CommandJobStartStreamData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "jobstartstream", data, opts)
	return err
}

func MergeShellProfilesCommand(w *wshutil.WshRpc, data wshrpc.MergeShellProfilesRequest, opts *wshrpc.RpcOpts) (wshrpc.MergeShellProfilesResponse, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.MergeShellProfilesResponse](w, "mergeshellprofiles", data, opts)
	return resp, err
}

func MessageCommand(w *wshutil.WshRpc, data wshrpc.CommandMessageData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "message", data, opts)
	return err
}

func NetworkOnlineCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (bool, error) {
	resp, err := sendRpcRequestCallHelper[bool](w, "networkonline", nil, opts)
	return resp, err
}

func NotifyCommand(w *wshutil.WshRpc, data wshrpc.WaveNotificationOptions, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "notify", data, opts)
	return err
}

func OmpAnalyzeCommand(w *wshutil.WshRpc, data wshrpc.CommandOmpAnalyzeData, opts *wshrpc.RpcOpts) (wshrpc.CommandOmpAnalyzeRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandOmpAnalyzeRtnData](w, "ompanalyze", data, opts)
	return resp, err
}

func OmpApplyHighContrastCommand(w *wshutil.WshRpc, data wshrpc.CommandOmpApplyHighContrastData, opts *wshrpc.RpcOpts) (wshrpc.CommandOmpApplyHighContrastRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandOmpApplyHighContrastRtnData](w, "ompapplyhighcontrast", data, opts)
	return resp, err
}

func OmpGetConfigInfoCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (wshrpc.CommandOmpGetConfigInfoRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandOmpGetConfigInfoRtnData](w, "ompgetconfiginfo", nil, opts)
	return resp, err
}

func OmpReadConfigCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (wshrpc.CommandOmpReadConfigRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandOmpReadConfigRtnData](w, "ompreadconfig", nil, opts)
	return resp, err
}

func OmpReinitCommand(w *wshutil.WshRpc, data wshrpc.CommandOmpReinitData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "ompreinit", data, opts)
	return err
}

func OmpRestoreBackupCommand(w *wshutil.WshRpc, data wshrpc.CommandOmpRestoreBackupData, opts *wshrpc.RpcOpts) (wshrpc.CommandOmpRestoreBackupRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandOmpRestoreBackupRtnData](w, "omprestorebackup", data, opts)
	return resp, err
}

func OmpWriteConfigCommand(w *wshutil.WshRpc, data wshrpc.CommandOmpWriteConfigData, opts *wshrpc.RpcOpts) (wshrpc.CommandOmpWriteConfigRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandOmpWriteConfigRtnData](w, "ompwriteconfig", data, opts)
	return resp, err
}

func OmpWritePaletteCommand(w *wshutil.WshRpc, data wshrpc.CommandOmpWritePaletteData, opts *wshrpc.RpcOpts) (wshrpc.CommandOmpWritePaletteRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandOmpWritePaletteRtnData](w, "ompwritepalette", data, opts)
	return resp, err
}

func PathCommand(w *wshutil.WshRpc, data wshrpc.PathCommandData, opts *wshrpc.RpcOpts) (string, error) {
	resp, err := sendRpcRequestCallHelper[string](w, "path", data, opts)
	return resp, err
}

func RemoteDisconnectFromJobManagerCommand(w *wshutil.WshRpc, data wshrpc.CommandRemoteDisconnectFromJobManagerData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "remotedisconnectfromjobmanager", data, opts)
	return err
}

func RemoteFileCopyCommand(w *wshutil.WshRpc, data wshrpc.CommandFileCopyData, opts *wshrpc.RpcOpts) (bool, error) {
	resp, err := sendRpcRequestCallHelper[bool](w, "remotefilecopy", data, opts)
	return resp, err
}

func RemoteFileDeleteCommand(w *wshutil.WshRpc, data wshrpc.CommandDeleteFileData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "remotefiledelete", data, opts)
	return err
}

func RemoteFileInfoCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) (*wshrpc.FileInfo, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.FileInfo](w, "remotefileinfo", data, opts)
	return resp, err
}

func RemoteFileJoinCommand(w *wshutil.WshRpc, data []string, opts *wshrpc.RpcOpts) (*wshrpc.FileInfo, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.FileInfo](w, "remotefilejoin", data, opts)
	return resp, err
}

func RemoteFileMoveCommand(w *wshutil.WshRpc, data wshrpc.CommandFileCopyData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "remotefilemove", data, opts)
	return err
}

func RemoteFileTouchCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "remotefiletouch", data, opts)
	return err
}

func RemoteGetInfoCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (wshrpc.RemoteInfo, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.RemoteInfo](w, "remotegetinfo", nil, opts)
	return resp, err
}

func RemoteInstallRcFilesCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "remoteinstallrcfiles", nil, opts)
	return err
}

func RemoteListEntriesCommand(w *wshutil.WshRpc, data wshrpc.CommandRemoteListEntriesData, opts *wshrpc.RpcOpts) chan wshrpc.RespOrErrorUnion[wshrpc.CommandRemoteListEntriesRtnData] {
	return sendRpcRequestResponseStreamHelper[wshrpc.CommandRemoteListEntriesRtnData](w, "remotelistentries", data, opts)
}

func RemoteMkdirCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "remotemkdir", data, opts)
	return err
}

func RemoteReconnectToJobManagerCommand(w *wshutil.WshRpc, data wshrpc.CommandRemoteReconnectToJobManagerData, opts *wshrpc.RpcOpts) (*wshrpc.CommandRemoteReconnectToJobManagerRtnData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.CommandRemoteReconnectToJobManagerRtnData](w, "remotereconnecttojobmanager", data, opts)
	return resp, err
}

func RemoteStartJobCommand(w *wshutil.WshRpc, data wshrpc.CommandRemoteStartJobData, opts *wshrpc.RpcOpts) (*wshrpc.CommandStartJobRtnData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.CommandStartJobRtnData](w, "remotestartjob", data, opts)
	return resp, err
}

func RemoteStreamCpuDataCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) chan wshrpc.RespOrErrorUnion[wshrpc.TimeSeriesData] {
	return sendRpcRequestResponseStreamHelper[wshrpc.TimeSeriesData](w, "remotestreamcpudata", nil, opts)
}

func RemoteStreamFileCommand(w *wshutil.WshRpc, data wshrpc.CommandRemoteStreamFileData, opts *wshrpc.RpcOpts) chan wshrpc.RespOrErrorUnion[wshrpc.FileData] {
	return sendRpcRequestResponseStreamHelper[wshrpc.FileData](w, "remotestreamfile", data, opts)
}

func RemoteTerminateJobManagerCommand(w *wshutil.WshRpc, data wshrpc.CommandRemoteTerminateJobManagerData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "remoteterminatejobmanager", data, opts)
	return err
}

func RemoteWriteFileCommand(w *wshutil.WshRpc, data wshrpc.FileData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "remotewritefile", data, opts)
	return err
}

func ResolveIdsCommand(w *wshutil.WshRpc, data wshrpc.CommandResolveIdsData, opts *wshrpc.RpcOpts) (wshrpc.CommandResolveIdsRtnData, error) {
	resp, err := sendRpcRequestCallHelper[wshrpc.CommandResolveIdsRtnData](w, "resolveids", data, opts)
	return resp, err
}

func RouteAnnounceCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "routeannounce", nil, opts)
	return err
}

func RouteUnannounceCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "routeunannounce", nil, opts)
	return err
}

func SetConfigCommand(w *wshutil.WshRpc, data wshrpc.MetaSettingsType, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "setconfig", data, opts)
	return err
}

func SetConnectionsConfigCommand(w *wshutil.WshRpc, data wshrpc.ConnConfigRequest, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "setconnectionsconfig", data, opts)
	return err
}

func SetMetaCommand(w *wshutil.WshRpc, data wshrpc.CommandSetMetaData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "setmeta", data, opts)
	return err
}

func SetPeerInfoCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "setpeerinfo", data, opts)
	return err
}

func SetRTInfoCommand(w *wshutil.WshRpc, data wshrpc.CommandSetRTInfoData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "setrtinfo", data, opts)
	return err
}

func SetSecretsCommand(w *wshutil.WshRpc, data map[string]*string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "setsecrets", data, opts)
	return err
}

func SetShellProfileCommand(w *wshutil.WshRpc, data wshrpc.SetShellProfileRequest, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "setshellprofile", data, opts)
	return err
}

func SetVarCommand(w *wshutil.WshRpc, data wshrpc.CommandVarData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "setvar", data, opts)
	return err
}

func StartJobCommand(w *wshutil.WshRpc, data wshrpc.CommandStartJobData, opts *wshrpc.RpcOpts) (*wshrpc.CommandStartJobRtnData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.CommandStartJobRtnData](w, "startjob", data, opts)
	return resp, err
}

func StreamCpuDataCommand(w *wshutil.WshRpc, data wshrpc.CpuDataRequest, opts *wshrpc.RpcOpts) chan wshrpc.RespOrErrorUnion[wshrpc.TimeSeriesData] {
	return sendRpcRequestResponseStreamHelper[wshrpc.TimeSeriesData](w, "streamcpudata", data, opts)
}

func StreamDataCommand(w *wshutil.WshRpc, data wshrpc.CommandStreamData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "streamdata", data, opts)
	return err
}

func StreamDataAckCommand(w *wshutil.WshRpc, data wshrpc.CommandStreamAckData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "streamdataack", data, opts)
	return err
}

func StreamTestCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) chan wshrpc.RespOrErrorUnion[int] {
	return sendRpcRequestResponseStreamHelper[int](w, "streamtest", nil, opts)
}

func StreamWaveAiCommand(w *wshutil.WshRpc, data wshrpc.WaveAIStreamRequest, opts *wshrpc.RpcOpts) chan wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType] {
	return sendRpcRequestResponseStreamHelper[wshrpc.WaveAIPacketType](w, "streamwaveai", data, opts)
}

func TermGetScrollbackLinesCommand(w *wshutil.WshRpc, data wshrpc.CommandTermGetScrollbackLinesData, opts *wshrpc.RpcOpts) (*wshrpc.CommandTermGetScrollbackLinesRtnData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.CommandTermGetScrollbackLinesRtnData](w, "termgetscrollbacklines", data, opts)
	return resp, err
}

func TermUpdateAttachedJobCommand(w *wshutil.WshRpc, data wshrpc.CommandTermUpdateAttachedJobData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "termupdateattachedjob", data, opts)
	return err
}

func TestCommand(w *wshutil.WshRpc, data string, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "test", data, opts)
	return err
}

func WaitForRouteCommand(w *wshutil.WshRpc, data wshrpc.CommandWaitForRouteData, opts *wshrpc.RpcOpts) (bool, error) {
	resp, err := sendRpcRequestCallHelper[bool](w, "waitforroute", data, opts)
	return resp, err
}

func WaveAIAddContextCommand(w *wshutil.WshRpc, data wshrpc.CommandWaveAIAddContextData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "waveaiaddcontext", data, opts)
	return err
}

func WaveAIGetToolDiffCommand(w *wshutil.WshRpc, data wshrpc.CommandWaveAIGetToolDiffData, opts *wshrpc.RpcOpts) (*wshrpc.CommandWaveAIGetToolDiffRtnData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.CommandWaveAIGetToolDiffRtnData](w, "waveaigettooldiff", data, opts)
	return resp, err
}

func WaveAIToolApproveCommand(w *wshutil.WshRpc, data wshrpc.CommandWaveAIToolApproveData, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "waveaitoolapprove", data, opts)
	return err
}

func WaveFileReadStreamCommand(w *wshutil.WshRpc, data wshrpc.CommandWaveFileReadStreamData, opts *wshrpc.RpcOpts) (*wshrpc.WaveFileInfo, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.WaveFileInfo](w, "wavefilereadstream", data, opts)
	return resp, err
}

func WaveInfoCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) (*wshrpc.WaveInfoData, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.WaveInfoData](w, "waveinfo", nil, opts)
	return resp, err
}

func WebSelectorCommand(w *wshutil.WshRpc, data wshrpc.CommandWebSelectorData, opts *wshrpc.RpcOpts) ([]string, error) {
	resp, err := sendRpcRequestCallHelper[[]string](w, "webselector", data, opts)
	return resp, err
}

func WorkspaceListCommand(w *wshutil.WshRpc, opts *wshrpc.RpcOpts) ([]wshrpc.WorkspaceInfoData, error) {
	resp, err := sendRpcRequestCallHelper[[]wshrpc.WorkspaceInfoData](w, "workspacelist", nil, opts)
	return resp, err
}

func WriteTempFileCommand(w *wshutil.WshRpc, data wshrpc.CommandWriteTempFileData, opts *wshrpc.RpcOpts) (string, error) {
	resp, err := sendRpcRequestCallHelper[string](w, "writetempfile", data, opts)
	return resp, err
}

func WshActivityCommand(w *wshutil.WshRpc, data map[string]int, opts *wshrpc.RpcOpts) error {
	_, err := sendRpcRequestCallHelper[any](w, "wshactivity", data, opts)
	return err
}

func WslPathStatCommand(w *wshutil.WshRpc, data wshrpc.WslPathStatRequest, opts *wshrpc.RpcOpts) (*wshrpc.WslPathStatResponse, error) {
	resp, err := sendRpcRequestCallHelper[*wshrpc.WslPathStatResponse](w, "wslpathstat", data, opts)
	return resp, err
}


