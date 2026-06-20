package errorhandler

import "github.com/gofiber/fiber/v3"

type ErrorHandler func(c fiber.Ctx, err error) error

type ErrorHandlerBuilder struct {
	mappers []func(err error) (error, bool)
}

func (b *ErrorHandlerBuilder) AddMapper(mapper func(err error) (error, bool)) {
	b.mappers = append(b.mappers, mapper)
}

func (b *ErrorHandlerBuilder) Build() ErrorHandler {
	return func(c fiber.Ctx, err error) error {
		for _, mapper := range b.mappers {
			if err, ok := mapper(err); ok {
				return err
			}
		}
		return fiber.NewError(fiber.StatusInternalServerError)
	}
}

func NewErrorHandlerBuilder() *ErrorHandlerBuilder {
	return &ErrorHandlerBuilder{
		mappers: []func(err error) (error, bool){},
	}
}
