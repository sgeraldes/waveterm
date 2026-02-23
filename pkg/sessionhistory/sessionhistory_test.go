
package sessionhistory

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func newTestStore(t *testing.T) (*Store, string) {
	t.Helper()
	dir := t.TempDir()
	s := NewStore(dir)
	return s, dir
}

func TestSaveRollingSegment(t *testing.T) {
	s, dir := newTestStore(t)
	meta := SessionMeta{
		BlockId:    "block-001",
		TabId:      "tab-001",
		TabBaseDir: "/home/user/project",
		Cwd:        "/home/user/project/src",
	}
	content := []byte("\x1b[32mhello world\x1b[0m")

	if err := s.SaveRollingSegment("block-001", content, meta); err != nil {
		t.Fatalf("SaveRollingSegment failed: %v", err)
	}

	rollingPath := filepath.Join(dir, "block-001", rollingFileName)
	data, err := os.ReadFile(rollingPath)
	if err != nil {
		t.Fatalf("rolling.ansi not found: %v", err)
	}
	if string(data) != string(content) {
		t.Errorf("content mismatch: got %q want %q", data, content)
	}

	content2 := []byte("\x1b[31mupdated\x1b[0m")
	if err := s.SaveRollingSegment("block-001", content2, meta); err != nil {
		t.Fatalf("second SaveRollingSegment failed: %v", err)
	}

	entries, _ := os.ReadDir(filepath.Join(dir, "block-001"))
	ansiCount := 0
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".ansi" {
			ansiCount++
		}
	}
	if ansiCount != 1 {
		t.Errorf("expected 1 .ansi file after two rolling saves, got %d", ansiCount)
	}

	data2, _ := os.ReadFile(rollingPath)
	if string(data2) != string(content2) {
		t.Errorf("overwrite failed: got %q want %q", data2, content2)
	}
}

func TestSaveSnapshotSegment(t *testing.T) {
	s, dir := newTestStore(t)
	meta := SessionMeta{
		BlockId:    "block-002",
		TabId:      "tab-002",
		TabBaseDir: "/home/user/project",
		Cwd:        "/home/user/project",
	}
	content1 := []byte("snapshot one")
	content2 := []byte("snapshot two")

	if err := s.SaveSnapshotSegment("block-002", content1, meta, "clear"); err != nil {
		t.Fatalf("first SaveSnapshotSegment failed: %v", err)
	}
	time.Sleep(2 * time.Millisecond)
	if err := s.SaveSnapshotSegment("block-002", content2, meta, "close"); err != nil {
		t.Fatalf("second SaveSnapshotSegment failed: %v", err)
	}

	entries, err := os.ReadDir(filepath.Join(dir, "block-002"))
	if err != nil {
		t.Fatalf("ReadDir failed: %v", err)
	}
	ansiCount := 0
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".ansi" && e.Name() != rollingFileName {
			ansiCount++
		}
	}
	if ansiCount != 2 {
		t.Errorf("expected 2 snapshot .ansi files, got %d", ansiCount)
	}
}

func TestMetaJsonCreatedOnFirstSave(t *testing.T) {
	s, dir := newTestStore(t)
	meta := SessionMeta{
		BlockId:    "block-003",
		TabId:      "tab-003",
		TabBaseDir: "/home/user/project",
		Cwd:        "/home/user/project",
	}
	if err := s.SaveRollingSegment("block-003", []byte("data"), meta); err != nil {
		t.Fatalf("SaveRollingSegment failed: %v", err)
	}
	metaPath := filepath.Join(dir, "block-003", metaFileName)
	if _, err := os.Stat(metaPath); os.IsNotExist(err) {
		t.Errorf("meta.json was not created on first save")
	}
}

func TestListSessions_FilterByBlockId(t *testing.T) {
	s, _ := newTestStore(t)
	meta1 := SessionMeta{BlockId: "block-a", TabId: "tab-1", TabBaseDir: "/proj/a", Cwd: "/proj/a"}
	meta2 := SessionMeta{BlockId: "block-b", TabId: "tab-1", TabBaseDir: "/proj/b", Cwd: "/proj/b"}
	s.SaveRollingSegment("block-a", []byte("data-a"), meta1)
	s.SaveRollingSegment("block-b", []byte("data-b"), meta2)

	sessions, err := s.ListSessions(SessionFilter{BlockId: "block-a"})
	if err != nil {
		t.Fatalf("ListSessions failed: %v", err)
	}
	if len(sessions) != 1 || sessions[0].BlockId != "block-a" {
		t.Errorf("expected 1 session for block-a, got %d", len(sessions))
	}
}

func TestListSessions_FilterByTabBaseDir(t *testing.T) {
	s, _ := newTestStore(t)
	meta1 := SessionMeta{BlockId: "block-c", TabId: "tab-1", TabBaseDir: "/proj/shared", Cwd: "/proj/shared"}
	meta2 := SessionMeta{BlockId: "block-d", TabId: "tab-2", TabBaseDir: "/proj/shared", Cwd: "/proj/shared"}
	meta3 := SessionMeta{BlockId: "block-e", TabId: "tab-3", TabBaseDir: "/proj/other", Cwd: "/proj/other"}
	s.SaveRollingSegment("block-c", []byte("c"), meta1)
	s.SaveRollingSegment("block-d", []byte("d"), meta2)
	s.SaveRollingSegment("block-e", []byte("e"), meta3)

	sessions, err := s.ListSessions(SessionFilter{TabBaseDir: "/proj/shared"})
	if err != nil {
		t.Fatalf("ListSessions failed: %v", err)
	}
	if len(sessions) != 2 {
		t.Errorf("expected 2 sessions for /proj/shared, got %d", len(sessions))
	}
}

