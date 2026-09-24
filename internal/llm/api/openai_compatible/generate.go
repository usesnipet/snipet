// Package openaicompatible is a shared client for LLM providers that speak the
// OpenAI Chat Completions API (OpenAI, Groq, Together, a local Ollama on its
// /v1 endpoint, ...). A provider driver embeds this package's Generate /
// Stream and only supplies its identity and connection schema.
package openaicompatible

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"resty.dev/v3"

	"github.com/usesnipet/snipet/internal/llm"
)

var errNoChoices = errors.New("openai-compatible: response had no choices")

// Generate runs one chat completion (no streaming) and maps it to llm.Response.
func Generate(ctx context.Context, req llm.GenerateRequest) (llm.Response, error) {
	cfg, err := configFromOptions(req.ConnectionOptions)
	if err != nil {
		return llm.Response{}, fmt.Errorf("%w: %v", llm.ErrBadRequest, err)
	}

	client := resty.New()
	defer client.Close()

	var out chatCompletion
	var apiErr errorEnvelope

	resp, err := newRequest(ctx, client, cfg).
		SetBody(buildBody(req, false)).
		SetResult(&out).
		SetResultError(&apiErr).
		Post("/chat/completions")
	if err != nil {
		return llm.Response{}, transportErr(err)
	}
	if resp.IsStatusFailure() {
		return llm.Response{}, statusErr(resp.StatusCode(), apiErr.Error.Message)
	}
	return toResponse(out)
}

// newRequest builds a resty request pointed at the provider's base URL with
// auth and any configured headers applied.
func newRequest(ctx context.Context, client *resty.Client, cfg Config) *resty.Request {
	client.SetBaseURL(cfg.BaseURL)

	r := client.R().
		SetContext(ctx).
		SetHeader("Content-Type", "application/json").
		SetResponseForceContentType("application/json") // some servers omit the header

	if cfg.APIKey != "" {
		r.SetAuthToken(cfg.APIKey)
	}
	if cfg.Organization != "" {
		r.SetHeader("OpenAI-Organization", cfg.Organization)
	}
	for k, v := range cfg.Headers {
		r.SetHeader(k, v)
	}
	return r
}

// transportErr maps a resty transport error to an llm sentinel. A context
// error passes through unchanged so the Runner treats it as fatal.
func transportErr(err error) error {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	return fmt.Errorf("openai-compatible: %v: %w", err, llm.ErrUnavailable)
}

// statusErr maps an HTTP status (and the API's error message) to an llm
// sentinel.
func statusErr(status int, message string) error {
	if message == "" {
		message = http.StatusText(status)
	}
	switch {
	case status == http.StatusTooManyRequests:
		return fmt.Errorf("openai-compatible: %s: %w", message, llm.ErrRateLimit)
	case status == http.StatusUnauthorized, status == http.StatusForbidden:
		return fmt.Errorf("openai-compatible: %s: %w", message, llm.ErrAuth)
	case status == http.StatusNotFound:
		return fmt.Errorf("openai-compatible: %s: %w", message, llm.ErrModelNotFound)
	case status == http.StatusBadRequest, status == http.StatusUnprocessableEntity:
		return fmt.Errorf("openai-compatible: %s: %w", message, llm.ErrBadRequest)
	case status >= 500:
		return fmt.Errorf("openai-compatible: %s: %w", message, llm.ErrUnavailable)
	default:
		return fmt.Errorf("openai-compatible: unexpected status %d: %s", status, message)
	}
}
