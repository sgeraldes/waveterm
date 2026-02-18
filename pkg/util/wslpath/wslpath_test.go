
package wslpath

import (
	"testing"
)

func TestLinuxToUNC(t *testing.T) {
	tests := []struct {
		distro   string
		linuxPath string
		expected string
	}{
		{"Ubuntu", "/home/user/project", `\\wsl.localhost\Ubuntu\home\user\project`},
		{"Ubuntu-22.04", "/", `\\wsl.localhost\Ubuntu-22.04\`},
		{"Debian", "/etc/hosts", `\\wsl.localhost\Debian\etc\hosts`},
		{"Ubuntu", "~", `\\wsl.localhost\Ubuntu\~`},
	}
	for _, tc := range tests {
		result := LinuxToUNC(tc.distro, tc.linuxPath)
		if result != tc.expected {
			t.Errorf("LinuxToUNC(%q, %q) = %q, want %q", tc.distro, tc.linuxPath, result, tc.expected)
		}
	}
}

func TestUNCToLinux(t *testing.T) {
	tests := []struct {
		uncPath      string
		expectedDistro string
		expectedPath string
		expectedOk   bool
	}{
		{`\\wsl.localhost\Ubuntu\home\user`, "Ubuntu", "/home/user", true},
		{`\\wsl$\Ubuntu\home\user`, "Ubuntu", "/home/user", true},
		{`\\wsl.localhost\Ubuntu-22.04\`, "Ubuntu-22.04", "/", true},
		{`C:\Users\user`, "", "", false},
		{`\\other-server\share`, "", "", false},
		{`\\wsl.localhost\Ubuntu`, "Ubuntu", "/", true},
	}
	for _, tc := range tests {
		distro, path, ok := UNCToLinux(tc.uncPath)
		if ok != tc.expectedOk {
			t.Errorf("UNCToLinux(%q) ok = %v, want %v", tc.uncPath, ok, tc.expectedOk)
			continue
		}
		if !ok {
			continue
		}
		if distro != tc.expectedDistro {
			t.Errorf("UNCToLinux(%q) distro = %q, want %q", tc.uncPath, distro, tc.expectedDistro)
		}
		if path != tc.expectedPath {
			t.Errorf("UNCToLinux(%q) path = %q, want %q", tc.uncPath, path, tc.expectedPath)
		}
	}
}

func TestMntToWindows(t *testing.T) {
	tests := []struct {
		linuxPath string
		expected  string
		ok        bool
	}{
		{"/mnt/c/Users/user", `C:\Users\user`, true},
		{"/mnt/d/Projects", `D:\Projects`, true},
		{"/mnt/c/", `C:\`, true},
		{"/home/user", "", false},
		{"/mnt/", "", false},
	}
	for _, tc := range tests {
		result, ok := MntToWindows(tc.linuxPath)
		if ok != tc.ok {
			t.Errorf("MntToWindows(%q) ok = %v, want %v", tc.linuxPath, ok, tc.ok)
			continue
		}
		if ok && result != tc.expected {
			t.Errorf("MntToWindows(%q) = %q, want %q", tc.linuxPath, result, tc.expected)
		}
	}
}
