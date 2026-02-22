
package wconfig

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/wavetermdev/waveterm/pkg/util/utilfn"
	"github.com/wavetermdev/waveterm/pkg/wavebase"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wconfig/defaultconfig"
)

const SettingsFile = "settings.json"
const ConnectionsFile = "connections.json"
const ProfilesFile = "profiles.json"

const AnySchema = `
{
  "type": "object",
  "additionalProperties": true
}
`

type AiSettingsType struct {
	AiClear         bool    `json:"ai:*,omitempty"`
	AiPreset        string  `json:"ai:preset,omitempty"`
	AiApiType       string  `json:"ai:apitype,omitempty"`
	AiBaseURL       string  `json:"ai:baseurl,omitempty"`
	AiApiToken      string  `json:"ai:apitoken,omitempty"`
	AiName          string  `json:"ai:name,omitempty"`
	AiModel         string  `json:"ai:model,omitempty"`
	AiOrgID         string  `json:"ai:orgid,omitempty"`
	AIApiVersion    string  `json:"ai:apiversion,omitempty"`
	AiMaxTokens     float64 `json:"ai:maxtokens,omitempty"`
	AiTimeoutMs     float64 `json:"ai:timeoutms,omitempty"`
	AiProxyUrl      string  `json:"ai:proxyurl,omitempty"`
	AiFontSize      float64 `json:"ai:fontsize,omitempty"`
	AiFixedFontSize float64 `json:"ai:fixedfontsize,omitempty"`
	DisplayName     string  `json:"display:name,omitempty"`
	DisplayOrder    float64 `json:"display:order,omitempty"`
}

