import * as electron from "electron";
import * as child_process from "node:child_process";
import path from "path";
import * as readline from "readline";
import { WebServerEndpointVarName, WSServerEndpointVarName } from "../frontend/util/endpoints";
import { AuthKey, WaveAuthKeyEnv } from "./authkey";
import { setForceQuit, setUserConfirmedQuit } from "./emain-activity";
import {
    getElectronAppResourcesPath,
    getElectronAppUnpackedBasePath,
    getWaveConfigDir,
    getWaveDataDir,
    getWaveSrvCwd,
    getWaveSrvPath,
    getXdgCurrentDesktop,
    WaveConfigHomeVarName,
    WaveDataHomeVarName,
} from "./emain-platform";
import {
    getElectronExecPath,
    WaveAppElectronExecPath,
    WaveAppPathVarName,
    WaveAppResourcesPathVarName,
} from "./emain-util";
import { updater } from "./updater";

let isWaveSrvDead = false;
let waveSrvProc: child_process.ChildProcessWithoutNullStreams | null = null;
let WaveVersion = "unknown";
let WaveBuildTime = 0;

export function getWaveVersion(): { version: string; buildTime: number } {
    return { version: WaveVersion, buildTime: WaveBuildTime };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let waveSrvReadyResolve = (_value: boolean) => {};
const waveSrvReady: Promise<boolean> = new Promise((resolve) => {
    waveSrvReadyResolve = resolve;
});

export function getWaveSrvReady(): Promise<boolean> {
    return waveSrvReady;
}

export function getWaveSrvProc(): child_process.ChildProcessWithoutNullStreams | null {
    return waveSrvProc;
}

export function getIsWaveSrvDead(): boolean {
    return isWaveSrvDead;
}

export function runWaveSrv(handleWSEvent: (evtMsg: WSEventType) => void): Promise<boolean> {
    let pResolve: (value: boolean) => void;
    let pReject: (reason?: unknown) => void;
    const rtnPromise = new Promise<boolean>((argResolve, argReject) => {
        pResolve = argResolve;
        pReject = argReject;
    });
    const envCopy = { ...process.env };
    const xdgCurrentDesktop = getXdgCurrentDesktop();
    if (xdgCurrentDesktop != null) {
        envCopy["XDG_CURRENT_DESKTOP"] = xdgCurrentDesktop;
    }
    envCopy[WaveAppPathVarName] = getElectronAppUnpackedBasePath();
    envCopy[WaveAppResourcesPathVarName] = getElectronAppResourcesPath();
    envCopy[WaveAppElectronExecPath] = getElectronExecPath();
    envCopy[WaveAuthKeyEnv] = AuthKey;
    envCopy[WaveDataHomeVarName] = getWaveDataDir();
    envCopy[WaveConfigHomeVarName] = getWaveConfigDir();
    if (!electron.app.isPackaged && !envCopy["WAVETERM_ENVFILE"]) {
        envCopy["WAVETERM_ENVFILE"] = path.resolve(getElectronAppResourcesPath(), "..", ".env");
    }
    const waveSrvCmd = getWaveSrvPath();
    console.log("trying to run local server", waveSrvCmd);
    const proc = child_process.spawn(getWaveSrvPath(), {
        cwd: getWaveSrvCwd(),
        env: envCopy,
    });
    proc.on("exit", () => {
        if (updater?.status == "installing") {
            return;
        }
        console.log("wavesrv exited, shutting down");
        setForceQuit(true);
        isWaveSrvDead = true;
        electron.app.quit();
    });
    proc.on("spawn", () => {
        console.log("spawned wavesrv");
        waveSrvProc = proc;
        pResolve(true);
    });
    proc.on("error", (e) => {
        console.log("error running wavesrv", e);
        pReject(e);
    });
    const rlStdout = readline.createInterface({
        input: proc.stdout,
        terminal: false,
    });
    rlStdout.on("line", (line) => {
        console.log(line);
    });
    const rlStderr = readline.createInterface({
        input: proc.stderr,
        terminal: false,
    });
    rlStderr.on("line", (line) => {
        if (line.includes("WAVESRV-ESTART")) {
            const startParams = /ws:([a-z0-9.:]+) web:([a-z0-9.:]+) version:([a-z0-9.-]+) buildtime:(\d+)/gm.exec(line);
            if (startParams == null) {
                console.log("error parsing WAVESRV-ESTART line", line);
                setUserConfirmedQuit(true);
                electron.app.quit();
                return;
            }
            process.env[WSServerEndpointVarName] = startParams[1];
            process.env[WebServerEndpointVarName] = startParams[2];
            WaveVersion = startParams[3];
            WaveBuildTime = parseInt(startParams[4]);
            waveSrvReadyResolve(true);
            return;
        }
        if (line.startsWith("WAVESRV-EVENT:")) {
            const evtJson = line.slice("WAVESRV-EVENT:".length);
            try {
                const evtMsg: WSEventType = JSON.parse(evtJson);
                handleWSEvent(evtMsg);
            } catch (e) {
                console.log("error handling WAVESRV-EVENT", e);
            }
            return;
        }
        console.log(line);
    });
    return rtnPromise;
}
