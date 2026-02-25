
package sessionhistoryservice

import (
	"context"
	"encoding/base64"
	"strings"
	"testing"
)

func newTestService(t *testing.T) *SessionHistoryService {
	t.Helper()
	return NewSessionHistoryService(t.TempDir())
}

func TestSaveAndListRoundTrip(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()

	err := svc.SaveRollingSegment(ctx, "block-rt", "hello world", "tab-1", "/proj", "", "/proj")
	if err != nil {
		t.Fatalf("SaveRollingSegment failed: %v", err)
	}

	sessions, err := svc.ListSessionHistory(ctx, "block-rt", "")
	if err != nil {
		t.Fatalf("ListSessionHistory failed: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	if sessions[0].BlockId != "block-rt" {
		t.Errorf("expected blockId block-rt, got %s", sessions[0].BlockId)
	}
}

func TestReadSegmentRoundTrip(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()

	content := "\x1b[32mhello terminal\x1b[0m"
	if err := svc.SaveRollingSegment(ctx, "block-read", content, "tab-1", "/proj", "", "/proj"); err != nil {
		t.Fatalf("SaveRollingSegment failed: %v", err)
	}

	sessions, err := svc.ListSessionHistory(ctx, "block-read", "")
	if err != nil || len(sessions) == 0 {
		t.Fatalf("ListSessionHistory failed or empty")
	}

	var filename string
	for _, seg := range sessions[0].Segments {
		if seg.IsRolling {
			filename = seg.Filename
			break
		}
	}
	if filename == "" {
		t.Fatalf("no rolling segment found in session")
	}

	encoded, err := svc.ReadSessionSegment(ctx, "block-read", filename)
	if err != nil {
		t.Fatalf("ReadSessionSegment failed: %v", err)
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("base64 decode failed: %v", err)
	}
	if string(decoded) != content {
		t.Errorf("content mismatch: got %q want %q", string(decoded), content)
	}
}

func TestReadLatestSegmentsRoundTrip(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()

	content := strings.Repeat("x", 200)
	if err := svc.SaveRollingSegment(ctx, "block-latest", content, "tab-1", "/proj", "", "/proj"); err != nil {
		t.Fatalf("SaveRollingSegment failed: %v", err)
	}

	encoded, err := svc.ReadLatestSegments(ctx, "block-latest", 1024)
	if err != nil {
		t.Fatalf("ReadLatestSegments failed: %v", err)
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("base64 decode failed: %v", err)
	}
	if string(decoded) != content {
		t.Errorf("ReadLatestSegments content mismatch")
	}
}

func TestContentCapEnforced(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()

	oversized := strings.Repeat("a", maxContentBytes+1)
	err := svc.SaveRollingSegment(ctx, "block-cap", oversized, "tab-1", "/proj", "", "/proj")
	if err == nil {
		t.Errorf("expected error for content exceeding 5MB cap, got nil")
	}
}

func TestSnapshotSegmentCreated(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()

	content := "snapshot content"
	if err := svc.SaveSnapshotSegment(ctx, "block-snap", content, "tab-1", "/proj", "", "/proj", "clear"); err != nil {
		t.Fatalf("SaveSnapshotSegment failed: %v", err)
	}

	sessions, err := svc.ListSessionHistory(ctx, "block-snap", "")
	if err != nil || len(sessions) == 0 {
		t.Fatalf("ListSessionHistory failed or empty")
	}

	hasSnapshot := false
	for _, seg := range sessions[0].Segments {
		if !seg.IsRolling {
			hasSnapshot = true
			break
		}
	}
	if !hasSnapshot {
		t.Errorf("expected at least one snapshot (non-rolling) segment")
	}
}

func TestListFilterByTabBaseDir(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()

	svc.SaveRollingSegment(ctx, "block-a", "data", "tab-1", "/proj/a", "", "/proj/a")
	svc.SaveRollingSegment(ctx, "block-b", "data", "tab-2", "/proj/b", "", "/proj/b")

	sessions, err := svc.ListSessionHistory(ctx, "", "/proj/a")
	if err != nil {
		t.Fatalf("ListSessionHistory failed: %v", err)
	}
	if len(sessions) != 1 || sessions[0].TabBaseDir != "/proj/a" {
		t.Errorf("expected 1 session with tabBaseDir /proj/a, got %d sessions", len(sessions))
	}
}
