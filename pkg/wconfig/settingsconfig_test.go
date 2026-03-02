package wconfig

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wavetermdev/waveterm/pkg/wavebase"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
)

// setupTestConfigDir creates a temporary config directory for testing
func setupTestConfigDir(t *testing.T) (cleanup func()) {
	originalConfigDir := os.Getenv(wavebase.WaveConfigHomeEnvVar)
	originalDataDir := os.Getenv(wavebase.WaveDataHomeEnvVar)
	tmpDir := t.TempDir()

	// Set both config and data dirs to tmpDir
	os.Setenv(wavebase.WaveConfigHomeEnvVar, tmpDir)
	os.Setenv(wavebase.WaveDataHomeEnvVar, tmpDir)

	// Cache the environment variables to make wavebase functions work
	wavebase.ConfigHome_VarCache = tmpDir
	wavebase.DataHome_VarCache = tmpDir

	return func() {
		if originalConfigDir != "" {
			os.Setenv(wavebase.WaveConfigHomeEnvVar, originalConfigDir)
		} else {
			os.Unsetenv(wavebase.WaveConfigHomeEnvVar)
		}
		if originalDataDir != "" {
			os.Setenv(wavebase.WaveDataHomeEnvVar, originalDataDir)
		} else {
			os.Unsetenv(wavebase.WaveDataHomeEnvVar)
		}
	}
}

// TestSetConnectionsConfigValue_RejectsPlaintextPassword tests CONN-001 safeguard
func TestSetConnectionsConfigValue_RejectsPlaintextPassword(t *testing.T) {
	cleanup := setupTestConfigDir(t)
	defer cleanup()

	tests := []struct {
		name        string
		meta        map[string]any
		expectError string
	}{
		{
			name: "reject ssh:password",
			meta: map[string]any{
				"ssh:password": "secret123",
			},
			expectError: "direct password storage not allowed - use ssh:passwordsecretname instead",
		},
		{
			name: "reject ssh:keypassphrase",
			meta: map[string]any{
				"ssh:keypassphrase": "passphrase123",
			},
			expectError: "direct passphrase storage not allowed - use secretstore instead",
		},
		{
			name: "reject both password fields",
			meta: map[string]any{
				"ssh:password":      "secret123",
				"ssh:keypassphrase": "passphrase123",
			},
			expectError: "direct password storage not allowed",
		},
		{
			name: "allow ssh:passwordsecretname",
			meta: map[string]any{
				"ssh:passwordsecretname": "my-secret-ref",
				"ssh:hostname":           "example.com",
			},
			expectError: "", // should succeed
		},
		{
			name: "allow other ssh fields",
			meta: map[string]any{
				"ssh:hostname": "example.com",
				"ssh:port":     "22",
				"ssh:user":     "admin",
			},
			expectError: "", // should succeed
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := SetConnectionsConfigValue("testconn", tt.meta)

			if tt.expectError != "" {
				if err == nil {
					t.Fatalf("Expected error containing %q, got nil", tt.expectError)
				}
				if !strings.Contains(err.Error(), tt.expectError) {
					t.Errorf("Expected error containing %q, got %q", tt.expectError, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error, got %v", err)
				}
			}
		})
	}
}

// TestSetConnectionsConfigValue_RejectsInvalidShellPath tests existing shellpath validation
func TestSetConnectionsConfigValue_RejectsInvalidShellPath(t *testing.T) {
	cleanup := setupTestConfigDir(t)
	defer cleanup()

	tests := []struct {
		name        string
		shellPath   string
		expectError bool
	}{
		{
			name:        "reject wsl:// URI",
			shellPath:   "wsl://Ubuntu",
			expectError: true,
		},
		{
			name:        "reject ssh:// URI",
			shellPath:   "ssh://user@host",
			expectError: true,
		},
		{
			name:        "allow valid shell path",
			shellPath:   "/bin/bash",
			expectError: false,
		},
		{
			name:        "allow Windows shell path",
			shellPath:   "C:\\Windows\\System32\\cmd.exe",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			meta := map[string]any{
				"conn:shellpath": tt.shellPath,
			}
			err := SetConnectionsConfigValue("testconn", meta)

			if tt.expectError && err == nil {
				t.Fatalf("Expected error for shellpath %q, got nil", tt.shellPath)
			}
			if !tt.expectError && err != nil {
				t.Errorf("Expected no error for shellpath %q, got %v", tt.shellPath, err)
			}
		})
	}
}

