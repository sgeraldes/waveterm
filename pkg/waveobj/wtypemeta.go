
package waveobj

import (
	"strings"
)

const Entity_Any = "any"

type MetaTSType struct {
	View           string   `json:"view,omitempty"`
	Controller     string   `json:"controller,omitempty"`
	File           string   `json:"file,omitempty"`
	Url            string   `json:"url,omitempty"`
	PinnedUrl      string   `json:"pinnedurl,omitempty"`
	Connection     string   `json:"connection,omitempty"`
	ShellProfile   string   `json:"shell:profile,omitempty"`
	Edit           bool     `json:"edit,omitempty"`
	History        []string `json:"history,omitempty"`
	HistoryForward []string `json:"history:forward,omitempty"`

	DisplayName  string  `json:"display:name,omitempty"`
	DisplayOrder float64 `json:"display:order,omitempty"`

	Icon      string `json:"icon,omitempty"`
	IconColor string `json:"icon:color,omitempty"`

	FrameClear             bool   `json:"frame:*,omitempty"`
	Frame                  bool   `json:"frame,omitempty"`
	FrameBorderColor       string `json:"frame:bordercolor,omitempty"`
	FrameActiveBorderColor string `json:"frame:activebordercolor,omitempty"`
	FrameTitle             string `json:"frame:title,omitempty"`
	FrameIcon              string `json:"frame:icon,omitempty"`
	FrameText              string `json:"frame:text,omitempty"`

	CmdClear            bool     `json:"cmd:*,omitempty"`
	Cmd                 string   `json:"cmd,omitempty"`
	CmdInteractive      bool     `json:"cmd:interactive,omitempty"`
	CmdLogin            bool     `json:"cmd:login,omitempty"`
	CmdPersistent       bool     `json:"cmd:persistent,omitempty"`
	CmdRunOnStart       bool     `json:"cmd:runonstart,omitempty"`
	CmdClearOnStart     bool     `json:"cmd:clearonstart,omitempty"`
	CmdRunOnce          bool     `json:"cmd:runonce,omitempty"`
	CmdCloseOnExit      bool     `json:"cmd:closeonexit,omitempty"`
	CmdCloseOnExitForce bool     `json:"cmd:closeonexitforce,omitempty"`
	CmdCloseOnExitDelay float64  `json:"cmd:closeonexitdelay,omitempty"`
	CmdNoWsh            bool     `json:"cmd:nowsh,omitempty"`
	CmdArgs             []string `json:"cmd:args,omitempty"`
	CmdShell            bool     `json:"cmd:shell,omitempty"`
	CmdAllowConnChange  bool     `json:"cmd:allowconnchange,omitempty"`
	CmdJwt              bool     `json:"cmd:jwt,omitempty"`

	CmdEnv            map[string]string `json:"cmd:env,omitempty"`
	CmdCwd            string            `json:"cmd:cwd,omitempty"`
	CmdInitScript     string            `json:"cmd:initscript,omitempty"`
	CmdInitScriptSh   string            `json:"cmd:initscript.sh,omitempty"`
	CmdInitScriptBash string            `json:"cmd:initscript.bash,omitempty"`
	CmdInitScriptZsh  string            `json:"cmd:initscript.zsh,omitempty"`
	CmdInitScriptPwsh string            `json:"cmd:initscript.pwsh,omitempty"`
	CmdInitScriptFish string            `json:"cmd:initscript.fish,omitempty"`

	AiClear      bool    `json:"ai:*,omitempty"`
	AiPresetKey  string  `json:"ai:preset,omitempty"`
	AiApiType    string  `json:"ai:apitype,omitempty"`
	AiBaseURL    string  `json:"ai:baseurl,omitempty"`
	AiApiToken   string  `json:"ai:apitoken,omitempty"`
	AiName       string  `json:"ai:name,omitempty"`
	AiModel      string  `json:"ai:model,omitempty"`
	AiOrgID      string  `json:"ai:orgid,omitempty"`
	AIApiVersion string  `json:"ai:apiversion,omitempty"`
	AiMaxTokens  float64 `json:"ai:maxtokens,omitempty"`
	AiTimeoutMs  float64 `json:"ai:timeoutms,omitempty"`

	AiFileDiffChatId     string `json:"aifilediff:chatid,omitempty"`
	AiFileDiffToolCallId string `json:"aifilediff:toolcallid,omitempty"`

	EditorClear               bool    `json:"editor:*,omitempty"`
	EditorMinimapEnabled      bool    `json:"editor:minimapenabled,omitempty"`
	EditorStickyScrollEnabled bool    `json:"editor:stickyscrollenabled,omitempty"`
	EditorWordWrap            bool    `json:"editor:wordwrap,omitempty"`
	EditorFontSize            float64 `json:"editor:fontsize,omitempty"`

	GraphClear     bool     `json:"graph:*,omitempty"`
	GraphNumPoints int      `json:"graph:numpoints,omitempty"`
	GraphMetrics   []string `json:"graph:metrics,omitempty"`

	SysinfoType string `json:"sysinfo:type,omitempty"`

	BgClear             bool    `json:"bg:*,omitempty"`
	Bg                  string  `json:"bg,omitempty"`
	BgOpacity           float64 `json:"bg:opacity,omitempty"`
	BgBlendMode         string  `json:"bg:blendmode,omitempty"`
	BgBorderColor       string  `json:"bg:bordercolor,omitempty"`
	BgActiveBorderColor string  `json:"bg:activebordercolor,omitempty"`
	BgText              string  `json:"bg:text,omitempty"`
	TabBaseDir          string  `json:"tab:basedir,omitempty"`
	TabBaseDirLock      bool    `json:"tab:basedirlock,omitempty"`
	TabWslDistro        string  `json:"tab:wsldistro,omitempty"`
	TabColor            string  `json:"tab:color,omitempty"`
	TabTermStatus       string  `json:"tab:termstatus,omitempty"`
	TabGroup            string  `json:"tab:group,omitempty"`
	TabGroupColor       string  `json:"tab:groupcolor,omitempty"`
	TabFavorite         bool    `json:"tab:favorite,omitempty"`
	TabIcon             string  `json:"tab:icon,omitempty"`

	WaveAiPanelOpen     bool   `json:"waveai:panelopen,omitempty"`
	WaveAiPanelWidth    int    `json:"waveai:panelwidth,omitempty"`
	WaveAiModel         string `json:"waveai:model,omitempty"`
	WaveAiChatId        string `json:"waveai:chatid,omitempty"`
	WaveAiWidgetContext *bool  `json:"waveai:widgetcontext,omitempty"`

	TermClear               bool     `json:"term:*,omitempty"`
	TermFontSize            int      `json:"term:fontsize,omitempty"`
	TermFontFamily          string   `json:"term:fontfamily,omitempty"`
	TermMode                string   `json:"term:mode,omitempty"`
	TermTheme               string   `json:"term:theme,omitempty"`
	TermLocalShellPath      string   `json:"term:localshellpath,omitempty"`
	TermLocalShellOpts      []string `json:"term:localshellopts,omitempty"`
	TermScrollback   *int     `json:"term:scrollback,omitempty"`
	TermTransparency *float64 `json:"term:transparency,omitempty"`
	TermAllowBracketedPaste *bool    `json:"term:allowbracketedpaste,omitempty"`
	TermShiftEnterNewline   *bool    `json:"term:shiftenternewline,omitempty"`
	TermMacOptionIsMeta     *bool    `json:"term:macoptionismeta,omitempty"`
	TermConnDebug           string   `json:"term:conndebug,omitempty"`
	TermBellSound           *bool    `json:"term:bellsound,omitempty"`
	TermBellIndicator       *bool    `json:"term:bellindicator,omitempty"`
	TermReportFocus         *bool    `json:"term:reportfocus,omitempty"`

	WebZoom          float64 `json:"web:zoom,omitempty"`
	WebHideNav       *bool   `json:"web:hidenav,omitempty"`
	WebPartition     string  `json:"web:partition,omitempty"`
	WebUserAgentType string  `json:"web:useragenttype,omitempty"`

	MarkdownFontSize      float64 `json:"markdown:fontsize,omitempty"`
	MarkdownFixedFontSize float64 `json:"markdown:fixedfontsize,omitempty"`

	OnboardingGithubStar  bool   `json:"onboarding:githubstar,omitempty"`
	OnboardingLastVersion string `json:"onboarding:lastversion,omitempty"`

	Count int `json:"count,omitempty"`
}

