package apperr

import (
	"errors"
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
	if e.Err == nil {
		return e.Message
	}
	return e.Err.Error()
}

func (e *Error) Is(target error) bool {
	return errors.Is(e.Err, target)
}

func FromError(err error) (*Error, bool) {
	var appErr *Error
	if !errors.As(err, &appErr) {
		return nil, false
	}
	return appErr, true
}

func (e *Error) Unwrap() error {
	return e.Err
}

func (e *Error) IsStatus(statusCode int) bool {
	return e.StatusCode == statusCode
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
