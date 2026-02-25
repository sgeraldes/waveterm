
package sessionhistory

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

func validateBlockId(blockId string) error {
	if blockId == "" {
		return fmt.Errorf("sessionhistory: empty blockId")
	}
	if strings.ContainsAny(blockId, "/\\") || strings.Contains(blockId, "..") {
		return fmt.Errorf("sessionhistory: invalid blockId %q", blockId)
	}
	return nil
}

func validateReason(reason string) error {
	if strings.ContainsAny(reason, "/\\.") {
		return fmt.Errorf("sessionhistory: invalid reason %q", reason)
	}
	return nil
}

func (s *Store) SaveRollingSegment(blockId string, content []byte, meta SessionMeta) error {
	if err := validateBlockId(blockId); err != nil {
		return err
	}
	mu := s.getBlockMu(blockId)
	mu.Lock()
	defer mu.Unlock()

	if err := s.ensureBlockDir(blockId); err != nil {
		return fmt.Errorf("sessionhistory: ensure dir: %w", err)
	}
	if err := s.writeMeta(blockId, meta); err != nil {
		return err
	}
	rollingPath := filepath.Join(s.blockDir(blockId), rollingFileName)
	return os.WriteFile(rollingPath, content, 0o644)
}

func (s *Store) SaveSnapshotSegment(blockId string, content []byte, meta SessionMeta, reason string) error {
	if err := validateBlockId(blockId); err != nil {
		return err
	}
	if err := validateReason(reason); err != nil {
		return err
	}
	mu := s.getBlockMu(blockId)
	mu.Lock()
	defer mu.Unlock()

	if err := s.ensureBlockDir(blockId); err != nil {
		return fmt.Errorf("sessionhistory: ensure dir: %w", err)
	}
	if err := s.writeMeta(blockId, meta); err != nil {
		return err
	}
	ts := time.Now().UnixMilli()
	filename := fmt.Sprintf("%d-%s.ansi", ts, reason)
	return os.WriteFile(filepath.Join(s.blockDir(blockId), filename), content, 0o644)
}

func (s *Store) ListSessions(filter SessionFilter) ([]SessionInfo, error) {
	entries, err := os.ReadDir(s.root)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("sessionhistory: list root: %w", err)
	}

	var results []SessionInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		blockId := entry.Name()
		if filter.BlockId != "" && blockId != filter.BlockId {
			continue
		}

		mu := s.getBlockMu(blockId)
		mu.Lock()
		info, err := s.buildSessionInfo(blockId)
		mu.Unlock()
		if err != nil {
			continue
		}

		if filter.TabBaseDir != "" && info.TabBaseDir != filter.TabBaseDir {
			continue
		}
		results = append(results, info)
	}
	return results, nil
}

func (s *Store) buildSessionInfo(blockId string) (SessionInfo, error) {
	meta, err := s.readMeta(blockId)
	if err != nil {
		return SessionInfo{}, err
	}

	entries, err := os.ReadDir(s.blockDir(blockId))
	if err != nil {
		return SessionInfo{}, fmt.Errorf("sessionhistory: read block dir %s: %w", blockId, err)
	}

	var segments []SegmentInfo
	var totalBytes int64
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".ansi" {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}
		segments = append(segments, SegmentInfo{
			Filename:  e.Name(),
			SizeBytes: fi.Size(),
			ModTimeMs: fi.ModTime().UnixMilli(),
			IsRolling: e.Name() == rollingFileName,
		})
		totalBytes += fi.Size()
	}

	return SessionInfo{
		BlockId:       meta.BlockId,
		TabId:         meta.TabId,
		TabBaseDir:    meta.TabBaseDir,
		Connection:    meta.Connection,
		Cwd:           meta.Cwd,
		CreatedAt:     meta.CreatedAt,
		LastUpdatedAt: meta.LastUpdatedAt,
		TotalBytes:    totalBytes,
		SegmentCount:  len(segments),
		Segments:      segments,
	}, nil
}

func (s *Store) ReadSegment(blockId, filename string) ([]byte, error) {
	if err := validateBlockId(blockId); err != nil {
		return nil, err
	}
	if strings.ContainsAny(filename, "/\\") {
		return nil, fmt.Errorf("sessionhistory: invalid filename %q", filename)
	}
	mu := s.getBlockMu(blockId)
	mu.Lock()
	defer mu.Unlock()

	path := filepath.Join(s.blockDir(blockId), filename)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("sessionhistory: read segment %s/%s: %w", blockId, filename, err)
	}
	return data, nil
}

func (s *Store) ReadLatestSegments(blockId string, maxBytes int64) ([]byte, []string, error) {
	if err := validateBlockId(blockId); err != nil {
		return nil, nil, err
	}
	mu := s.getBlockMu(blockId)
	mu.Lock()
	defer mu.Unlock()

	entries, err := os.ReadDir(s.blockDir(blockId))
	if err != nil {
		return nil, nil, fmt.Errorf("sessionhistory: read dir %s: %w", blockId, err)
	}

	type fileEntry struct {
		name    string
		modTime time.Time
		size    int64
	}
	var files []fileEntry
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".ansi" {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}
		files = append(files, fileEntry{e.Name(), fi.ModTime(), fi.Size()})
	}
	sort.Slice(files, func(i, j int) bool {
		return files[i].modTime.After(files[j].modTime)
	})

	var selected []fileEntry
	var accumulated int64
	for _, f := range files {
		if accumulated+f.size > maxBytes && len(selected) > 0 {
			break
		}
		selected = append(selected, f)
		accumulated += f.size
	}
	if len(selected) == 0 {
		return nil, nil, nil
	}

	for i, j := 0, len(selected)-1; i < j; i, j = i+1, j-1 {
		selected[i], selected[j] = selected[j], selected[i]
	}

	var buf []byte
	var filenames []string
	for _, f := range selected {
		data, err := os.ReadFile(filepath.Join(s.blockDir(blockId), f.name))
		if err != nil {
			continue
		}
		buf = append(buf, data...)
		filenames = append(filenames, f.name)
	}
	return buf, filenames, nil
}

func (s *Store) GetTotalSize() (int64, error) {
	entries, err := os.ReadDir(s.root)
	if os.IsNotExist(err) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("sessionhistory: get total size: %w", err)
	}

	var total int64
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		blockId := entry.Name()
		mu := s.getBlockMu(blockId)
		mu.Lock()
		subEntries, err := os.ReadDir(s.blockDir(blockId))
		if err == nil {
			for _, se := range subEntries {
				if se.IsDir() || filepath.Ext(se.Name()) != ".ansi" {
					continue
				}
				if fi, err := se.Info(); err == nil {
					total += fi.Size()
				}
			}
		}
		mu.Unlock()
	}
	return total, nil
}