type MetaDataDecl struct {
	Key        string   `json:"key"`
	Desc       string   `json:"desc,omitempty"`
	Type       string   `json:"type"`
	Default    any      `json:"default,omitempty"`
	StrOptions []string `json:"stroptions,omitempty"`
	NumRange   []*int   `json:"numrange,omitempty"`
	Entity     []string `json:"entity"`
	Special    []string `json:"special,omitempty"`
}

type MetaPresetDecl struct {
	Preset string   `json:"preset"`
	Desc   string   `json:"desc,omitempty"`
	Keys   []string `json:"keys"`
	Entity []string `json:"entity"`
}

func MergeMeta(meta MetaMapType, metaUpdate MetaMapType, mergeSpecial bool) MetaMapType {
	rtn := make(MetaMapType)
	for k, v := range meta {
		rtn[k] = v
	}
	for k := range metaUpdate {
		if !strings.HasSuffix(k, ":*") {
			continue
		}
		if !metaUpdate.GetBool(k, false) {
			continue
		}
		prefix := strings.TrimSuffix(k, ":*")
		if prefix == "" {
			continue
		}
		prefixColon := prefix + ":"
		for k2 := range rtn {
			if k2 == prefix || strings.HasPrefix(k2, prefixColon) {
				delete(rtn, k2)
			}
		}
	}
	for k, v := range metaUpdate {
		if !mergeSpecial && strings.HasPrefix(k, "display:") {
			continue
		}
		if strings.HasSuffix(k, ":*") {
			continue
		}
		if v == nil {
			delete(rtn, k)
			continue
		}
		rtn[k] = v
	}
	return rtn
}
