package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"github.com/mattn/go-colorable"
)

const (
	colorReset   = "\033[0m"
	colorMagenta = "\033[35m"
	colorCyan    = "\033[36m"
	colorGreen   = "\033[32m"
	colorYellow  = "\033[33m"
	colorRed     = "\033[31m"
)

type Logger struct {
	level  Level
	writer io.Writer
	prefix string
}

func NewLogger(level Level) *Logger {
	return &Logger{
		level:  level,
		writer: colorable.NewColorable(os.Stdout),
	}
}

func (l *Logger) Level() Level {
	return l.level
}

// ChildOption configures a child Logger created via Logger.Child.
type ChildOption func(*Logger)

// WithLevel overrides the child logger's level.
func WithLevel(level Level) ChildOption {
	return func(l *Logger) { l.level = level }
}

// WithPrefix appends a prefix to the child logger's messages, on top of any
// prefix inherited from the parent.
func WithPrefix(prefix string) ChildOption {
	return func(l *Logger) { l.prefix += prefix }
}

// Child returns a new Logger inheriting this logger's level, writer and
// prefix, customized by opts.
func (l *Logger) Child(opts ...ChildOption) *Logger {
	child := &Logger{
		level:  l.level,
		writer: l.writer,
		prefix: l.prefix,
	}

	for _, opt := range opts {
		opt(child)
	}

	return child
}

func (l *Logger) enabled(level Level) bool {
	return level >= l.level
}

func (l *Logger) write(level Level, color, tag, format string, v ...any) {
	if !l.enabled(level) {
		return
	}

	timestamp := time.Now().Format(time.RFC3339)
	message := fmt.Sprintf(format, v...)

	var line string
	if l.prefix != "" {
		line = fmt.Sprintf("%s %s%s%s %s%s\n", timestamp, color, tag, colorReset, l.prefix, message)
	} else {
		line = fmt.Sprintf("%s %s%s%s %s\n", timestamp, color, tag, colorReset, message)
	}

	if _, err := l.writer.Write([]byte(line)); err != nil {
		log.Printf("logger write failed: %v", err)
	}
}

func (l *Logger) Verbose(v ...any) {
	l.write(LevelVerbose, colorMagenta, "VERBOSE:", "%s", fmt.Sprint(v...))
}

func (l *Logger) Debug(v ...any) {
	l.write(LevelDebug, colorCyan, "DEBUG:", "%s", fmt.Sprint(v...))
}

func (l *Logger) DebugError(v ...any) {
	l.write(LevelDebug, colorRed, "DEBUG ERROR:", "%s", fmt.Sprint(v...))
}

func (l *Logger) Info(v ...any) {
	l.write(LevelInfo, colorGreen, "INFO:", "%s", fmt.Sprint(v...))
}

func (l *Logger) Warn(v ...any) {
	l.write(LevelWarn, colorYellow, "WARN:", "%s", fmt.Sprint(v...))
}

func (l *Logger) Error(v ...any) {
	l.write(LevelError, colorRed, "ERROR:", "%s", fmt.Sprint(v...))
}

func (l *Logger) Verbosef(format string, v ...any) {
	l.write(LevelVerbose, colorMagenta, "VERBOSE:", format, v...)
}

func (l *Logger) Debugf(format string, v ...any) {
	l.write(LevelDebug, colorCyan, "DEBUG:", format, v...)
}

func (l *Logger) DebugErrorf(format string, v ...any) {
	l.write(LevelDebug, colorRed, "DEBUG ERROR:", format, v...)
}

func (l *Logger) Infof(format string, v ...any) {
	l.write(LevelInfo, colorGreen, "INFO:", format, v...)
}

func (l *Logger) Warnf(format string, v ...any) {
	l.write(LevelWarn, colorYellow, "WARN:", format, v...)
}

func (l *Logger) Errorf(format string, v ...any) {
	l.write(LevelError, colorRed, "ERROR:", format, v...)
}
