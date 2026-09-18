package llm

import (
	"errors"
	"net/http"

	apperr "github.com/usesnipet/snipet/internal/app-err"
)

// HandleError maps a Runner/Registry error to an apperr.Error safe to
// return from the API. ok is false if err isn't one this package
// recognizes, and the caller should fall back to a generic response.
func HandleError(err error) (*apperr.Error, bool) {
	var failover *FailoverError
	if errors.As(err, &failover) {
		details := make(map[string]any, len(failover.Attempts))
		for _, a := range failover.Attempts {
			details[a.LLM] = attemptReason(a.Err)
		}
		return apperr.New(http.StatusBadGateway, "all configured llms failed", details), true
	}

	switch {
	case errors.Is(err, ErrProviderNotFound):
		return apperr.NotFound("llm provider not found"), true
	case errors.Is(err, ErrModelNotFound):
		return apperr.NotFound("llm model not found"), true
	case errors.Is(err, ErrAuth):
		return apperr.Unauthorized("llm provider rejected credentials"), true
	case errors.Is(err, ErrRateLimit):
		return apperr.New(http.StatusTooManyRequests, "llm provider rate limited", nil), true
	case errors.Is(err, ErrUnavailable):
		return apperr.NetworkError("llm provider unavailable"), true
	case errors.Is(err, ErrContextTooLong):
		return apperr.UnprocessableEntity("conversation too long for this model"), true
	case errors.Is(err, ErrInvalidOptions), errors.Is(err, ErrBadRequest):
		return apperr.BadRequest("invalid llm request"), true
	}
	return nil, false
}

// attemptReason gives a client-safe label for one failed attempt inside a
// FailoverError — never the raw provider error, which may carry internals
// (host, auth details, etc).
func attemptReason(err error) string {
	switch {
	case errors.Is(err, ErrRateLimit):
		return "rate limited"
	case errors.Is(err, ErrAuth):
		return "authentication rejected"
	case errors.Is(err, ErrUnavailable):
		return "unavailable"
	default:
		return "failed"
	}
}
