
package sessionhistory

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestStartCleanupScheduler_RunsImmediately(t *testing.T) {
	s, dir := newTestStore(t)
	meta := SessionMeta{BlockId: "sched-blk", TabId: "tab-1", TabBaseDir: "/proj", Cwd: "/proj"}
	if err := s.SaveSnapshotSegment("sched-blk", []byte("old content"), meta, "clear"); err != nil {
		t.Fatalf("SaveSnapshotSegment failed: %v", err)
	}

	blockDir := filepath.Join(dir, "sched-blk")
	entries, _ := os.ReadDir(blockDir)
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".ansi" {
			oldTime := time.Now().Add(-31 * 24 * time.Hour)
			_ = os.Chtimes(filepath.Join(blockDir, e.Name()), oldTime, oldTime)
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	s.StartCleanupScheduler(ctx, 30*24*time.Hour, 1*1024*1024*1024)
	time.Sleep(50 * time.Millisecond)

	entries2, _ := os.ReadDir(blockDir)
	for _, e := range entries2 {
		if filepath.Ext(e.Name()) == ".ansi" {
			t.Errorf("old file not removed by startup cleanup: %s", e.Name())
		}
	}
}

func TestStartCleanupScheduler_StopsOnCancellation(t *testing.T) {
	s, _ := newTestStore(t)
	ctx, cancel := context.WithCancel(context.Background())

	s.StartCleanupScheduler(ctx, 30*24*time.Hour, 1*1024*1024*1024)
	cancel()

	time.Sleep(10 * time.Millisecond)
}
