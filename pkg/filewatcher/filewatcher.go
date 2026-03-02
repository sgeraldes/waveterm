// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package filewatcher

import (
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wavetermdev/waveterm/pkg/panichandler"
	"github.com/wavetermdev/waveterm/pkg/wps"
)

const (
	// Debounce delay to avoid rapid fire events
	DebounceDelay = 300 * time.Millisecond
)

type FileWatcher struct {
	watcher       *fsnotify.Watcher
	mutex         sync.Mutex
	watches       map[string]*watchEntry // path -> watchEntry
	debounceTimer map[string]*time.Timer // path -> timer
}

type watchEntry struct {
	path     string
	blockIds map[string]bool // set of blockIds watching this file
}

var instance *FileWatcher
var once sync.Once

// GetWatcher returns the singleton instance of the FileWatcher
func GetWatcher() *FileWatcher {
	once.Do(func() {
		watcher, err := fsnotify.NewWatcher()
		if err != nil {
			log.Printf("failed to create file watcher: %v", err)
			return
		}
		instance = &FileWatcher{
			watcher:       watcher,
			watches:       make(map[string]*watchEntry),
			debounceTimer: make(map[string]*time.Timer),
		}
		instance.start()
	})
	return instance
}

func (fw *FileWatcher) start() {
	go func() {
		defer func() {
			panichandler.PanicHandler("filewatcher:start", recover())
		}()
		for {
			select {
			case event, ok := <-fw.watcher.Events:
				if !ok {
					return
				}
				fw.handleEvent(event)
			case err, ok := <-fw.watcher.Errors:
				if !ok {
					return
				}
				log.Printf("file watcher error: %v", err)
			}
		}
	}()
}

func (fw *FileWatcher) handleEvent(event fsnotify.Event) {
	// Only care about write and remove events
	if event.Op&fsnotify.Write != fsnotify.Write && event.Op&fsnotify.Remove != fsnotify.Remove {
		return
	}

	// Clean the path
	cleanPath := filepath.Clean(event.Name)

	fw.mutex.Lock()
	defer fw.mutex.Unlock()

	entry, exists := fw.watches[cleanPath]
	if !exists {
		return
	}

	// Cancel any existing timer for this path
	if timer, ok := fw.debounceTimer[cleanPath]; ok {
		timer.Stop()
	}

	// Create a new debounced timer
	fw.debounceTimer[cleanPath] = time.AfterFunc(DebounceDelay, func() {
		fw.publishChangeEvent(cleanPath, entry.blockIds)
	})
}

func (fw *FileWatcher) publishChangeEvent(path string, blockIds map[string]bool) {
	// Get file modtime
	var modTime int64
	if info, err := os.Stat(path); err == nil {
		modTime = info.ModTime().UnixMilli()
	}

	// Publish event for each blockId
	for blockId := range blockIds {
		wps.Broker.Publish(wps.WaveEvent{
			Event:  wps.Event_FileChange,
			Scopes: []string{blockId},
			Data: wps.FileChangeEventData{
				Path:    path,
				BlockId: blockId,
				ModTime: modTime,
			},
		})
	}

	log.Printf("file change detected: %s (watching blocks: %d)", path, len(blockIds))
}

// AddWatch adds a file to be watched
func (fw *FileWatcher) AddWatch(path string, blockId string) error {
	cleanPath := filepath.Clean(path)

	fw.mutex.Lock()
	defer fw.mutex.Unlock()

	entry, exists := fw.watches[cleanPath]
	if !exists {
		// First watcher for this file, add to fsnotify
		err := fw.watcher.Add(cleanPath)
		if err != nil {
			return err
		}
		entry = &watchEntry{
			path:     cleanPath,
			blockIds: make(map[string]bool),
		}
		fw.watches[cleanPath] = entry
		log.Printf("started watching file: %s for block: %s", cleanPath, blockId)
	}

	// Add blockId to the set
	entry.blockIds[blockId] = true
	return nil
}

// RemoveWatch removes a blockId from watching a file
func (fw *FileWatcher) RemoveWatch(path string, blockId string) error {
	cleanPath := filepath.Clean(path)

	fw.mutex.Lock()
	defer fw.mutex.Unlock()

	entry, exists := fw.watches[cleanPath]
	if !exists {
		return nil
	}

	// Remove blockId from the set
	delete(entry.blockIds, blockId)

	// If no more blocks watching, remove from fsnotify
	if len(entry.blockIds) == 0 {
		err := fw.watcher.Remove(cleanPath)
		if err != nil {
			log.Printf("error removing watch for %s: %v", cleanPath, err)
		}
		delete(fw.watches, cleanPath)

		// Cancel any pending timer
		if timer, ok := fw.debounceTimer[cleanPath]; ok {
			timer.Stop()
			delete(fw.debounceTimer, cleanPath)
		}

		log.Printf("stopped watching file: %s", cleanPath)
	}

	return nil
}

// RemoveAllWatchesForBlock removes all watches for a specific blockId
func (fw *FileWatcher) RemoveAllWatchesForBlock(blockId string) {
	fw.mutex.Lock()
	defer fw.mutex.Unlock()

	pathsToRemove := []string{}

	for path, entry := range fw.watches {
		if _, exists := entry.blockIds[blockId]; exists {
			delete(entry.blockIds, blockId)
			if len(entry.blockIds) == 0 {
				pathsToRemove = append(pathsToRemove, path)
			}
		}
	}

	for _, path := range pathsToRemove {
		err := fw.watcher.Remove(path)
		if err != nil {
			log.Printf("error removing watch for %s: %v", path, err)
		}
		delete(fw.watches, path)

		// Cancel any pending timer
		if timer, ok := fw.debounceTimer[path]; ok {
			timer.Stop()
			delete(fw.debounceTimer, path)
		}
	}

	if len(pathsToRemove) > 0 {
		log.Printf("removed %d watches for block: %s", len(pathsToRemove), blockId)
	}
}

func (fw *FileWatcher) Close() {
	fw.mutex.Lock()
	defer fw.mutex.Unlock()

	// Cancel all timers
	for _, timer := range fw.debounceTimer {
		timer.Stop()
	}
	fw.debounceTimer = make(map[string]*time.Timer)

	if fw.watcher != nil {
		fw.watcher.Close()
		fw.watcher = nil
		log.Println("file watcher closed")
	}
}