type SettingsType struct {
	AppClear                      bool   `json:"app:*,omitempty"`
	AppGlobalHotkey               string `json:"app:globalhotkey,omitempty"`
	AppDismissArchitectureWarning bool   `json:"app:dismissarchitecturewarning,omitempty"`
	AppDefaultNewBlock            string `json:"app:defaultnewblock,omitempty"`
	AppShowOverlayBlockNums       *bool  `json:"app:showoverlayblocknums,omitempty"`
	AppCtrlVPaste                 *bool  `json:"app:ctrlvpaste,omitempty"`
	AppTheme                      string                 `json:"app:theme,omitempty"`
	AppAccent                     string                 `json:"app:accent,omitempty"`
	AppThemeOverrides             map[string]interface{} `json:"app:themeoverrides,omitempty"`
	AppCustomAccents              map[string]interface{} `json:"app:customaccents,omitempty"`
	AppConfirmQuit                *bool                  `json:"app:confirmquit,omitempty"`

	AiClear         bool    `json:"ai:*,omitempty"`
	AiPreset        string  `json:"ai:preset,omitempty"`
	AiApiType       string  `json:"ai:apitype,omitempty"`
	AiBaseURL       string  `json:"ai:baseurl,omitempty"`
	AiApiToken      string  `json:"ai:apitoken,omitempty"`
	AiName          string  `json:"ai:name,omitempty"`
	AiModel         string  `json:"ai:model,omitempty"`
	AiOrgID         string  `json:"ai:orgid,omitempty"`
	AIApiVersion    string  `json:"ai:apiversion,omitempty"`
	AiMaxTokens     float64 `json:"ai:maxtokens,omitempty"`
	AiTimeoutMs     float64 `json:"ai:timeoutms,omitempty"`
	AiProxyUrl      string  `json:"ai:proxyurl,omitempty"`
	AiFontSize      float64 `json:"ai:fontsize,omitempty"`
	AiFixedFontSize float64 `json:"ai:fixedfontsize,omitempty"`

	WaveAiShowCloudModes bool   `json:"waveai:showcloudmodes,omitempty"`
	WaveAiDefaultMode    string `json:"waveai:defaultmode,omitempty"`

	TermClear               bool     `json:"term:*,omitempty"`
	TermFontSize            float64  `json:"term:fontsize,omitempty"`
	TermFontFamily          string   `json:"term:fontfamily,omitempty"`
	TermTheme               string   `json:"term:theme,omitempty"`
	TermDisableWebGl        bool     `json:"term:disablewebgl,omitempty"`
	TermLocalShellPath      string   `json:"term:localshellpath,omitempty"`
	TermLocalShellOpts      []string `json:"term:localshellopts,omitempty"`
	TermGitBashPath         string   `json:"term:gitbashpath,omitempty"`
	TermScrollback          *int64   `json:"term:scrollback,omitempty"`
	TermCopyOnSelect        *bool    `json:"term:copyonselect,omitempty"`
	TermTransparency        *float64 `json:"term:transparency,omitempty"`
	TermAllowBracketedPaste *bool    `json:"term:allowbracketedpaste,omitempty"`
	TermShiftEnterNewline   *bool    `json:"term:shiftenternewline,omitempty"`
	TermMacOptionIsMeta     *bool    `json:"term:macoptionismeta,omitempty"`
	TermLigatures           bool     `json:"term:ligatures,omitempty"`
	TermOmpTheme            string   `json:"term:omptheme,omitempty"`
	TermBellSound           *bool    `json:"term:bellsound,omitempty"`
	TermBellIndicator       *bool    `json:"term:bellindicator,omitempty"`
	TermReportFocus         *bool    `json:"term:reportfocus,omitempty"`

	EditorMinimapEnabled      bool    `json:"editor:minimapenabled,omitempty"`
	EditorStickyScrollEnabled bool    `json:"editor:stickyscrollenabled,omitempty"`
	EditorWordWrap            bool    `json:"editor:wordwrap,omitempty"`
	EditorFontSize            float64 `json:"editor:fontsize,omitempty"`
	EditorInlineDiff          bool    `json:"editor:inlinediff,omitempty"`

	WebClear               bool   `json:"web:*,omitempty"`
	WebOpenLinksInternally bool   `json:"web:openlinksinternally,omitempty"`
	WebDefaultUrl          string `json:"web:defaulturl,omitempty"`
	WebDefaultSearch       string `json:"web:defaultsearch,omitempty"`

	BlockHeaderClear        bool `json:"blockheader:*,omitempty"`
	BlockHeaderShowBlockIds bool `json:"blockheader:showblockids,omitempty"`

	AutoUpdateClear         bool    `json:"autoupdate:*,omitempty"`
	AutoUpdateEnabled       bool    `json:"autoupdate:enabled,omitempty"`
	AutoUpdateIntervalMs    float64 `json:"autoupdate:intervalms,omitempty"`
	AutoUpdateInstallOnQuit bool    `json:"autoupdate:installonquit,omitempty"`
	AutoUpdateChannel       string  `json:"autoupdate:channel,omitempty"`

	MarkdownFontSize      float64 `json:"markdown:fontsize,omitempty"`
	MarkdownFixedFontSize float64 `json:"markdown:fixedfontsize,omitempty"`

	PreviewShowHiddenFiles *bool `json:"preview:showhiddenfiles,omitempty"`

	TabPreset string `json:"tab:preset,omitempty"`

	WidgetClear    bool  `json:"widget:*,omitempty"`
	WidgetShowHelp *bool `json:"widget:showhelp,omitempty"`

	WindowClear                         bool     `json:"window:*,omitempty"`
	WindowFullscreenOnLaunch            bool     `json:"window:fullscreenonlaunch,omitempty"`
	WindowTransparent                   bool     `json:"window:transparent,omitempty"`
	WindowBlur                          bool     `json:"window:blur,omitempty"`
	WindowOpacity                       *float64 `json:"window:opacity,omitempty"`
	WindowBgColor                       string   `json:"window:bgcolor,omitempty"`
	WindowReducedMotion                 bool     `json:"window:reducedmotion,omitempty"`
	WindowTileGapSize                   *int64   `json:"window:tilegapsize,omitempty"`
	WindowShowMenuBar                   bool     `json:"window:showmenubar,omitempty"`
	WindowNativeTitleBar                bool     `json:"window:nativetitlebar,omitempty"`
	WindowDisableHardwareAcceleration   bool     `json:"window:disablehardwareacceleration,omitempty"`
	WindowMaxTabCacheSize               int      `json:"window:maxtabcachesize,omitempty"`
	WindowMagnifiedBlockOpacity         *float64 `json:"window:magnifiedblockopacity,omitempty"`
	WindowMagnifiedBlockSize            *float64 `json:"window:magnifiedblocksize,omitempty"`
	WindowMagnifiedBlockBlurPrimaryPx   *int64   `json:"window:magnifiedblockblurprimarypx,omitempty"`
	WindowMagnifiedBlockBlurSecondaryPx *int64   `json:"window:magnifiedblockblursecondarypx,omitempty"`
	WindowConfirmClose                  bool     `json:"window:confirmclose,omitempty"`
	WindowSaveLastWindow                bool     `json:"window:savelastwindow,omitempty"`
	WindowDimensions                    string   `json:"window:dimensions,omitempty"`
	WindowZoom                          *float64 `json:"window:zoom,omitempty"`

	TelemetryClear   bool `json:"telemetry:*,omitempty"`
	TelemetryEnabled bool `json:"telemetry:enabled,omitempty"`

	ConnClear               bool  `json:"conn:*,omitempty"`
	ConnAskBeforeWshInstall *bool `json:"conn:askbeforewshinstall,omitempty"`
	ConnWshEnabled          bool  `json:"conn:wshenabled,omitempty"`

	ShellClear    bool                         `json:"shell:*,omitempty"`
	ShellDefault  string                       `json:"shell:default,omitempty"`
	ShellProfiles map[string]ShellProfileType  `json:"shell:profiles,omitempty"`

	DebugClear               bool `json:"debug:*,omitempty"`
	DebugPprofPort           *int `json:"debug:pprofport,omitempty"`
	DebugPprofMemProfileRate *int `json:"debug:pprofmemprofilerate,omitempty"`
}

func (s *SettingsType) GetAiSettings() *AiSettingsType {
	return &AiSettingsType{
		AiClear:         s.AiClear,
		AiPreset:        s.AiPreset,
		AiApiType:       s.AiApiType,
		AiBaseURL:       s.AiBaseURL,
		AiApiToken:      s.AiApiToken,
		AiName:          s.AiName,
		AiModel:         s.AiModel,
		AiOrgID:         s.AiOrgID,
		AIApiVersion:    s.AIApiVersion,
		AiMaxTokens:     s.AiMaxTokens,
		AiTimeoutMs:     s.AiTimeoutMs,
		AiProxyUrl:      s.AiProxyUrl,
		AiFontSize:      s.AiFontSize,
		AiFixedFontSize: s.AiFixedFontSize,
	}
}

