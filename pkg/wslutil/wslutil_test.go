
package wslutil

import (
	"context"
	"testing"
)

func TestNormalizeOs(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Linux", "linux"},
		{"LINUX", "linux"},
		{"linux", "linux"},
		{" linux ", "linux"},
	}
	for _, tc := range tests {
		result := normalizeOs(tc.input)
		if result != tc.expected {
			t.Errorf("normalizeOs(%q) = %q, want %q", tc.input, result, tc.expected)
		}
	}
}

func TestNormalizeArch(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"x86_64", "x64"},
		{"amd64", "x64"},
		{"arm64", "arm64"},
		{"aarch64", "arm64"},
		{"ARM64", "arm64"},
		{" x86_64 ", "x64"},
	}
	for _, tc := range tests {
		result := normalizeArch(tc.input)
		if result != tc.expected {
			t.Errorf("normalizeArch(%q) = %q, want %q", tc.input, result, tc.expected)
		}
	}
}

func TestGetClientPlatformFromOsArchStr(t *testing.T) {
	tests := []struct {
		input       string
		expectedOs  string
		expectedArch string
		wantErr     bool
	}{
		{"Linux x86_64", "linux", "x64", false},
		{"linux aarch64", "linux", "arm64", false},
		{"Linux arm64", "linux", "arm64", false},
		{"invalid", "", "", true},
		{"too many fields here", "", "", true},
		{"windows x86_64", "windows", "x64", false},
	}
	for _, tc := range tests {
		osStr, arch, err := GetClientPlatformFromOsArchStr(context.Background(), tc.input)
		if tc.wantErr {
			if err == nil {
				t.Errorf("GetClientPlatformFromOsArchStr(%q) expected error, got nil (os=%q, arch=%q)", tc.input, osStr, arch)
			}
		} else {
			if err != nil {
				t.Errorf("GetClientPlatformFromOsArchStr(%q) unexpected error: %v", tc.input, err)
			}
			if osStr != tc.expectedOs {
				t.Errorf("GetClientPlatformFromOsArchStr(%q) os = %q, want %q", tc.input, osStr, tc.expectedOs)
			}
			if arch != tc.expectedArch {
				t.Errorf("GetClientPlatformFromOsArchStr(%q) arch = %q, want %q", tc.input, arch, tc.expectedArch)
			}
		}
	}
}
