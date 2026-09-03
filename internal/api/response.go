package api

import (
	"encoding/json"
	"errors"
	"net/http"

	apperr "github.com/usesnipet/snipet/internal/app-err"
)

// Error is an alias for apperr.Error, exposed here so handler packages can
// reference it in swagger annotations without importing internal/app-err directly.
type Error = apperr.Error

func WriteJSON(w http.ResponseWriter, status int, data any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(data)
}

func WriteNoContent(w http.ResponseWriter) error {
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func WriteAppError(w http.ResponseWriter, err *apperr.Error) error {
	WriteJSON(w, err.StatusCode, err)
	return nil
}

func WriteError(w http.ResponseWriter, status int, err error) error {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		WriteAppError(w, appErr)
		return nil
	}
	WriteJSON(
		w,
		status,
		apperr.Error{
			StatusCode: status,
			Err:        err,
			Message:    err.Error(),
			Details:    nil,
		},
	)
	return nil
}