func MergeAiSettings(settings ...*AiSettingsType) *AiSettingsType {
	result := &AiSettingsType{}

	for _, s := range settings {
		if s == nil {
			continue
		}

		if s.AiClear {
			result = s
			result.AiClear = false
			continue
		}

		if s.AiPreset != "" {
			result.AiPreset = s.AiPreset
		}
		if s.AiApiType != "" {
			result.AiApiType = s.AiApiType
		}
		if s.AiBaseURL != "" {
			result.AiBaseURL = s.AiBaseURL
		}
		if s.AiApiToken != "" {
			result.AiApiToken = s.AiApiToken
		}
		if s.AiName != "" {
			result.AiName = s.AiName
		}
		if s.AiModel != "" {
			result.AiModel = s.AiModel
		}
		if s.AiOrgID != "" {
			result.AiOrgID = s.AiOrgID
		}
		if s.AIApiVersion != "" {
			result.AIApiVersion = s.AIApiVersion
		}
		if s.AiProxyUrl != "" {
			result.AiProxyUrl = s.AiProxyUrl
		}
		if s.AiMaxTokens != 0 {
			result.AiMaxTokens = s.AiMaxTokens
		}
		if s.AiTimeoutMs != 0 {
			result.AiTimeoutMs = s.AiTimeoutMs
		}
		if s.AiFontSize != 0 {
			result.AiFontSize = s.AiFontSize
		}
		if s.AiFixedFontSize != 0 {
			result.AiFixedFontSize = s.AiFixedFontSize
		}
		if s.DisplayName != "" {
			result.DisplayName = s.DisplayName
		}
		if s.DisplayOrder != 0 {
			result.DisplayOrder = s.DisplayOrder
		}
	}

	return result
}

type ConfigError struct {
	File string `json:"file"`
	Err  string `json:"err"`
}

type ShellProfileType struct {
	DisplayName    string   `json:"display:name,omitempty"`
	DisplayIcon    string   `json:"display:icon,omitempty"`
	DisplayOrder   float64  `json:"display:order,omitempty"`
	ShellPath      string   `json:"shell:path,omitempty"`
	ShellOpts      []string `json:"shell:opts,omitempty"`
	ShellType      string   `json:"shell:type,omitempty"`
	IsWsl          bool     `json:"shell:iswsl,omitempty"`
	WslDistro      string   `json:"shell:wsldistro,omitempty"`
	Autodetected   bool     `json:"autodetected,omitempty"`
	Hidden         bool     `json:"hidden,omitempty"`
	Source         string   `json:"source,omitempty"`
	UserModified   bool     `json:"usermodified,omitempty"`
}

type WebBookmark struct {
	Url          string  `json:"url"`
	Title        string  `json:"title,omitempty"`
	Icon         string  `json:"icon,omitempty"`
	IconColor    string  `json:"iconcolor,omitempty"`
	IconUrl      string  `json:"iconurl,omitempty"`
	DisplayOrder float64 `json:"display:order,omitempty"`
}

type AIModeConfigType struct {
	DisplayName        string   `json:"display:name"`
	DisplayOrder       float64  `json:"display:order,omitempty"`
	DisplayIcon        string   `json:"display:icon,omitempty"`
	DisplayDescription string   `json:"display:description,omitempty"`
	Provider           string   `json:"ai:provider,omitempty" jsonschema:"enum=wave,enum=google,enum=openrouter,enum=openai,enum=azure,enum=azure-legacy,enum=custom"`
	APIType            string   `json:"ai:apitype,omitempty" jsonschema:"enum=google-gemini,enum=openai-responses,enum=openai-chat"`
	Model              string   `json:"ai:model,omitempty"`
	ThinkingLevel      string   `json:"ai:thinkinglevel,omitempty" jsonschema:"enum=low,enum=medium,enum=high"`
	Endpoint           string   `json:"ai:endpoint,omitempty"`
	AzureAPIVersion    string   `json:"ai:azureapiversion,omitempty"`
	APIToken           string   `json:"ai:apitoken,omitempty"`
	APITokenSecretName string   `json:"ai:apitokensecretname,omitempty"`
	AzureResourceName  string   `json:"ai:azureresourcename,omitempty"`
	AzureDeployment    string   `json:"ai:azuredeployment,omitempty"`
	Capabilities       []string `json:"ai:capabilities,omitempty" jsonschema:"enum=pdfs,enum=images,enum=tools"`
	SwitchCompat       []string `json:"ai:switchcompat,omitempty"`
	WaveAICloud        bool     `json:"waveai:cloud,omitempty"`
	WaveAIPremium      bool     `json:"waveai:premium,omitempty"`
}

type AIModeConfigUpdate struct {
	Configs map[string]AIModeConfigType `json:"configs"`
}

type FullConfigType struct {
	Settings       SettingsType                   `json:"settings" merge:"meta"`
	MimeTypes      map[string]MimeTypeConfigType  `json:"mimetypes"`
	DefaultWidgets map[string]WidgetConfigType    `json:"defaultwidgets"`
	Widgets        map[string]WidgetConfigType    `json:"widgets"`
	Presets        map[string]waveobj.MetaMapType `json:"presets"`
	TermThemes     map[string]TermThemeType       `json:"termthemes"`
	Connections    map[string]ConnKeywords        `json:"connections"`
	Bookmarks      map[string]WebBookmark         `json:"bookmarks"`
	WaveAIModes    map[string]AIModeConfigType    `json:"waveai"`
	ConfigErrors   []ConfigError                  `json:"configerrors" configfile:"-"`
}

