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
	colorReset  = "\033[0m"
	colorMagenta = "\033[35m"
	colorCyan   = "\033[36m"
	colorGreen  = "\033[32m"
	colorYellow = "\033[33m"
	colorRed    = "\033[31m"
)

type Logger struct {
	level  Level
	writer io.Writer
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

func (l *Logger) enabled(level Level) bool {
	return level >= l.level
}

func (l *Logger) write(level Level, color, prefix, format string, v ...any) {
	if !l.enabled(level) {
		return
	}

	timestamp := time.Now().Format(time.RFC3339)
	message := fmt.Sprintf(format, v...)
	line := fmt.Sprintf("%s %s%s%s %s\n", timestamp, color, prefix, colorReset, message)

	if _, err := l.writer.Write([]byte(line)); err != nil {
		log.Printf("logger write failed: %v", err)
	}
}

func (l *Logger) Verbose(v ...interface{}) {
	l.write(LevelVerbose, colorMagenta, "VERBOSE:", "%s", fmt.Sprint(v...))
}

func (l *Logger) Debug(v ...interface{}) {
	l.write(LevelDebug, colorCyan, "DEBUG:", "%s", fmt.Sprint(v...))
}

func (l *Logger) Info(v ...interface{}) {
	l.write(LevelInfo, colorGreen, "INFO:", "%s", fmt.Sprint(v...))
}

func (l *Logger) Warn(v ...interface{}) {
	l.write(LevelWarn, colorYellow, "WARN:", "%s", fmt.Sprint(v...))
}

func (l *Logger) Error(v ...interface{}) {
	l.write(LevelError, colorRed, "ERROR:", "%s", fmt.Sprint(v...))
}

func (l *Logger) Verbosef(format string, v ...interface{}) {
	l.write(LevelVerbose, colorMagenta, "VERBOSE:", format, v...)
}

func (l *Logger) Debugf(format string, v ...interface{}) {
	l.write(LevelDebug, colorCyan, "DEBUG:", format, v...)
}

func (l *Logger) Infof(format string, v ...interface{}) {
	l.write(LevelInfo, colorGreen, "INFO:", format, v...)
}

func (l *Logger) Warnf(format string, v ...interface{}) {
	l.write(LevelWarn, colorYellow, "WARN:", format, v...)
}

func (l *Logger) Errorf(format string, v ...interface{}) {
	l.write(LevelError, colorRed, "ERROR:", format, v...)
}
