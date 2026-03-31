import { createBlock, getApi, pushNotification } from "@/app/store/global";
import { makeNativeLabel } from "./platformutil";
import { fireAndForget } from "./util";
import { formatRemoteUri } from "./waveutil";

/**
 * Returns true when the mimetype is NOT natively previewable by Wave.
 * Previewable types: text/*, markdown, CSV, images, PDF, audio, video, and
 * common application text formats (json, yaml, toml, xml, scripts).
 * Everything else — executables, archives, unknown types — should be opened
 * by the OS default application.
 */
export function isNativeOpenable(mimeType: string): boolean {
    if (mimeType == null || mimeType === "") {
        return true;
    }
    // Wave can preview text files
    if (mimeType.startsWith("text/")) {
        return false;
    }
    // Wave can preview images, audio, video, PDF
    if (
        mimeType.startsWith("image/") ||
        mimeType.startsWith("audio/") ||
        mimeType.startsWith("video/") ||
        mimeType.startsWith("application/pdf")
    ) {
        return false;
    }
    // Wave can preview common application text formats
    if (
        mimeType.startsWith("application/") &&
        (mimeType.includes("json") ||
            mimeType.includes("yaml") ||
            mimeType.includes("toml") ||
            mimeType.includes("xml") ||
            mimeType.includes("x-sh") ||
            mimeType.includes("x-python") ||
            mimeType.includes("x-awk") ||
            mimeType.includes("javascript") ||
            mimeType.includes("typescript") ||
            mimeType.includes("sql"))
    ) {
        return false;
    }
    // Everything else: executables, archives, unknown types → open natively
    return true;
}

function pushOpenNativeError(errMsg: string) {
    pushNotification({
        id: "open-native-error",
        icon: "triangle-exclamation",
        title: "Cannot Open File",
        message: errMsg,
        timestamp: Date.now().toString(),
        type: "error",
    });
}

export function addOpenMenuItems(menu: ContextMenuItem[], conn: string, finfo: FileInfo): ContextMenuItem[] {
    if (!finfo) {
        return menu;
    }

    const isLocal = !conn;
    const isDir = finfo.isdir;

    // ── Open (local only; grayed for remote) ──────────────────────────────
    if (!isDir) {
        menu.push({
            label: "Open",
            enabled: isLocal,
            click: isLocal
                ? () => {
                      fireAndForget(async () => {
                          const errMsg = await getApi().openNativePathExplicit(finfo.path);
                          if (errMsg) {
                              pushOpenNativeError(errMsg);
                          }
                      });
                  }
                : undefined,
        });

        // ── Open With submenu (local only) ────────────────────────────────
        menu.push({
            label: "Open With",
            enabled: isLocal,
            submenu: isLocal
                ? [
                      {
                          label: "Open in Wave Preview",
                          click: () =>
                              fireAndForget(async () => {
                                  const blockDef: BlockDef = {
                                      meta: {
                                          view: "preview",
                                          file: finfo.path,
                                          connection: conn,
                                      },
                                  };
                                  await createBlock(blockDef);
                              }),
                      },
                      {
                          label: "Open in Terminal (as argument)",
                          click: () => {
                              const termBlockDef: BlockDef = {
                                  meta: {
                                      controller: "shell",
                                      view: "term",
                                      "cmd:cwd": finfo.dir,
                                      connection: conn,
                                  },
                              };
                              fireAndForget(() => createBlock(termBlockDef));
                          },
                      },
                      { type: "separator" },
                      {
                          label: makeNativeLabel(true),
                          click: () => {
                              fireAndForget(async () => {
                                  const errMsg = await getApi().openNativePath(finfo.dir);
                                  if (errMsg) {
                                      pushOpenNativeError(errMsg);
                                  }
                              });
                          },
                      },
                  ]
                : [],
        });
    } else {
        // For directories: Reveal in Finder/Explorer (local only)
        menu.push({
            label: makeNativeLabel(true),
            enabled: isLocal,
            click: isLocal
                ? () => {
                      fireAndForget(async () => {
                          const errMsg = await getApi().openNativePath(finfo.path);
                          if (errMsg) {
                              pushOpenNativeError(errMsg);
                          }
                      });
                  }
                : undefined,
        });
    }

    // ── Open Preview in New Block ──────────────────────────────────────────
    if (!isDir) {
        menu.push({
            label: "Open Preview in New Block",
            click: () =>
                fireAndForget(async () => {
                    const blockDef: BlockDef = {
                        meta: {
                            view: "preview",
                            file: finfo.path,
                            connection: conn,
                        },
                    };
                    await createBlock(blockDef);
                }),
        });
    }

    // ── Open Terminal Here ─────────────────────────────────────────────────
    menu.push({
        label: "Open Terminal Here",
        click: () => {
            const termBlockDef: BlockDef = {
                meta: {
                    controller: "shell",
                    view: "term",
                    "cmd:cwd": isDir ? finfo.path : finfo.dir,
                    connection: conn,
                },
            };
            fireAndForget(() => createBlock(termBlockDef));
        },
    });

    // ── Remote fallback: Download File ────────────────────────────────────
    if (!isLocal && !isDir) {
        menu.push({
            label: "Download File",
            click: () => {
                const remoteUri = formatRemoteUri(finfo.path, conn);
                getApi().downloadFile(remoteUri);
            },
        });
    }

    return menu;
}