type ConnKeywords struct {
	ConnWshEnabled          *bool  `json:"conn:wshenabled,omitempty"`
	ConnAskBeforeWshInstall *bool  `json:"conn:askbeforewshinstall,omitempty"`
	ConnWshPath             string `json:"conn:wshpath,omitempty"`
	ConnShellPath           string `json:"conn:shellpath,omitempty"`
	ConnIgnoreSshConfig     *bool  `json:"conn:ignoresshconfig,omitempty"`
	ConnLocal               *bool  `json:"conn:local,omitempty"`

	DisplayHidden *bool   `json:"display:hidden,omitempty"`
	DisplayOrder  float32 `json:"display:order,omitempty"`

	TermClear      bool    `json:"term:*,omitempty"`
	TermFontSize   float64 `json:"term:fontsize,omitempty"`
	TermFontFamily string  `json:"term:fontfamily,omitempty"`
	TermTheme      string  `json:"term:theme,omitempty"`

	CmdEnv            map[string]string `json:"cmd:env,omitempty"`
	CmdInitScript     string            `json:"cmd:initscript,omitempty"`
	CmdInitScriptSh   string            `json:"cmd:initscript.sh,omitempty"`
	CmdInitScriptBash string            `json:"cmd:initscript.bash,omitempty"`
	CmdInitScriptZsh  string            `json:"cmd:initscript.zsh,omitempty"`
	CmdInitScriptPwsh string            `json:"cmd:initscript.pwsh,omitempty"`
	CmdInitScriptFish string            `json:"cmd:initscript.fish,omitempty"`

	SshUser                         *string  `json:"ssh:user,omitempty"`
	SshHostName                     *string  `json:"ssh:hostname,omitempty"`
	SshPort                         *string  `json:"ssh:port,omitempty"`
	SshIdentityFile                 []string `json:"ssh:identityfile,omitempty"`
	SshPasswordSecretName           *string  `json:"ssh:passwordsecretname,omitempty"`
	SshBatchMode                    *bool    `json:"ssh:batchmode,omitempty"`
	SshPubkeyAuthentication         *bool    `json:"ssh:pubkeyauthentication,omitempty"`
	SshPasswordAuthentication       *bool    `json:"ssh:passwordauthentication,omitempty"`
	SshKbdInteractiveAuthentication *bool    `json:"ssh:kbdinteractiveauthentication,omitempty"`
	SshPreferredAuthentications     []string `json:"ssh:preferredauthentications,omitempty"`
	SshAddKeysToAgent               *bool    `json:"ssh:addkeystoagent,omitempty"`
	SshIdentityAgent                *string  `json:"ssh:identityagent,omitempty"`
	SshIdentitiesOnly               *bool    `json:"ssh:identitiesonly,omitempty"`
	SshProxyJump                    []string `json:"ssh:proxyjump,omitempty"`
	SshUserKnownHostsFile           []string `json:"ssh:userknownhostsfile,omitempty"`
	SshGlobalKnownHostsFile         []string `json:"ssh:globalknownhostsfile,omitempty"`
}

func DefaultBoolPtr(arg *bool, def bool) bool {
	if arg == nil {
		return def
	}
	return *arg
}

func goBackWS(barr []byte, offset int) int {
	if offset >= len(barr) {
		offset = offset - 1
	}
	for i := offset - 1; i >= 0; i-- {
		if barr[i] == ' ' || barr[i] == '\t' || barr[i] == '\n' || barr[i] == '\r' {
			continue
		}
		return i
	}
	return 0
}

func isTrailingCommaError(barr []byte, offset int) bool {
	if offset >= len(barr) {
		offset = offset - 1
	}
	offset = goBackWS(barr, offset)
	if barr[offset] == '}' {
		offset = goBackWS(barr, offset)
		if barr[offset] == ',' {
			return true
		}
	}
	return false
}

func resolveEnvReplacements(m waveobj.MetaMapType) {
	if m == nil {
		return
	}

	for key, value := range m {
		switch v := value.(type) {
		case string:
			if resolved, ok := resolveEnvValue(v); ok {
				m[key] = resolved
			}
		case map[string]interface{}:
			resolveEnvReplacements(waveobj.MetaMapType(v))
		case []interface{}:
			resolveEnvArray(v)
		}
	}
}

func resolveEnvArray(arr []interface{}) {
	for i, value := range arr {
		switch v := value.(type) {
		case string:
			if resolved, ok := resolveEnvValue(v); ok {
				arr[i] = resolved
			}
		case map[string]interface{}:
			resolveEnvReplacements(waveobj.MetaMapType(v))
		case []interface{}:
			resolveEnvArray(v)
		}
	}
}

func resolveEnvValue(value string) (string, bool) {
	if !strings.HasPrefix(value, "$ENV:") {
		return "", false
	}

	envSpec := value[5:]
	parts := strings.SplitN(envSpec, ":", 2)
	envVar := parts[0]
	var fallback string
	if len(parts) > 1 {
		fallback = parts[1]
	}

	if envValue, exists := os.LookupEnv(envVar); exists {
		return envValue, true
	}

	if fallback != "" {
		return fallback, true
	}
	return "", true
}

func readConfigHelper(fileName string, barr []byte, readErr error) (waveobj.MetaMapType, []ConfigError) {
	var cerrs []ConfigError
	if readErr != nil && !os.IsNotExist(readErr) {
		cerrs = append(cerrs, ConfigError{File: fileName, Err: readErr.Error()})
	}
	if len(barr) == 0 {
		return nil, cerrs
	}
	var rtn waveobj.MetaMapType
	err := json.Unmarshal(barr, &rtn)
	if err != nil {
		if syntaxErr, ok := err.(*json.SyntaxError); ok {
			offset := syntaxErr.Offset
			if offset > 0 {
				offset = offset - 1
			}
			lineNum, colNum := utilfn.GetLineColFromOffset(barr, int(offset))
			isTrailingComma := isTrailingCommaError(barr, int(offset))
			if isTrailingComma {
				err = fmt.Errorf("json syntax error at line %d, col %d: probably an extra trailing comma: %v", lineNum, colNum, syntaxErr)
			} else {
				err = fmt.Errorf("json syntax error at line %d, col %d: %v", lineNum, colNum, syntaxErr)
			}
		}
		cerrs = append(cerrs, ConfigError{File: fileName, Err: err.Error()})
	}

	if rtn != nil {
		resolveEnvReplacements(rtn)
	}

	return rtn, cerrs
}

func readConfigFileFS(fsys fs.FS, logPrefix string, fileName string) (waveobj.MetaMapType, []ConfigError) {
	barr, readErr := fs.ReadFile(fsys, fileName)
	if readErr != nil {
		barr, readErr = fs.ReadFile(fsys, filepath.ToSlash(fileName))
	}
	return readConfigHelper(logPrefix+fileName, barr, readErr)
}

