
package sessionhistoryservice

import (
	"context"
	"encoding/base64"
	"fmt"
	"path/filepath"

	"github.com/wavetermdev/waveterm/pkg/sessionhistory"
	"github.com/wavetermdev/waveterm/pkg/tsgen/tsgenmeta"
	"github.com/wavetermdev/waveterm/pkg/wavebase"
)

const maxContentBytes = 5 * 1024 * 1024

type SessionHistoryService struct {
	store *sessionhistory.Store
}

var SessionHistoryServiceInstance *SessionHistoryService

func GetSessionHistoryService() *SessionHistoryService {
	if SessionHistoryServiceInstance == nil {
		root := filepath.Join(wavebase.GetWaveDataDir(), "session-history")
		SessionHistoryServiceInstance = NewSessionHistoryService(root)
	}
	return SessionHistoryServiceInstance
}

func NewSessionHistoryService(storageRoot string) *SessionHistoryService {
	return &SessionHistoryService{store: sessionhistory.NewStore(storageRoot)}
}


func (s *SessionHistoryService) SaveRollingSegment_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{
		Desc:     "save rolling (overwrite) terminal capture segment",
		ArgNames: []string{"ctx", "blockId", "content", "tabId", "tabBaseDir", "connection", "cwd"},
	}
}

func (s *SessionHistoryService) SaveRollingSegment(ctx context.Context, blockId string, content string, tabId string, tabBaseDir string, connection string, cwd string) error {
	if len(content) > maxContentBytes {
		return fmt.Errorf("sessionhistory: content exceeds 5MB limit (%d bytes)", len(content))
	}
	meta := sessionhistory.SessionMeta{
		BlockId:    blockId,
		TabId:      tabId,
		TabBaseDir: tabBaseDir,
		Connection: connection,
		Cwd:        cwd,
	}
	return s.store.SaveRollingSegment(blockId, []byte(content), meta)
}


func (s *SessionHistoryService) SaveSnapshotSegment_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{
		Desc:     "save immutable snapshot terminal segment (on clear/close)",
		ArgNames: []string{"ctx", "blockId", "content", "tabId", "tabBaseDir", "connection", "cwd", "reason"},
	}
}

func (s *SessionHistoryService) SaveSnapshotSegment(ctx context.Context, blockId string, content string, tabId string, tabBaseDir string, connection string, cwd string, reason string) error {
	if len(content) > maxContentBytes {
		return fmt.Errorf("sessionhistory: content exceeds 5MB limit (%d bytes)", len(content))
	}
	meta := sessionhistory.SessionMeta{
		BlockId:    blockId,
		TabId:      tabId,
		TabBaseDir: tabBaseDir,
		Connection: connection,
		Cwd:        cwd,
	}
	return s.store.SaveSnapshotSegment(blockId, []byte(content), meta, reason)
}


func (s *SessionHistoryService) ListSessionHistory_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{
		Desc:     "list session history entries, optionally filtered by blockId or tabBaseDir",
		ArgNames: []string{"ctx", "blockId", "tabBaseDir"},
	}
}

func (s *SessionHistoryService) ListSessionHistory(ctx context.Context, blockId string, tabBaseDir string) ([]sessionhistory.SessionInfo, error) {
	return s.store.ListSessions(sessionhistory.SessionFilter{
		BlockId:    blockId,
		TabBaseDir: tabBaseDir,
	})
}


func (s *SessionHistoryService) ReadSessionSegment_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{
		Desc:     "read a single .ansi segment file, returns base64-encoded content",
		ArgNames: []string{"ctx", "blockId", "filename"},
	}
}

func (s *SessionHistoryService) ReadSessionSegment(ctx context.Context, blockId string, filename string) (string, error) {
	data, err := s.store.ReadSegment(blockId, filename)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(data), nil
}


func (s *SessionHistoryService) ReadLatestSegments_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{
		Desc:     "read the most recent segments up to maxBytes, returns base64-encoded concatenated content",
		ArgNames: []string{"ctx", "blockId", "maxBytes"},
	}
}

func (s *SessionHistoryService) ReadLatestSegments(ctx context.Context, blockId string, maxBytes int64) (string, error) {
	data, _, err := s.store.ReadLatestSegments(blockId, maxBytes)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(data), nil
}


func (s *SessionHistoryService) CleanupSessionHistory_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{
		Desc:     "run cleanup: delete segments older than 30 days and enforce 500MB cap",
		ArgNames: []string{"ctx"},
	}
}

func (s *SessionHistoryService) CleanupSessionHistory(ctx context.Context) error {
	return s.store.Cleanup(cleanupMaxAge, cleanupMaxSizeBytes)
}

func (s *SessionHistoryService) StartCleanupScheduler(ctx context.Context) {
	s.store.StartCleanupScheduler(ctx, cleanupMaxAge, cleanupMaxSizeBytes)
}
