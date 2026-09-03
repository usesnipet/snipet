package apperr

import (
	"fmt"
	"net/http"
)

type Error struct {
	StatusCode int            `json:"statusCode"`
	Err        error          `json:"-"`
	Message    string         `json:"message"`
	Details    map[string]any `json:"details"`
}

func (e *Error) Error() string {
	return e.Err.Error()
}

func NotFound(message string) *Error {
	return &Error{
		StatusCode: http.StatusNotFound,
		Err:        fmt.Errorf("not found: %s", message),
		Message:    message,
		Details:    nil,
	}
}

func BadRequest(message string) *Error {
	return &Error{
		StatusCode: http.StatusBadRequest,
		Err:        fmt.Errorf("bad request: %s", message),
		Message:    message,
		Details:    nil,
	}
}

func Conflict(message string) *Error {
	return &Error{
		StatusCode: http.StatusConflict,
		Err:        fmt.Errorf("conflict: %s", message),
		Message:    message,
		Details:    nil,
	}
}

func Unauthorized(message string) *Error {
	return &Error{
		StatusCode: http.StatusUnauthorized,
		Err:        fmt.Errorf("unauthorized: %s", message),
		Message:    message,
		Details:    nil,
	}
}

func Forbidden(message string) *Error {
	return &Error{
		StatusCode: http.StatusForbidden,
		Err:        fmt.Errorf("forbidden: %s", message),
		Message:    message,
		Details:    nil,
	}
}

func UnprocessableEntity(message string) *Error {
	return &Error{
		StatusCode: http.StatusUnprocessableEntity,
		Err:        fmt.Errorf("unprocessable entity: %s", message),
		Message:    message,
		Details:    nil,
	}
}

func InternalServerError(message string) *Error {
	return &Error{
		StatusCode: http.StatusInternalServerError,
		Err:        fmt.Errorf("internal server error: %s", message),
		Message:    message,
		Details:    nil,
	}
}

func NetworkError(message string) *Error {
	return &Error{
		StatusCode: http.StatusBadGateway,
		Err:        fmt.Errorf("network error: %s", message),
		Message:    message,
		Details:    nil,
	}
}

func New(statusCode int, message string, details map[string]any) *Error {
	return &Error{
		StatusCode: statusCode,
		Err:        fmt.Errorf("error: %s", message),
		Message:    message,
		Details:    details,
	}
}