func ReadDefaultsConfigFile(fileName string) (waveobj.MetaMapType, []ConfigError) {
	return readConfigFileFS(defaultconfig.ConfigFS, "defaults:", fileName)
}

func ReadWaveHomeConfigFile(fileName string) (waveobj.MetaMapType, []ConfigError) {
	configDirAbsPath := wavebase.GetWaveConfigDir()
	configDirFsys := os.DirFS(configDirAbsPath)
	return readConfigFileFS(configDirFsys, "", fileName)
}

func WriteWaveHomeConfigFile(fileName string, m waveobj.MetaMapType) error {
	configDirAbsPath := wavebase.GetWaveConfigDir()
	fullFileName := filepath.Join(configDirAbsPath, fileName)
	barr, err := jsonMarshalConfigInOrder(m)
	if err != nil {
		return err
	}
	return os.WriteFile(fullFileName, barr, 0644)
}

func mergeMetaMapSimple(m waveobj.MetaMapType, toMerge waveobj.MetaMapType) waveobj.MetaMapType {
	if m == nil {
		return toMerge
	}
	if toMerge == nil {
		return m
	}
	for k, v := range toMerge {
		if v == nil {
			delete(m, k)
			continue
		}
		m[k] = v
	}
	if len(m) == 0 {
		return nil
	}
	return m
}

func mergeMetaMap(m waveobj.MetaMapType, toMerge waveobj.MetaMapType, simpleMerge bool) waveobj.MetaMapType {
	if simpleMerge {
		return mergeMetaMapSimple(m, toMerge)
	} else {
		return waveobj.MergeMeta(m, toMerge, true)
	}
}

func selectDirEntsBySuffix(dirEnts []fs.DirEntry, fileNameSuffix string) []fs.DirEntry {
	var rtn []fs.DirEntry
	for _, ent := range dirEnts {
		if ent.IsDir() {
			continue
		}
		if !strings.HasSuffix(ent.Name(), fileNameSuffix) {
			continue
		}
		rtn = append(rtn, ent)
	}
	return rtn
}

func SortFileNameDescend(files []fs.DirEntry) {
	sort.Slice(files, func(i, j int) bool {
		return files[i].Name() > files[j].Name()
	})
}

func readConfigFilesForDir(fsys fs.FS, logPrefix string, dirName string, fileName string, simpleMerge bool) (waveobj.MetaMapType, []ConfigError) {
	dirEnts, _ := fs.ReadDir(fsys, dirName)
	suffixEnts := selectDirEntsBySuffix(dirEnts, fileName+".json")
	SortFileNameDescend(suffixEnts)
	var rtn waveobj.MetaMapType
	var errs []ConfigError
	for _, ent := range suffixEnts {
		fileVal, cerrs := readConfigFileFS(fsys, logPrefix, filepath.Join(dirName, ent.Name()))
		rtn = mergeMetaMap(rtn, fileVal, simpleMerge)
		errs = append(errs, cerrs...)
	}
	return rtn, errs
}

func readConfigPartForFS(fsys fs.FS, logPrefix string, partName string, simpleMerge bool) (waveobj.MetaMapType, []ConfigError) {
	config, errs := readConfigFilesForDir(fsys, logPrefix, partName, "", simpleMerge)
	allErrs := errs
	rtn := config
	config, errs = readConfigFileFS(fsys, logPrefix, partName+".json")
	allErrs = append(allErrs, errs...)
	return mergeMetaMap(rtn, config, simpleMerge), allErrs
}

func readConfigPart(partName string, simpleMerge bool) (waveobj.MetaMapType, []ConfigError) {
	configDirAbsPath := wavebase.GetWaveConfigDir()
	configDirFsys := os.DirFS(configDirAbsPath)
	defaultConfigs, cerrs := readConfigPartForFS(defaultconfig.ConfigFS, "defaults:", partName, simpleMerge)
	homeConfigs, cerrs1 := readConfigPartForFS(configDirFsys, "", partName, simpleMerge)

	rtn := defaultConfigs
	allErrs := append(cerrs, cerrs1...)
	return mergeMetaMap(rtn, homeConfigs, simpleMerge), allErrs
}

func ReadFullConfig() FullConfigType {
	var fullConfig FullConfigType
	configRType := reflect.TypeOf(fullConfig)
	configRVal := reflect.ValueOf(&fullConfig).Elem()
	for fieldIdx := 0; fieldIdx < configRType.NumField(); fieldIdx++ {
		field := configRType.Field(fieldIdx)
		if field.PkgPath != "" {
			continue
		}
		configFile := field.Tag.Get("configfile")
		if configFile == "-" {
			continue
		}
		jsonTag := utilfn.GetJsonTag(field)
		simpleMerge := field.Tag.Get("merge") == ""
		var configPart waveobj.MetaMapType
		var errs []ConfigError
		if jsonTag == "-" || jsonTag == "" {
			continue
		} else {
			configPart, errs = readConfigPart(jsonTag, simpleMerge)
		}
		fullConfig.ConfigErrors = append(fullConfig.ConfigErrors, errs...)
		if configPart != nil {
			fieldPtr := configRVal.Field(fieldIdx).Addr().Interface()
			utilfn.ReUnmarshal(fieldPtr, configPart)
		}
	}

	if fullConfig.Presets != nil {
		for presetName, presetMeta := range fullConfig.Presets {
			if err := waveobj.ValidatePresetScope(presetName, presetMeta); err != nil {
				fullConfig.ConfigErrors = append(fullConfig.ConfigErrors, ConfigError{
					File: "presets/*.json",
					Err:  fmt.Sprintf("preset %s: %v", presetName, err),
				})
			}
		}
	}

	return fullConfig
}

