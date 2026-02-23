package sessionhistory

import (
	"testing"
)

func TestValidateBlockId(t *testing.T) {
	tests := []struct {
		name    string
		blockId string
		wantErr bool
	}{
		{"valid uuid", "abc-123-def", false},
		{"empty", "", true},
		{"path traversal dotdot", "../etc", true},
		{"forward slash", "a/b", true},
		{"backslash", "a\\b", true},
		{"dotdot in middle", "a..b", true},
		{"simple alphanumeric", "block123", false},
		{"uuid format", "f81a74b8-1234-5678-abcd-ef0123456789", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateBlockId(tt.blockId)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateBlockId(%q) error = %v, wantErr %v", tt.blockId, err, tt.wantErr)
			}
		})
	}
}

func TestValidateReason(t *testing.T) {
	tests := []struct {
		name    string
		reason  string
		wantErr bool
	}{
		{"valid clear", "clear", false},
		{"valid close", "close", false},
		{"path traversal", "../etc/passwd", true},
		{"forward slash", "a/b", true},
		{"backslash", "a\\b", true},
		{"dot", "a.b", true},
		{"empty", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateReason(tt.reason)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateReason(%q) error = %v, wantErr %v", tt.reason, err, tt.wantErr)
			}
		})
	}
}
