package openaicompatible

import "errors"

var (
	ErrBaseURLRequired     = errors.New("base url is required")
	ErrModelRequired       = errors.New("model is required")
	ErrFailedToParseConfig = errors.New("failed to parse config")
)
