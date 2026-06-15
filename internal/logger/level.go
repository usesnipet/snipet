package logger

import (
	"fmt"
	"strings"
)

type Level int

const (
	LevelVerbose Level = iota
	LevelDebug
	LevelInfo
	LevelWarn
	LevelError
)

func ParseLevel(value string) (Level, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "verbose":
		return LevelVerbose, nil
	case "debug":
		return LevelDebug, nil
	case "info":
		return LevelInfo, nil
	case "warn", "warning":
		return LevelWarn, nil
	case "error":
		return LevelError, nil
	default:
		return LevelInfo, fmt.Errorf("invalid log level %q, using info", value)
	}
}

func (l Level) String() string {
	switch l {
	case LevelVerbose:
		return "VERBOSE"
	case LevelDebug:
		return "DEBUG"
	case LevelInfo:
		return "INFO"
	case LevelWarn:
		return "WARN"
	case LevelError:
		return "ERROR"
	default:
		return "INFO"
	}
}
