
package waveobj

import (
	"encoding/json"
	"testing"
)

func TestMetaTSTypeTermHistoryBlockId(t *testing.T) {
	const testBlockId = "abc-123"

	m := MetaTSType{TermHistoryBlockId: testBlockId}
	data, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	val, ok := parsed["termhistory:blockid"]
	if !ok {
		t.Fatal("expected \"termhistory:blockid\" key in JSON output")
	}
	if val != testBlockId {
		t.Errorf("expected %q, got %q", testBlockId, val)
	}

	var result MetaTSType
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("round-trip unmarshal: %v", err)
	}
	if result.TermHistoryBlockId != testBlockId {
		t.Errorf("round-trip: expected %q, got %q", testBlockId, result.TermHistoryBlockId)
	}
}