// TestSetConnectionsConfigValue_MergesCorrectly tests that valid metadata is merged properly
func TestSetConnectionsConfigValue_MergesCorrectly(t *testing.T) {
	cleanup := setupTestConfigDir(t)
	defer cleanup()

	// First write
	meta1 := map[string]any{
		"ssh:hostname": "server1.example.com",
		"ssh:port":     "22",
	}
	err := SetConnectionsConfigValue("myconn", meta1)
	if err != nil {
		t.Fatalf("Failed to set initial connection config: %v", err)
	}

	// Second write (merge)
	meta2 := map[string]any{
		"ssh:user":             "admin",
		"ssh:passwordsecretname": "my-secret",
	}
	err = SetConnectionsConfigValue("myconn", meta2)
	if err != nil {
		t.Fatalf("Failed to merge connection config: %v", err)
	}

	// Read back and verify
	m, cerrs := ReadWaveHomeConfigFile(ConnectionsFile)
	if len(cerrs) > 0 {
		t.Fatalf("Failed to read connections file: %v", cerrs)
	}

	connData := m.GetMap("myconn")
	if connData == nil {
		t.Fatal("Connection data not found")
	}

	// Verify all fields are present
	if connData["ssh:hostname"] != "server1.example.com" {
		t.Errorf("Expected ssh:hostname to be 'server1.example.com', got %v", connData["ssh:hostname"])
	}
	if connData["ssh:port"] != "22" {
		t.Errorf("Expected ssh:port to be '22', got %v", connData["ssh:port"])
	}
	if connData["ssh:user"] != "admin" {
		t.Errorf("Expected ssh:user to be 'admin', got %v", connData["ssh:user"])
	}
	if connData["ssh:passwordsecretname"] != "my-secret" {
		t.Errorf("Expected ssh:passwordsecretname to be 'my-secret', got %v", connData["ssh:passwordsecretname"])
	}
}

// TestWriteWaveHomeConfigFile_CreatesValidJSON tests that config files are valid JSON
func TestWriteWaveHomeConfigFile_CreatesValidJSON(t *testing.T) {
	cleanup := setupTestConfigDir(t)
	defer cleanup()

	meta := waveobj.MetaMapType{
		"test:key1": "value1",
		"test:key2": 42,
		"test:key3": true,
	}

	err := WriteWaveHomeConfigFile("test.json", meta)
	if err != nil {
		t.Fatalf("Failed to write config file: %v", err)
	}

	// Verify file exists and is valid JSON
	configDir := wavebase.GetWaveConfigDir()
	filePath := filepath.Join(configDir, "test.json")

	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("Failed to read config file: %v", err)
	}

	// Check it's not empty
	if len(data) == 0 {
		t.Fatal("Config file is empty")
	}

	// Read it back
	readMeta, cerrs := ReadWaveHomeConfigFile("test.json")
	if len(cerrs) > 0 {
		t.Fatalf("Failed to read back config file: %v", cerrs)
	}

	if readMeta["test:key1"] != "value1" {
		t.Errorf("Expected test:key1 to be 'value1', got %v", readMeta["test:key1"])
	}
	if readMeta["test:key2"] != float64(42) {
		t.Errorf("Expected test:key2 to be 42, got %v", readMeta["test:key2"])
	}
	if readMeta["test:key3"] != true {
		t.Errorf("Expected test:key3 to be true, got %v", readMeta["test:key3"])
	}
}

// TestSetConnectionsConfigValue_EmptyConnectionName tests edge case with empty connection name
func TestSetConnectionsConfigValue_EmptyConnectionName(t *testing.T) {
	cleanup := setupTestConfigDir(t)
	defer cleanup()

	meta := map[string]any{
		"ssh:hostname": "example.com",
	}

	// Should still work with empty connection name
	err := SetConnectionsConfigValue("", meta)
	if err != nil {
		t.Errorf("Expected empty connection name to work, got error: %v", err)
	}
}

// TestSetConnectionsConfigValue_NilMeta tests edge case with nil metadata
func TestSetConnectionsConfigValue_NilMeta(t *testing.T) {
	cleanup := setupTestConfigDir(t)
	defer cleanup()

	// Should not crash with nil metadata
	err := SetConnectionsConfigValue("testconn", nil)
	if err != nil {
		t.Errorf("Expected nil metadata to work, got error: %v", err)
	}
}