func GetConfigSubdirs() []string {
	var fullConfig FullConfigType
	configRType := reflect.TypeOf(fullConfig)
	var retVal []string
	configDirAbsPath := wavebase.GetWaveConfigDir()
	for fieldIdx := 0; fieldIdx < configRType.NumField(); fieldIdx++ {
		field := configRType.Field(fieldIdx)
		if field.PkgPath != "" {
			continue
		}
		configFile := field.Tag.Get("configfile")
		if configFile == "-" {
			continue
		}
		jsonTag := utilfn.GetJsonTag(field)
		if jsonTag != "-" && jsonTag != "" && jsonTag != "settings" {
			retVal = append(retVal, filepath.Join(configDirAbsPath, jsonTag))
		}
	}
	log.Printf("subdirs: %v\n", retVal)
	return retVal
}

func getConfigKeyType(configKey string) reflect.Type {
	ctype := reflect.TypeOf(SettingsType{})
	for i := 0; i < ctype.NumField(); i++ {
		field := ctype.Field(i)
		jsonTag := utilfn.GetJsonTag(field)
		if jsonTag == configKey {
			return field.Type
		}
	}
	return nil
}

func getConfigKeyNamespace(key string) string {
	colonIdx := strings.Index(key, ":")
	if colonIdx == -1 {
		return ""
	}
	return key[:colonIdx]
}

func orderConfigKeys(m waveobj.MetaMapType) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		k1 := keys[i]
		k2 := keys[j]
		k1ns := getConfigKeyNamespace(k1)
		k2ns := getConfigKeyNamespace(k2)
		if k1ns != k2ns {
			return k1ns < k2ns
		}
		return k1 < k2
	})
	return keys
}

func reindentJson(barr []byte, indentStr string) []byte {
	if len(barr) < 2 {
		return barr
	}
	if barr[0] != '{' && barr[0] != '[' {
		return barr
	}
	if !bytes.Contains(barr, []byte("\n")) {
		return barr
	}
	outputLines := bytes.Split(barr, []byte("\n"))
	for i, line := range outputLines {
		if i == 0 {
			continue
		}
		outputLines[i] = append([]byte(indentStr), line...)
	}
	return bytes.Join(outputLines, []byte("\n"))
}

func jsonMarshalConfigInOrder(m waveobj.MetaMapType) ([]byte, error) {
	if len(m) == 0 {
		return []byte("{}"), nil
	}
	var buf bytes.Buffer
	orderedKeys := orderConfigKeys(m)
	buf.WriteString("{\n")
	for idx, key := range orderedKeys {
		val := m[key]
		keyBarr, err := json.Marshal(key)
		if err != nil {
			return nil, err
		}
		valBarr, err := json.MarshalIndent(val, "", "  ")
		if err != nil {
			return nil, err
		}
		valBarr = reindentJson(valBarr, "  ")
		buf.WriteString("  ")
		buf.Write(keyBarr)
		buf.WriteString(": ")
		buf.Write(valBarr)
		if idx < len(orderedKeys)-1 {
			buf.WriteString(",")
		}
		buf.WriteString("\n")
	}
	buf.WriteString("}")
	return buf.Bytes(), nil
}

var dummyNumber json.Number

func convertJsonNumber(num json.Number, ctype reflect.Type) (interface{}, error) {
	if ctype.Kind() == reflect.Pointer {
		ctype = ctype.Elem()
	}
	if reflect.Int == ctype.Kind() {
		if ival, err := num.Int64(); err == nil {
			return int(ival), nil
		}
		return nil, fmt.Errorf("invalid number for int: %s", num)
	}
	if reflect.Int64 == ctype.Kind() {
		if ival, err := num.Int64(); err == nil {
			return ival, nil
		}
		return nil, fmt.Errorf("invalid number for int64: %s", num)
	}
	if reflect.Float64 == ctype.Kind() {
		if fval, err := num.Float64(); err == nil {
			return fval, nil
		}
		return nil, fmt.Errorf("invalid number for float64: %s", num)
	}
	if reflect.String == ctype.Kind() {
		return num.String(), nil
	}
	return nil, fmt.Errorf("cannot convert number to %s", ctype)
}

func SetBaseConfigValue(toMerge waveobj.MetaMapType) error {
	m, cerrs := ReadWaveHomeConfigFile(SettingsFile)
	if len(cerrs) > 0 {
		return fmt.Errorf("error reading config file: %v", cerrs[0])
	}
	if m == nil {
		m = make(waveobj.MetaMapType)
	}
	for configKey, val := range toMerge {
		ctype := getConfigKeyType(configKey)
		if ctype == nil {
			return fmt.Errorf("invalid config key: %s", configKey)
		}
		if val == nil {
			delete(m, configKey)
		} else {
			rtype := reflect.TypeOf(val)
			if rtype == reflect.TypeOf(dummyNumber) {
				convertedVal, err := convertJsonNumber(val.(json.Number), ctype)
				if err != nil {
					return fmt.Errorf("cannot convert %s: %v", configKey, err)
				}
				val = convertedVal
				rtype = reflect.TypeOf(val)
			}
			if rtype != ctype {
				if ctype == reflect.PointerTo(rtype) {
					m[configKey] = &val
				} else {
					jsonBytes, err := json.Marshal(val)
					if err != nil {
						return fmt.Errorf("invalid value type for %s: %T", configKey, val)
					}
					converted := reflect.New(ctype).Interface()
					if err := json.Unmarshal(jsonBytes, converted); err != nil {
						return fmt.Errorf("invalid value type for %s: %T", configKey, val)
					}
					val = reflect.ValueOf(converted).Elem().Interface()
				}
			}
			m[configKey] = val
		}
	}
	return WriteWaveHomeConfigFile(SettingsFile, m)
}

