
package sessionhistory

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

func (s *Store) Cleanup(maxAge time.Duration, maxSizeBytes int64) error {
	entries, err := os.ReadDir(s.root)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("sessionhistory: cleanup list root: %w", err)
	}

	cutoff := time.Now().Add(-maxAge)

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		blockId := entry.Name()
		mu := s.getBlockMu(blockId)
		mu.Lock()
		_ = s.deleteOldSegments(blockId, cutoff)
		mu.Unlock()
	}
	s.pruneEmptyDirs()

	type globalFile struct {
		blockId string
		name    string
		size    int64
		modTime time.Time
	}
	var allFiles []globalFile
	var totalSize int64

	entries2, err := os.ReadDir(s.root)
	if err != nil {
		return nil
	}
	for _, entry := range entries2 {
		if !entry.IsDir() {
			continue
		}
		blockId := entry.Name()
		mu := s.getBlockMu(blockId)
		mu.Lock()
		fEntries, err := os.ReadDir(s.blockDir(blockId))
		if err == nil {
			for _, fe := range fEntries {
				if fe.IsDir() || filepath.Ext(fe.Name()) != ".ansi" {
					continue
				}
				fi, err := fe.Info()
				if err != nil {
					continue
				}
				allFiles = append(allFiles, globalFile{blockId, fe.Name(), fi.Size(), fi.ModTime()})
				totalSize += fi.Size()
			}
		}
		mu.Unlock()
	}

	if totalSize <= maxSizeBytes {
		return nil
	}

	sort.Slice(allFiles, func(i, j int) bool {
		return allFiles[i].modTime.Before(allFiles[j].modTime)
	})
	for _, f := range allFiles {
		if totalSize <= maxSizeBytes {
			break
		}
		mu := s.getBlockMu(f.blockId)
		mu.Lock()
		if err := os.Remove(filepath.Join(s.blockDir(f.blockId), f.name)); err == nil {
			totalSize -= f.size
		}
		mu.Unlock()
	}

	s.pruneEmptyDirs()
	return nil
}

func (s *Store) deleteOldSegments(blockId string, cutoff time.Time) error {
	entries, err := os.ReadDir(s.blockDir(blockId))
	if err != nil {
		return err
	}
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".ansi" {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}
		if fi.ModTime().Before(cutoff) {
			_ = os.Remove(filepath.Join(s.blockDir(blockId), e.Name()))
		}
	}
	return nil
}

func (s *Store) pruneEmptyDirs() {
	entries, err := os.ReadDir(s.root)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		blockId := entry.Name()
		mu := s.getBlockMu(blockId)
		mu.Lock()
		isEmpty := true
		subEntries, err := os.ReadDir(s.blockDir(blockId))
		if err == nil {
			for _, se := range subEntries {
				if !se.IsDir() && filepath.Ext(se.Name()) == ".ansi" {
					isEmpty = false
					break
				}
			}
		}
		if isEmpty {
			_ = os.RemoveAll(s.blockDir(blockId))
		}
		mu.Unlock()
	}
}
