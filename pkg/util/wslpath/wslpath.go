
package wslpath

import (
	"strings"
)

func LinuxToUNC(distro, linuxPath string) string {
	winPath := strings.ReplaceAll(linuxPath, "/", `\`)
	if !strings.HasPrefix(winPath, `\`) {
		winPath = `\` + winPath
	}
	return `\\wsl.localhost\` + distro + winPath
}

func UNCToLinux(uncPath string) (distro, linuxPath string, ok bool) {
	p := strings.ReplaceAll(uncPath, "/", `\`)

	var rest string
	if strings.HasPrefix(p, `\\wsl.localhost\`) {
		rest = p[len(`\\wsl.localhost\`):]
	} else if strings.HasPrefix(p, `\\wsl$\`) {
		rest = p[len(`\\wsl$\`):]
	} else {
		return "", "", false
	}

	idx := strings.Index(rest, `\`)
	if idx == -1 {
		distro = rest
		linuxPath = "/"
		return distro, linuxPath, true
	}
	distro = rest[:idx]
	if distro == "" {
		return "", "", false
	}
	winSuffix := rest[idx:]
	linuxPath = strings.ReplaceAll(winSuffix, `\`, "/")
	if linuxPath == "" {
		linuxPath = "/"
	}
	return distro, linuxPath, true
}

func WindowsToMnt(winPath string) (string, bool) {
	if len(winPath) < 2 || winPath[1] != ':' {
		return "", false
	}
	drive := winPath[0]
	if drive >= 'A' && drive <= 'Z' {
		drive = drive + ('a' - 'A')
	} else if drive < 'a' || drive > 'z' {
		return "", false
	}
	suffix := winPath[2:]
	linuxPath := strings.ReplaceAll(suffix, `\`, "/")
	if linuxPath == "" {
		linuxPath = "/"
	}
	return "/mnt/" + string(drive) + linuxPath, true
}

func MntToWindows(linuxPath string) (string, bool) {
	if !strings.HasPrefix(linuxPath, "/mnt/") {
		return "", false
	}
	rest := linuxPath[len("/mnt/"):]
	if len(rest) == 0 {
		return "", false
	}
	drive := rest[0]
	if drive < 'a' || drive > 'z' {
		return "", false
	}
	suffix := rest[1:]
	driveLetter := strings.ToUpper(string(drive))
	winPath := strings.ReplaceAll(suffix, "/", `\`)
	return driveLetter + ":" + winPath, true
}