func SetConnectionsConfigValue(connName string, toMerge waveobj.MetaMapType) error {
	m, cerrs := ReadWaveHomeConfigFile(ConnectionsFile)
	if len(cerrs) > 0 {
		return fmt.Errorf("error reading config file: %v", cerrs[0])
	}
	if m == nil {
		m = make(waveobj.MetaMapType)
	}
	connData := m.GetMap(connName)
	if connData == nil {
		connData = make(waveobj.MetaMapType)
	}
	for configKey, val := range toMerge {
		if configKey == "conn:shellpath" {
			if s, ok := val.(string); ok && s != "" {
				if strings.HasPrefix(s, "wsl://") || strings.HasPrefix(s, "ssh://") {
					return fmt.Errorf("conn:shellpath must be a shell executable path, not a connection URI: %q", s)
				}
			}
		}
		connData[configKey] = val
	}
	m[connName] = connData
	return WriteWaveHomeConfigFile(ConnectionsFile, m)
}

func SetShellProfile(profileId string, profile ShellProfileType) error {
	m, cerrs := ReadWaveHomeConfigFile(SettingsFile)
	if len(cerrs) > 0 {
		return fmt.Errorf("error reading config file: %v", cerrs[0])
	}
	if m == nil {
		m = make(waveobj.MetaMapType)
	}

	profilesRaw := m["shell:profiles"]
	var profiles map[string]interface{}
	if profilesRaw == nil {
		profiles = make(map[string]interface{})
	} else if p, ok := profilesRaw.(map[string]interface{}); ok {
		profiles = p
	} else {
		profiles = make(map[string]interface{})
	}

	profileMap := make(map[string]interface{})
	if profile.DisplayName != "" {
		profileMap["display:name"] = profile.DisplayName
	}
	if profile.DisplayIcon != "" {
		profileMap["display:icon"] = profile.DisplayIcon
	}
	if profile.DisplayOrder != 0 {
		profileMap["display:order"] = profile.DisplayOrder
	}
	if profile.ShellPath != "" {
		profileMap["shell:path"] = profile.ShellPath
	}
	if len(profile.ShellOpts) > 0 {
		profileMap["shell:opts"] = profile.ShellOpts
	}
	if profile.ShellType != "" {
		profileMap["shell:type"] = profile.ShellType
	}
	if profile.IsWsl {
		profileMap["shell:iswsl"] = profile.IsWsl
	}
	if profile.WslDistro != "" {
		profileMap["shell:wsldistro"] = profile.WslDistro
	}
	if profile.Autodetected {
		profileMap["autodetected"] = profile.Autodetected
	}
	if profile.Hidden {
		profileMap["hidden"] = profile.Hidden
	}
	if profile.Source != "" {
		profileMap["source"] = profile.Source
	}
	if profile.UserModified {
		profileMap["usermodified"] = profile.UserModified
	}

	profiles[profileId] = profileMap
	m["shell:profiles"] = profiles
	return WriteWaveHomeConfigFile(SettingsFile, m)
}

func DeleteShellProfile(profileId string) error {
	m, cerrs := ReadWaveHomeConfigFile(SettingsFile)
	if len(cerrs) > 0 {
		return fmt.Errorf("error reading config file: %v", cerrs[0])
	}
	if m == nil {
		return nil
	}

	profilesRaw := m["shell:profiles"]
	if profilesRaw == nil {
		return nil
	}
	profiles, ok := profilesRaw.(map[string]interface{})
	if !ok {
		return nil
	}

	delete(profiles, profileId)
	if len(profiles) == 0 {
		delete(m, "shell:profiles")
	} else {
		m["shell:profiles"] = profiles
	}
	return WriteWaveHomeConfigFile(SettingsFile, m)
}

func GetShellProfiles() map[string]ShellProfileType {
	m, cerrs := ReadWaveHomeConfigFile(SettingsFile)
	if len(cerrs) > 0 || m == nil {
		return make(map[string]ShellProfileType)
	}

	profilesRaw := m["shell:profiles"]
	if profilesRaw == nil {
		return make(map[string]ShellProfileType)
	}

	profiles, ok := profilesRaw.(map[string]interface{})
	if !ok {
		return make(map[string]ShellProfileType)
	}

	result := make(map[string]ShellProfileType)
	for id, pRaw := range profiles {
		pMap, ok := pRaw.(map[string]interface{})
		if !ok {
			continue
		}
		profile := ShellProfileType{}
		if v, ok := pMap["display:name"].(string); ok {
			profile.DisplayName = v
		}
		if v, ok := pMap["display:icon"].(string); ok {
			profile.DisplayIcon = v
		}
		if v, ok := pMap["display:order"].(float64); ok {
			profile.DisplayOrder = v
		}
		if v, ok := pMap["shell:path"].(string); ok {
			profile.ShellPath = v
		}
		if v, ok := pMap["shell:opts"].([]interface{}); ok {
			for _, opt := range v {
				if s, ok := opt.(string); ok {
					profile.ShellOpts = append(profile.ShellOpts, s)
				}
			}
		}
		if v, ok := pMap["shell:type"].(string); ok {
			profile.ShellType = v
		}
		if v, ok := pMap["shell:iswsl"].(bool); ok {
			profile.IsWsl = v
		}
		if v, ok := pMap["shell:wsldistro"].(string); ok {
			profile.WslDistro = v
		}
		if v, ok := pMap["autodetected"].(bool); ok {
			profile.Autodetected = v
		}
		if v, ok := pMap["hidden"].(bool); ok {
			profile.Hidden = v
		}
		if v, ok := pMap["source"].(string); ok {
			profile.Source = v
		}
		if v, ok := pMap["usermodified"].(bool); ok {
			profile.UserModified = v
		}
		result[id] = profile
	}
	return result
}

