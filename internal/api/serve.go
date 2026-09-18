package api

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"
	apperr "github.com/usesnipet/snipet/internal/app-err"
	"github.com/usesnipet/snipet/internal/infra/database"
	"github.com/usesnipet/snipet/internal/llm"
)

// Serve wraps handler for chi, writing its returned error as a JSON
// apperr.Error. A *apperr.Error passes through as-is; a database or llm
// error is mapped to one via HandleDBError / llm.HandleError. Anything
// else is unrecognized internal detail: it is logged server-side (tagged
// with the request ID) and never reaches the client, which instead gets a
// generic 500 — the response body must never carry a raw Go error string.
func (a *Api) Serve(handler HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		err := handler(w, r)
		if err == nil {
			return
		}

		var appErr *apperr.Error
		if errors.As(err, &appErr) {
			WriteAppError(w, appErr)
			return
		}
		if mapped, ok := database.HandleDBError(err); ok {
			WriteAppError(w, mapped)
			return
		}
		if mapped, ok := llm.HandleError(err); ok {
			WriteAppError(w, mapped)
			return
		}

		a.log.Errorf("unhandled error [request_id=%s]: %v", middleware.GetReqID(r.Context()), err)
		WriteAppError(w, apperr.InternalServerError("internal server error"))
	}
}
