package version

import "runtime/debug"

// Version is set via ldflags on release builds; otherwise it falls back to the short commit hash.
var Version = "dev"

func init() {
	if Version != "dev" {
		return
	}
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return
	}
	for _, s := range info.Settings {
		if s.Key == "vcs.revision" && len(s.Value) >= 7 {
			Version = s.Value[:7]
			return
		}
	}
}
