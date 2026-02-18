// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

const NOTES_FILENAME = ".wave/NOTES.md";

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
