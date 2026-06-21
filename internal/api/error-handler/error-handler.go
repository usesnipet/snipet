package errorhandler

import (
	"errors"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
)

type ErrorHandler func(c fiber.Ctx, err error) error

type ErrorResponse struct {
	Message    string `json:"message"`
	Error      string `json:"error"`
	StatusCode int    `json:"statusCode"`
}

type ErrorHandlerBuilder struct {
	mappers []func(err error) (error, bool)
}

func (b *ErrorHandlerBuilder) AddMapper(mapper func(err error) (error, bool)) {
	b.mappers = append(b.mappers, mapper)
}

func writeErrorResponse(c fiber.Ctx, code int, message string) error {
	return c.Status(code).JSON(ErrorResponse{
		Message:    message,
		Error:      message,
		StatusCode: code,
	})
}

func statusFromError(err error) (int, string, bool) {
	var fiberErr *fiber.Error
	if errors.As(err, &fiberErr) {
		return fiberErr.Code, fiberErr.Message, true
	}
	return 0, "", false
}

func (b *ErrorHandlerBuilder) Build() ErrorHandler {
	return func(c fiber.Ctx, err error) error {
		for _, mapper := range b.mappers {
			if mapped, ok := mapper(err); ok {
				code, message, ok := statusFromError(mapped)
				if !ok {
					return writeErrorResponse(c, fiber.StatusInternalServerError, mapped.Error())
				}
				return writeErrorResponse(c, code, message)
			}
		}

		if code, message, ok := statusFromError(err); ok {
			return writeErrorResponse(c, code, message)
		}

		var bindErr *fiber.BindError
		if errors.As(err, &bindErr) {
			return writeErrorResponse(c, fiber.StatusBadRequest, bindErr.Error())
		}

		var validationErrs validator.ValidationErrors
		if errors.As(err, &validationErrs) {
			return writeErrorResponse(c, fiber.StatusBadRequest, validationErrs.Error())
		}

		return writeErrorResponse(c, fiber.StatusInternalServerError, "internal server error")
	}
}

func NewErrorHandlerBuilder() *ErrorHandlerBuilder {
	return &ErrorHandlerBuilder{
		mappers: []func(err error) (error, bool){},
	}
}
