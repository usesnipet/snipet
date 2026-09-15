package llm

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

// Predefined provider errors. A provider returns one of these — usually
// wrapped with context, e.g. fmt.Errorf("openai: %w", llm.ErrRateLimit) — and
// the Runner decides failover from it (see IsFailover).
var (
	ErrRateLimit      = errors.New("llm rate limited")
	ErrUnavailable    = errors.New("llm provider unavailable")
	ErrAuth           = errors.New("llm authentication rejected")
	ErrInvalidOptions = errors.New("llm invalid options")
	ErrBadRequest     = errors.New("llm bad request")
	ErrModelNotFound  = errors.New("llm model not found")
	ErrContextTooLong = errors.New("llm context too long")
)

// ErrProviderNotFound is returned by the Registry when no provider is
// registered under a given key. It is not a failover error.
var ErrProviderNotFound = errors.New("llm provider not found")

// failoverErrors are the predefined errors the Runner fails over on.
var failoverErrors = []error{ErrRateLimit, ErrUnavailable, ErrAuth}

// IsFailover reports whether the Runner should give up on the current llm and
// try the next one.
func IsFailover(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	for _, target := range failoverErrors {
		if errors.Is(err, target) {
			return true
		}
	}
	return false
}

// Attempt records one llm the Runner tried and the error it returned.
type Attempt struct {
	LLM string // "provider-key/model"
	Err error
}

// FailoverError is returned by the Runner when every llm in the list failed
// before producing a result. It aggregates each attempt in order and unwraps
// to the individual errors, so errors.Is / errors.As reach any of them.
type FailoverError struct {
	Attempts []Attempt
}

func (e *FailoverError) Error() string {
	if len(e.Attempts) == 0 {
		return "llm failover: no attempts"
	}
	parts := make([]string, len(e.Attempts))
	for i, a := range e.Attempts {
		parts[i] = fmt.Sprintf("%s: %v", a.LLM, a.Err)
	}
	return fmt.Sprintf("llm failover: all %d attempts failed: %s",
		len(e.Attempts), strings.Join(parts, "; "))
}

// Unwrap returns the per-attempt errors for errors.Is / errors.As.
func (e *FailoverError) Unwrap() []error {
	errs := make([]error, len(e.Attempts))
	for i, a := range e.Attempts {
		errs[i] = a.Err
	}
	return errs
}