func TestReadSegment(t *testing.T) {
	s, _ := newTestStore(t)
	meta := SessionMeta{BlockId: "block-f", TabId: "tab-f", TabBaseDir: "/proj", Cwd: "/proj"}
	content := []byte("\x1b[32mtest content\x1b[0m")
	s.SaveRollingSegment("block-f", content, meta)

	data, err := s.ReadSegment("block-f", rollingFileName)
	if err != nil {
		t.Fatalf("ReadSegment failed: %v", err)
	}
	if string(data) != string(content) {
		t.Errorf("ReadSegment content mismatch")
	}
}

func TestReadLatestSegments_ByteCap(t *testing.T) {
	s, _ := newTestStore(t)
	meta := SessionMeta{BlockId: "block-g", TabId: "tab-g", TabBaseDir: "/proj", Cwd: "/proj"}
	for i := 0; i < 5; i++ {
		content := make([]byte, 100)
		for j := range content {
			content[j] = byte('a' + i)
		}
		s.SaveSnapshotSegment("block-g", content, meta, "clear")
		time.Sleep(2 * time.Millisecond)
	}

	data, filenames, err := s.ReadLatestSegments("block-g", 250)
	if err != nil {
		t.Fatalf("ReadLatestSegments failed: %v", err)
	}
	if len(data) > 250 {
		t.Errorf("ReadLatestSegments returned %d bytes, expected <= 250", len(data))
	}
	if len(filenames) == 0 {
		t.Errorf("ReadLatestSegments returned no filenames")
	}
}

func TestCleanup_AgeBasedDeletion(t *testing.T) {
	s, dir := newTestStore(t)
	meta := SessionMeta{BlockId: "block-old", TabId: "tab-1", TabBaseDir: "/proj", Cwd: "/proj"}
	s.SaveSnapshotSegment("block-old", []byte("old data"), meta, "clear")

	blockDir := filepath.Join(dir, "block-old")
	entries, _ := os.ReadDir(blockDir)
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".ansi" {
			path := filepath.Join(blockDir, e.Name())
			oldTime := time.Now().Add(-31 * 24 * time.Hour)
			os.Chtimes(path, oldTime, oldTime)
		}
	}

	meta2 := SessionMeta{BlockId: "block-new", TabId: "tab-2", TabBaseDir: "/proj", Cwd: "/proj"}
	s.SaveRollingSegment("block-new", []byte("recent data"), meta2)

	if err := s.Cleanup(30*24*time.Hour, 1024*1024*1024); err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}

	entries2, _ := os.ReadDir(blockDir)
	for _, e := range entries2 {
		if filepath.Ext(e.Name()) == ".ansi" {
			t.Errorf("old .ansi file was not cleaned up: %s", e.Name())
		}
	}

	if _, err := os.Stat(blockDir); !os.IsNotExist(err) {
		t.Errorf("empty block directory was not removed")
	}

	newBlockDir := filepath.Join(dir, "block-new")
	if _, err := os.Stat(newBlockDir); os.IsNotExist(err) {
		t.Errorf("new block directory was incorrectly removed")
	}
}

func TestCleanup_SizeCap(t *testing.T) {
	s, dir := newTestStore(t)
	for i := 0; i < 5; i++ {
		blockId := fmt.Sprintf("block-%02d", i)
		meta := SessionMeta{BlockId: blockId, TabId: "tab-1", TabBaseDir: "/proj", Cwd: "/proj"}
		content := make([]byte, 100)
		s.SaveSnapshotSegment(blockId, content, meta, "clear")
		blockDir := filepath.Join(dir, blockId)
		entries, _ := os.ReadDir(blockDir)
		for _, e := range entries {
			if filepath.Ext(e.Name()) == ".ansi" {
				path := filepath.Join(blockDir, e.Name())
				t2 := time.Now().Add(-time.Duration(5-i) * time.Minute)
				os.Chtimes(path, t2, t2)
			}
		}
	}

	if err := s.Cleanup(365*24*time.Hour, 250); err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}

	totalSize, err := s.GetTotalSize()
	if err != nil {
		t.Fatalf("GetTotalSize failed: %v", err)
	}
	if totalSize > 250 {
		t.Errorf("after size-cap cleanup, total size %d > 250", totalSize)
	}
}

func TestConcurrentSaves(t *testing.T) {
	s, _ := newTestStore(t)
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			meta := SessionMeta{BlockId: "block-concurrent", TabId: "tab-1", TabBaseDir: "/proj", Cwd: "/proj"}
			s.SaveRollingSegment("block-concurrent", []byte(fmt.Sprintf("data-%d", n)), meta)
		}(i)
	}
	wg.Wait()

	data, err := s.ReadSegment("block-concurrent", rollingFileName)
	if err != nil {
		t.Fatalf("ReadSegment after concurrent saves failed: %v", err)
	}
	if len(data) == 0 {
		t.Errorf("rolling.ansi is empty after concurrent saves")
	}
}
