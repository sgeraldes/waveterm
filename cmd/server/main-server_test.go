
package main

import (
	"testing"
)

func TestMainServerConstants(t *testing.T) {
	if BackupCleanupTick <= 0 {
		t.Errorf("BackupCleanupTick should be positive")
	}
	if DiagnosticTick <= 0 {
		t.Errorf("DiagnosticTick should be positive")
	}
}
