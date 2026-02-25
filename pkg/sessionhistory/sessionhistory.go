
package sessionhistory

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const rollingFileName = "rolling.ansi"
const metaFileName = "meta.json"

type SessionMeta struct {
	BlockId       string `json:"blockId"`
	TabId         string `json:"tabId"`
	TabBaseDir    string `json:"tabBaseDir"`
	Connection    string `json:"connection,omitempty"`
	Cwd           string `json:"cwd,omitempty"`
	CreatedAt     int64  `json:"createdAt"`
	LastUpdatedAt int64  `json:"lastUpdatedAt"`
}

type SegmentInfo struct {
	Filename  string `json:"filename"`
	SizeBytes int64  `json:"sizeBytes"`
	ModTimeMs int64  `json:"modTimeMs"`
	IsRolling bool   `json:"isRolling"`
}

type SessionInfo struct {
	BlockId       string        `json:"blockId"`
	TabId         string        `json:"tabId"`
	TabBaseDir    string        `json:"tabBaseDir"`
	Connection    string        `json:"connection,omitempty"`
	Cwd           string        `json:"cwd,omitempty"`
	CreatedAt     int64         `json:"createdAt"`
	LastUpdatedAt int64         `json:"lastUpdatedAt"`
	TotalBytes    int64         `json:"totalBytes"`
	SegmentCount  int           `json:"segmentCount"`
	Segments      []SegmentInfo `json:"segments"`
}

type SessionFilter struct {
	BlockId    string
	TabBaseDir string
}

type Store struct {
	root    string
	mu      sync.Mutex
	blockMu map[string]*sync.Mutex
}

func NewStore(dir string) *Store {
	return &Store{
		root:    dir,
		blockMu: make(map[string]*sync.Mutex),
	}
}

func (s *Store) getBlockMu(blockId string) *sync.Mutex {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.blockMu[blockId] == nil {
		s.blockMu[blockId] = &sync.Mutex{}
	}
	return s.blockMu[blockId]
}

func (s *Store) pruneBlockMu() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for blockId := range s.blockMu {
		if _, err := os.Stat(filepath.Join(s.root, blockId)); os.IsNotExist(err) {
			delete(s.blockMu, blockId)
		}
	}
}

func (s *Store) blockDir(blockId string) string {
	return filepath.Join(s.root, blockId)
}

func (s *Store) ensureBlockDir(blockId string) error {
	return os.MkdirAll(s.blockDir(blockId), 0o755)
}

func (s *Store) writeMeta(blockId string, meta SessionMeta) error {
	metaPath := filepath.Join(s.blockDir(blockId), metaFileName)
	if _, err := os.Stat(metaPath); err == nil {
		existing, err := s.readMeta(blockId)
		if err != nil {
			return err
		}
		existing.LastUpdatedAt = time.Now().UnixMilli()
		existing.Cwd = meta.Cwd
		existing.TabBaseDir = meta.TabBaseDir
		existing.Connection = meta.Connection
		return s.flushMeta(metaPath, existing)
	}
	now := time.Now().UnixMilli()
	meta.CreatedAt = now
	meta.LastUpdatedAt = now
	return s.flushMeta(metaPath, meta)
}

func (s *Store) flushMeta(path string, meta SessionMeta) error {
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("sessionhistory: marshal meta: %w", err)
	}
	return os.WriteFile(path, data, 0o644)
}

func (s *Store) readMeta(blockId string) (SessionMeta, error) {
	metaPath := filepath.Join(s.blockDir(blockId), metaFileName)
	data, err := os.ReadFile(metaPath)
	if err != nil {
		return SessionMeta{}, fmt.Errorf("sessionhistory: read meta %s: %w", blockId, err)
	}
	var m SessionMeta
	if err := json.Unmarshal(data, &m); err != nil {
		return SessionMeta{}, fmt.Errorf("sessionhistory: parse meta %s: %w", blockId, err)
	}
	return m, nil
}

func (s *Store) StartCleanupScheduler(ctx context.Context, maxAge time.Duration, maxSizeBytes int64) {
	go func() {
		if err := s.Cleanup(maxAge, maxSizeBytes); err != nil {
			log.Printf("sessionhistory: startup cleanup: %v\n", err)
		}
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := s.Cleanup(maxAge, maxSizeBytes); err != nil {
					log.Printf("sessionhistory: periodic cleanup: %v\n", err)
				}
			}
		}
	}()
}
