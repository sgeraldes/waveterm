export const NOTES_FILENAME = ".wave/NOTES.md";

/**
 * Returns the notes file path given a tab base directory and optional override file.
 * Exported for unit testing.
 */
export function getNotesFilePath(tabBasedir: string, metaFile: string | null): string {
    if (metaFile) {
        return metaFile;
    }
    if (!tabBasedir || tabBasedir === "~") {
        return `~/${NOTES_FILENAME}`;
    }
    return `${tabBasedir}/${NOTES_FILENAME}`;
}

/**
 * Returns true if the notes path is the default (.wave/NOTES.md).
 */
export function isDefaultNotesPath(notesPath: string): boolean {
    return notesPath.endsWith(NOTES_FILENAME);
}

/**
 * Returns true if the notes status bar should be visible.
 * Hidden when using default path with no save status and local connection.
 */
export function shouldShowNotesStatusBar(isDefaultPath: boolean, saveStatus: string | null, isLocal: boolean): boolean {
    return !isDefaultPath || saveStatus != null || !isLocal;
}
