package api_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/usesnipet/snipet/internal/api"
	apperr "github.com/usesnipet/snipet/internal/app-err"
)

func serveThroughGate(t *testing.T, gate api.Gate) *httptest.ResponseRecorder {
	t.Helper()
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	rec := httptest.NewRecorder()
	gate.Handler()(next).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	return rec
}

// Handler's status comes from the gate's own *apperr.Error, not a hardcoded
// constant — a Forbidden-failing gate must render 403, not the flat 401
// every gate used to get regardless of the actual failure.
func TestGateHandler_UsesTheGatesOwnStatus(t *testing.T) {
	t.Parallel()

	forbidden := api.Gate(func(r *http.Request) (context.Context, error) {
		return nil, apperr.Forbidden("insufficient role")
	})
	rec := serveThroughGate(t, forbidden)
	assert.Equal(t, http.StatusForbidden, rec.Code)

	var body apperr.Error
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&body))
	assert.Equal(t, "insufficient role", body.Message)
}

func TestGateHandler_BareErrorFallsBackToUnauthorized(t *testing.T) {
	t.Parallel()

	broken := api.Gate(func(r *http.Request) (context.Context, error) {
		return nil, errors.New("boom")
	})
	rec := serveThroughGate(t, broken)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestGateHandler_SuccessCallsNext(t *testing.T) {
	t.Parallel()

	ok := api.Gate(func(r *http.Request) (context.Context, error) {
		return r.Context(), nil
	})
	rec := serveThroughGate(t, ok)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestOr_FallsBackToUnauthorizedWhenNoGateApplies(t *testing.T) {
	t.Parallel()

	_, err := api.Or()(httptest.NewRequest(http.MethodGet, "/", nil))

	var appErr *apperr.Error
	require.True(t, errors.As(err, &appErr))
	assert.Equal(t, http.StatusUnauthorized, appErr.StatusCode)
}
