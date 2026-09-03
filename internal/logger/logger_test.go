package logger

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func newTestLogger(level Level) (*Logger, *bytes.Buffer) {
	buf := &bytes.Buffer{}
	return &Logger{level: level, writer: buf}, buf
}

func TestLoggerWritesMessageWhenLevelEnabled(t *testing.T) {
	l, buf := newTestLogger(LevelInfo)

	l.Info("hello")

	assert.Contains(t, buf.String(), "INFO:")
	assert.Contains(t, buf.String(), "hello")
}

func TestLoggerSkipsMessageBelowLevel(t *testing.T) {
	l, buf := newTestLogger(LevelWarn)

	l.Debug("should not appear")

	assert.Empty(t, buf.String())
}

func TestLoggerTagsPerLevel(t *testing.T) {
	tests := []struct {
		name string
		log  func(l *Logger)
		tag  string
	}{
		{"verbose", func(l *Logger) { l.Verbose("v") }, "VERBOSE:"},
		{"debug", func(l *Logger) { l.Debug("d") }, "DEBUG:"},
		{"info", func(l *Logger) { l.Info("i") }, "INFO:"},
		{"warn", func(l *Logger) { l.Warn("w") }, "WARN:"},
		{"error", func(l *Logger) { l.Error("e") }, "ERROR:"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l, buf := newTestLogger(LevelVerbose)
			tt.log(l)
			assert.Contains(t, buf.String(), tt.tag)
		})
	}
}

func TestLoggerFormattedVariantsInterpolateArgs(t *testing.T) {
	l, buf := newTestLogger(LevelVerbose)

	l.Infof("count=%d name=%s", 3, "foo")

	assert.Contains(t, buf.String(), "count=3 name=foo")
}

func TestDebugErrorUsesDebugLevelWithErrorTag(t *testing.T) {
	l, buf := newTestLogger(LevelDebug)

	l.DebugError("boom")

	assert.Contains(t, buf.String(), "DEBUG ERROR:")
	assert.Contains(t, buf.String(), colorRed)
}

func TestDebugErrorSkippedWhenDebugDisabled(t *testing.T) {
	l, buf := newTestLogger(LevelInfo)

	l.DebugError("boom")

	assert.Empty(t, buf.String())
}

func TestDebugErrorfInterpolatesArgs(t *testing.T) {
	l, buf := newTestLogger(LevelDebug)

	l.DebugErrorf("err=%s code=%d", "oops", 42)

	assert.Contains(t, buf.String(), "err=oops code=42")
}

func TestChildInheritsLevelWriterAndPrefix(t *testing.T) {
	parent, buf := newTestLogger(LevelWarn)
	parent.prefix = "[parent] "

	child := parent.Child()

	assert.Equal(t, parent.level, child.level)
	assert.Equal(t, parent.writer, child.writer)
	assert.Equal(t, parent.prefix, child.prefix)

	child.Warn("hi")
	assert.Contains(t, buf.String(), "[parent] hi")
}

func TestChildWithLevelOverridesLevelOnly(t *testing.T) {
	parent, _ := newTestLogger(LevelWarn)

	child := parent.Child(WithLevel(LevelDebug))

	assert.Equal(t, LevelDebug, child.level)
	assert.Equal(t, LevelWarn, parent.level)
}

func TestChildWithPrefixAppendsToParentPrefix(t *testing.T) {
	parent, _ := newTestLogger(LevelInfo)
	parent.prefix = "[parent] "

	child := parent.Child(WithPrefix("[child] "))

	assert.Equal(t, "[parent] [child] ", child.prefix)
	assert.Equal(t, "[parent] ", parent.prefix)
}

func TestChildPrefixDoesNotLeakIntoParentOutput(t *testing.T) {
	parent, buf := newTestLogger(LevelInfo)

	child := parent.Child(WithPrefix("[child] "))
	child.Info("from child")
	parent.Info("from parent")

	output := buf.String()
	lines := strings.Split(strings.TrimSpace(output), "\n")

	assert.Len(t, lines, 2)
	assert.Contains(t, lines[0], "[child] from child")
	assert.NotContains(t, lines[1], "[child]")
	assert.Contains(t, lines[1], "from parent")
}

func TestLevelReturnsCurrentLevel(t *testing.T) {
	l, _ := newTestLogger(LevelError)

	assert.Equal(t, LevelError, l.Level())
}