func MergeDetectedShellProfiles(detectedShells []ShellProfileType) (added int, err error) {
	existingProfiles := GetShellProfiles()
	assignedIds := make(map[string]bool)
	for id := range existingProfiles {
		assignedIds[id] = true
	}

	for _, shell := range detectedShells {
		profileId := generateShellProfileId(shell)

		if shell.IsWsl && shell.WslDistro != "" {
			oldKey := "wsl:" + SanitizeProfileId(shell.WslDistro+"-default")
			if oldKey != profileId {
				if oldProfile, exists := existingProfiles[oldKey]; exists && !oldProfile.UserModified {
					_ = DeleteShellProfile(oldKey)
					delete(existingProfiles, oldKey)
					delete(assignedIds, oldKey)
				}
			}
		}

		if assignedIds[profileId] {
			existing, exists := existingProfiles[profileId]
			if exists {
				if existing.UserModified {
					continue
				}
				if existing.ShellPath == shell.ShellPath {
					continue
				}
			} else {
				profileId = profileId + "-" + uuid.New().String()[:8]
			}
		}

		shell.Autodetected = true
		assignedIds[profileId] = true

		if err := SetShellProfile(profileId, shell); err != nil {
			return added, err
		}
		added++
	}
	return added, nil
}

func generateShellProfileId(profile ShellProfileType) string {
	if profile.IsWsl && profile.WslDistro != "" {
		return "wsl:" + SanitizeProfileId(profile.WslDistro)
	}

	name := profile.DisplayName
	if name == "" {
		name = profile.ShellType
	}
	if name == "" {
		name = "shell"
	}
	return SanitizeProfileId(name)
}

func SanitizeProfileId(name string) string {
	name = strings.ToLower(name)
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, ".", "-")
	var result strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			result.WriteRune(r)
		}
	}
	id := result.String()
	if id == "" {
		id = "shell-" + uuid.New().String()[:8]
	}
	return id
}

type WidgetConfigType struct {
	DisplayOrder  float64          `json:"display:order,omitempty"`
	DisplayHidden bool             `json:"display:hidden,omitempty"`
	Icon          string           `json:"icon,omitempty"`
	Color         string           `json:"color,omitempty"`
	Label         string           `json:"label,omitempty"`
	Description   string           `json:"description,omitempty"`
	Magnified     bool             `json:"magnified,omitempty"`
	BlockDef      waveobj.BlockDef `json:"blockdef"`
}

type BgPresetsType struct {
	BgClear             bool    `json:"bg:*,omitempty"`
	Bg                  string  `json:"bg,omitempty" jsonschema_description:"CSS background property value"`
	BgOpacity           float64 `json:"bg:opacity,omitempty" jsonschema_description:"Background opacity (0.0-1.0)"`
	BgBlendMode         string  `json:"bg:blendmode,omitempty" jsonschema_description:"CSS background-blend-mode property value"`
	BgBorderColor       string  `json:"bg:bordercolor,omitempty" jsonschema_description:"Block frame border color"`
	BgActiveBorderColor string  `json:"bg:activebordercolor,omitempty" jsonschema_description:"Block frame focused border color"`
	DisplayName         string  `json:"display:name,omitempty" jsonschema_description:"The name shown in the context menu"`
	DisplayOrder        float64 `json:"display:order,omitempty" jsonschema_description:"Determines the order of the background in the context menu"`
}

type MimeTypeConfigType struct {
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

type TermThemeType struct {
	DisplayName         string  `json:"display:name"`
	DisplayOrder        float64 `json:"display:order"`
	Black               string  `json:"black"`
	Red                 string  `json:"red"`
	Green               string  `json:"green"`
	Yellow              string  `json:"yellow"`
	Blue                string  `json:"blue"`
	Magenta             string  `json:"magenta"`
	Cyan                string  `json:"cyan"`
	White               string  `json:"white"`
	BrightBlack         string  `json:"brightBlack"`
	BrightRed           string  `json:"brightRed"`
	BrightGreen         string  `json:"brightGreen"`
	BrightYellow        string  `json:"brightYellow"`
	BrightBlue          string  `json:"brightBlue"`
	BrightMagenta       string  `json:"brightMagenta"`
	BrightCyan          string  `json:"brightCyan"`
	BrightWhite         string  `json:"brightWhite"`
	Gray                string  `json:"gray"`
	CmdText             string  `json:"cmdtext"`
	Foreground          string  `json:"foreground"`
	SelectionBackground string  `json:"selectionBackground"`
	Background          string  `json:"background"`
	Cursor              string  `json:"cursor"`
}

func (fc *FullConfigType) CountCustomWidgets() int {
	count := 0
	for widgetID := range fc.Widgets {
		if !strings.HasPrefix(widgetID, "defwidget@") {
			count++
		}
	}
	return count
}

func (fc *FullConfigType) CountCustomAIPresets() int {
	count := 0
	for presetID := range fc.Presets {
		if strings.HasPrefix(presetID, "ai@") && presetID != "ai@global" && presetID != "ai@wave" {
			count++
		}
	}
	return count
}

func (fc *FullConfigType) CountCustomAIModes() int {
	count := 0
	for modeID := range fc.WaveAIModes {
		if !strings.HasPrefix(modeID, "waveai@") {
			count++
		}
	}
	return count
}

func CountCustomSettings() int {
	userSettings, _ := ReadWaveHomeConfigFile("settings.json")
	if userSettings == nil {
		return 0
	}

	count := 0
	for key := range userSettings {
		if key == "telemetry:enabled" || key == "autoupdate:channel" {
			continue
		}
		count++
	}

	return count
}
