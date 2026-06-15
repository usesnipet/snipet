package crud

import (
	"github.com/gofiber/fiber/v3"
	"github.com/usesnipet/go-template/internal/filter"
	"github.com/usesnipet/go-template/internal/logger"
	"github.com/usesnipet/go-template/internal/model"
)

type Handler[T model.Model] struct {
	service *Service[T]
	logger  *logger.Logger
}

func (h *Handler[T]) FindByID(c fiber.Ctx) error {
	id := c.Params("id")
	h.logger.Verbosef("%s %s FindByID: %s", c.Method(), c.Path(), id)
	model, err := h.service.FindByID(c.Context(), id)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusOK).JSON(model)
}

func (h *Handler[T]) FindBy(c fiber.Ctx) error {
	h.logger.Verbosef("%s %s FindBy", c.Method(), c.Path())
	options, err := filter.FromFiber[T](c)
	if err != nil {
		return err
	}
	models, err := h.service.FindBy(c.Context(), options)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusOK).JSON(models)
}

func (h *Handler[T]) Create(c fiber.Ctx, dto any) error {
	h.logger.Verbosef("%s %s Create", c.Method(), c.Path())
	if err := c.Bind().Body(dto); err != nil {
		return err
	}
	return h.service.Create(c.Context(), dto.(*T))
}

func (h *Handler[T]) UpdateByID(c fiber.Ctx, dto any) error {
	id := c.Params("id")
	h.logger.Verbosef("%s %s UpdateByID: %s", c.Method(), c.Path(), id)
	if err := c.Bind().Body(dto); err != nil {
		return err
	}
	return h.service.UpdateByID(c.Context(), id, dto.(*T))
}

func (h *Handler[T]) DeleteByID(c fiber.Ctx) error {
	id := c.Params("id")
	h.logger.Verbosef("%s %s DeleteByID: %s", c.Method(), c.Path(), id)
	return h.service.DeleteByID(c.Context(), id)
}

func NewHandler[T model.Model](service *Service[T], logger *logger.Logger) *Handler[T] {
	return &Handler[T]{service: service, logger: logger}
}
