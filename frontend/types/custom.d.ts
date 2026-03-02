// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0


import { type Placement } from "@floating-ui/react";
import type * as jotai from "jotai";
import type * as rxjs from "rxjs";

declare global {
    type GlobalAtomsType = {
        uiContext: jotai.Atom<UIContext>;
        workspace: jotai.Atom<Workspace>;
        fullConfigAtom: jotai.PrimitiveAtom<FullConfigType>;
        waveaiModeConfigAtom: jotai.PrimitiveAtom<Record<string, AIModeConfigType>>;
        settingsAtom: jotai.Atom<SettingsType>;
        hasCustomAIPresetsAtom: jotai.Atom<boolean>;
        staticTabId: jotai.Atom<string>;
        activeTab: jotai.Atom<Tab>;
        isFullScreen: jotai.PrimitiveAtom<boolean>;
        zoomFactorAtom: jotai.PrimitiveAtom<number>;
        controlShiftDelayAtom: jotai.PrimitiveAtom<boolean>;
        prefersReducedMotionAtom: jotai.Atom<boolean>;
        documentHasFocus: jotai.PrimitiveAtom<boolean>;
        updaterStatusAtom: jotai.PrimitiveAtom<UpdaterStatus>;
        modalOpen: jotai.PrimitiveAtom<boolean>;
        allConnStatus: jotai.Atom<ConnStatus[]>;
        flashErrors: jotai.PrimitiveAtom<FlashErrorType[]>;
        notifications: jotai.PrimitiveAtom<NotificationType[]>;
        notificationPopoverMode: jotai.PrimitiveAtom<boolean>;
        reinitVersion: jotai.PrimitiveAtom<number>;
        waveAIRateLimitInfoAtom: jotai.PrimitiveAtom<RateLimitInfo>;
    };

    type WritableWaveObjectAtom<T extends WaveObj> = jotai.WritableAtom<T, [value: T], void>;

    type ThrottledValueAtom<T> = jotai.WritableAtom<T, [update: jotai.SetStateAction<T>], void>;

    type AtomWithThrottle<T> = {
        currentValueAtom: jotai.Atom<T>;
        throttledValueAtom: ThrottledValueAtom<T>;
    };

    type DebouncedValueAtom<T> = jotai.WritableAtom<T, [update: jotai.SetStateAction<T>], void>;

    type AtomWithDebounce<T> = {
        currentValueAtom: jotai.Atom<T>;
        debouncedValueAtom: DebouncedValueAtom<T>;
    };

    type SplitAtom<Item> = Atom<Atom<Item>[]>;
    type WritableSplitAtom<Item> = WritableAtom<PrimitiveAtom<Item>[], [SplitAtomAction<Item>], void>;

    type TabLayoutData = {
        blockId: string;
    };

    type GlobalInitOptions = {
        tabId?: string;
        platform: NodeJS.Platform;
        windowId: string;
        clientId: string;
        environment: "electron" | "renderer";
        primaryTabStartup?: boolean;
    };

    type WaveInitOpts = {
        tabId: string;
        clientId: string;
        windowId: string;
        activate: boolean;
        primaryTabStartup?: boolean;
    };

    type ElectronApi = {
        getAuthKey(): string;
        getIsDev(): boolean;
        getCursorPoint: () => Electron.Point;
        getPlatform: () => NodeJS.Platform;
        getEnv: (varName: string) => string;
        getUserName: () => string;
        getHostName: () => string;
        getDataDir: () => string;
        getConfigDir: () => string;
        getHomeDir: () => string;
        getWebviewPreload: () => string;
        getAboutModalDetails: () => AboutModalDetails;
        getZoomFactor: () => number;
        showWorkspaceAppMenu: (workspaceId: string) => void;
        showContextMenu: (workspaceId: string, menu: ElectronContextMenuItem[]) => void;
        onContextMenuClick: (callback: (id: string) => void) => void;
        downloadFile: (path: string) => void;
        openExternal: (url: string) => void;
        onFullScreenChange: (callback: (isFullScreen: boolean) => void) => void;
        onZoomFactorChange: (callback: (zoomFactor: number) => void) => void;
        onUpdaterStatusChange: (callback: (status: UpdaterStatus) => void) => void;
        getUpdaterStatus: () => UpdaterStatus;
        getUpdaterChannel: () => string;
        installAppUpdate: () => void;
        onMenuItemAbout: (callback: () => void) => void;
        updateWindowControlsOverlay: (rect: Dimensions) => void;
        onReinjectKey: (callback: (waveEvent: WaveKeyboardEvent) => void) => void;
        setWebviewFocus: (focusedId: number) => void;
        registerGlobalWebviewKeys: (keys: string[]) => void;
        onControlShiftStateUpdate: (callback: (state: boolean) => void) => void;
        createWorkspace: () => void;
        switchWorkspace: (workspaceId: string) => void;
        deleteWorkspace: (workspaceId: string) => void;
        setActiveTab: (tabId: string) => void;
        createTab: () => void;
        closeTab: (workspaceId: string, tabId: string) => void;
        setWindowInitStatus: (status: "ready" | "wave-ready") => void;
        onWaveInit: (callback: (initOpts: WaveInitOpts) => void) => void;
        onWaveActivate: (callback: () => void) => void;
        sendLog: (log: string) => void;
        onQuicklook: (filePath: string) => void;
        openNativePath(filePath: string): Promise<string>;
        captureScreenshot(rect: Electron.Rectangle): Promise<string>;
        setKeyboardChordMode: () => void;
        clearWebviewStorage: (webContentsId: number) => Promise<void>;
        setWaveAIOpen: (isOpen: boolean) => void;
        incrementTermCommands: () => void;
        nativePaste: () => void;
        doRefresh: () => void;
        showOpenDialog: (options: OpenDialogOptions) => Promise<string[]>;
        setNativeThemeSource: (theme: "light" | "dark" | "system") => void;
        handleWebViewNavigation: (
            blockId: string,
            url: string,
            eventType: "did-navigate" | "did-navigate-in-page" | "will-navigate",
            isMainFrame?: boolean
        ) => void;
    };

    type ElectronContextMenuItem = {
        id: string;
        label: string;
        role?: string;
        type?: "separator" | "normal" | "submenu" | "checkbox" | "radio" | "header";
        submenu?: ElectronContextMenuItem[];
        checked?: boolean;
        visible?: boolean;
        enabled?: boolean;
        sublabel?: string;
    };

    type ContextMenuItem = {
        label?: string;
        type?: "separator" | "normal" | "submenu" | "checkbox" | "radio" | "header";
        role?: string;
        click?: () => void;
        submenu?: ContextMenuItem[];
        checked?: boolean;
        visible?: boolean;
        enabled?: boolean;
        sublabel?: string;
    };

    type WaveKeyboardEvent = {
        type: "keydown" | "keyup" | "keypress" | "unknown";
        key: string;
        code: string;
        repeat?: boolean;
        location?: number;
        shift?: boolean;
        control?: boolean;
        alt?: boolean;
        meta?: boolean;
        cmd?: boolean;
        option?: boolean;
    };

    type KeyPressDecl = {
        mods: {
            Cmd?: boolean;
            Option?: boolean;
            Shift?: boolean;
            Ctrl?: boolean;
            Alt?: boolean;
            Meta?: boolean;
        };
        key: string;
        keyType: string;
    };

    type SubjectWithRef<T> = rxjs.Subject<T> & { refCount: number; release: () => void };

    type HeaderElem =
        | IconButtonDecl
        | ToggleIconButtonDecl
        | HeaderText
        | HeaderInput
        | HeaderDiv
        | HeaderTextButton
        | ConnectionButton
        | MenuButton;

    type IconButtonCommon = {
        icon: string | React.ReactNode;
        iconColor?: string;
        iconSpin?: boolean;
        className?: string;
        title?: string;
        disabled?: boolean;
        noAction?: boolean;
    };

    type IconButtonDecl = IconButtonCommon & {
        elemtype: "iconbutton";
        click?: (e: React.MouseEvent<any>) => void;
        longClick?: (e: React.MouseEvent<any>) => void;
    };

    type ToggleIconButtonDecl = IconButtonCommon & {
        elemtype: "toggleiconbutton";
        active: jotai.WritableAtom<boolean, [boolean], void>;
    };

    type HeaderTextButton = {
        elemtype: "textbutton";
        text: string;
        className?: string;
        title?: string;
        onClick?: (e: React.MouseEvent<any>) => void;
    };

    type HeaderText = {
        elemtype: "text";
        text: string;
        ref?: React.RefObject<HTMLDivElement>;
        className?: string;
        noGrow?: boolean;
        onClick?: (e: React.MouseEvent<any>) => void;
    };

    type HeaderInput = {
        elemtype: "input";
        value: string;
        className?: string;
        isDisabled?: boolean;
        ref?: React.RefObject<HTMLInputElement>;
        onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
        onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
        onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
        onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    };

    type HeaderDiv = {
        elemtype: "div";
        className?: string;
        children: HeaderElem[];
        onMouseOver?: (e: React.MouseEvent<any>) => void;
        onMouseOut?: (e: React.MouseEvent<any>) => void;
        onClick?: (e: React.MouseEvent<any>) => void;
    };

    type ConnectionButton = {
        elemtype: "connectionbutton";
        icon: string;
        text: string;
        iconColor: string;
        onClick?: (e: React.MouseEvent<any>) => void;
        connected: boolean;
    };

    type MenuItem = {
        label: string;
        icon?: string | React.ReactNode;
        subItems?: MenuItem[];
        onClick?: (e: React.MouseEvent<any>) => void;
    };

    type MenuButtonProps = {
        items: MenuItem[];
        className?: string;
        text: string;
        title?: string;
        menuPlacement?: Placement;
    };

    type MenuButton = {
        elemtype: "menubutton";
    } & MenuButtonProps;

    type SearchAtoms = {
        searchValue: PrimitiveAtom<string>;
        resultsIndex: PrimitiveAtom<number>;
        resultsCount: PrimitiveAtom<number>;
        isOpen: PrimitiveAtom<boolean>;
        regex?: PrimitiveAtom<boolean>;
        caseSensitive?: PrimitiveAtom<boolean>;
        wholeWord?: PrimitiveAtom<boolean>;
    };

    declare type ViewComponentProps<T extends ViewModel> = {
        blockId: string;
        blockRef: React.RefObject<HTMLDivElement>;
        contentRef: React.RefObject<HTMLDivElement>;
        model: T;
    };

    declare type ViewComponent = React.FC<ViewComponentProps>;

    type ViewModelClass = new (blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) => ViewModel;

    interface ViewModel {
        viewType: string;

        useTermHeader?: jotai.Atom<boolean>;

        hideViewName?: jotai.Atom<boolean>;

        // Icon representing the view, can be a string or an IconButton declaration.
        viewIcon?: jotai.Atom<string | IconButtonDecl>;

        viewIconColor?: jotai.Atom<string>;

        // Display name for the view, used in UI headers.
        viewName?: jotai.Atom<string>;

        viewText?: jotai.Atom<string | HeaderElem[]>;

        termDurableStatus?: jotai.Atom<BlockJobStatusData | null>;
        termConfigedDurable?: jotai.Atom<null | boolean>;

        // Icon button displayed before the title in the header.
        preIconButton?: jotai.Atom<IconButtonDecl>;

        endIconButtons?: jotai.Atom<IconButtonDecl[]>;

        blockBg?: jotai.Atom<MetaType>;

        noHeader?: jotai.Atom<boolean>;

        manageConnection?: jotai.Atom<boolean>;

        filterOutNowsh?: jotai.Atom<boolean>;

        noPadding?: jotai.Atom<boolean>;

        searchAtoms?: SearchAtoms;

        viewComponent: ViewComponent<ViewModel>;

        isBasicTerm?: (getFn: jotai.Getter) => boolean;

        getSettingsMenuItems?: () => ContextMenuItem[];

        giveFocus?: () => boolean;

        keyDownHandler?: (e: WaveKeyboardEvent) => boolean;

        hasPendingChanges?: () => boolean;

        saveChanges?: () => Promise<void>;

        dispose?: () => void;

        goHistoryBack?: () => void;
        goHistoryForward?: () => void;
    }

    type UpdaterStatus = "up-to-date" | "checking" | "downloading" | "ready" | "error" | "installing";

    type Loadable<T> = { state: "loading" } | { state: "hasData"; data: T } | { state: "hasError"; error: unknown };

    interface Dimensions {
        width: number;
        height: number;
        left: number;
        top: number;
    }

    type TypeAheadModalType = { [key: string]: boolean };

    interface AboutModalDetails {
        version: string;
        buildTime: number;
    }

    type BlockComponentModel = {
        openSwitchConnection?: () => void;
        viewModel: ViewModel;
    };

    type ConnStatusType = "connected" | "connecting" | "disconnected" | "error" | "init";

    interface SuggestionBaseItem {
        label: string;
        value: string;
        icon?: string | React.ReactNode;
    }

    interface SuggestionConnectionItem extends SuggestionBaseItem {
        status: ConnStatusType;
        iconColor: string;
        onSelect?: (_: string) => void;
        current?: boolean;
    }

    interface SuggestionConnectionScope {
        headerText?: string;
        items: SuggestionConnectionItem[];
    }

    type SuggestionsType = SuggestionConnectionItem | SuggestionConnectionScope;

    type MarkdownResolveOpts = {
        connName: string;
        baseDir: string;
    };

    type FlashErrorType = {
        id: string;
        icon: string;
        title: string;
        message: string;
        expiration: number;
    };

    export type NotificationActionType = {
        label: string;
        actionKey: string;
        rightIcon?: string;
        color?: "green" | "grey";
        disabled?: boolean;
    };

    export type NotificationType = {
        id?: string;
        icon: string;
        title: string;
        message: string;
        timestamp: string;
        expiration?: number;
        hidden?: boolean;
        actions?: NotificationActionType[];
        persistent?: boolean;
        type?: "error" | "update" | "info" | "warning";
    };

    interface AbstractWshClient {
        recvRpcMessage(msg: RpcMessage): void;
    }

    type ClientRpcEntry = {
        reqId: string;
        startTs: number;
        command: string;
        msgFn: (msg: RpcMessage) => void;
    };

    type TimeSeriesMeta = {
        name?: string;
        color?: string;
        label?: string;
        maxy?: string | number;
        miny?: string | number;
        decimalPlaces?: number;
    };

    interface SuggestionRequestContext {
        widgetid: string;
        reqnum: number;
        dispose?: boolean;
    }

    type SuggestionsFnType = (query: string, reqContext: SuggestionRequestContext) => Promise<FetchSuggestionsResponse>;

    type DraggedFile = {
        uri: string;
        absParent: string;
        relName: string;
        isDir: boolean;
    };

    type ErrorButtonDef = {
        text: string;
        onClick: () => void;
    };

    type ErrorMsg = {
        status: string;
        text: string;
        level?: "error" | "warning";
        buttons?: Array<ErrorButtonDef>;
        closeAction?: () => void;
        showDismiss?: boolean;
    };

    type AIMessage = {
        messageid: string;
        parts: AIMessagePart[];
    };

    type AIMessagePart =
        | {
              type: "text";
              text: string;
          }
        | {
              type: "file";
              mimetype: string;
              filename?: string;
              data?: string;
              url?: string;
              size?: number;
              previewurl?: string;
          };

    type AIModeConfigWithMode = { mode: string } & AIModeConfigType;

    type OpenDialogOptions = {
        title?: string;
        defaultPath?: string;
        properties?: Array<"openFile" | "openDirectory" | "multiSelections" | "showHiddenFiles">;
        filters?: Array<{ name: string; extensions: string[] }>;
        message?: string;
        buttonLabel?: string;
    };
}

export {};
