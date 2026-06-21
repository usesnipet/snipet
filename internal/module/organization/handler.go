package organization

import (
	"github.com/gofiber/fiber/v3"
	"github.com/usesnipet/snipet/app/internal/filter"
	"github.com/usesnipet/snipet/app/internal/logger"
	"github.com/usesnipet/snipet/app/internal/model"
)

type Handler struct {
	service *Service
	logger  *logger.Logger
}

func (h *Handler) RegisterRoutes(router fiber.Router) {
	orgs := router.Group("/organizations")
	orgs.Get("/:id", h.FindByID)
	orgs.Get("/", h.FindBy)
	orgs.Post("/", h.Create)
	orgs.Put("/:id", h.Update)
	orgs.Delete("/:id", h.Delete)
}

func (h *Handler) FindByID(c fiber.Ctx) error {
	id := c.Params("id")
	h.logger.Verbosef("%s %s FindByID: %s", c.Method(), c.Path(), id)
	model, err := h.service.FindByID(c.Context(), id)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusOK).JSON(model)
}

func (h *Handler) FindBy(c fiber.Ctx) error {
	h.logger.Verbosef("%s %s FindBy", c.Method(), c.Path())
	options, err := filter.FromFiber[model.Organization](c)
	if err != nil {
		return err
	}
	models, err := h.service.FindBy(c.Context(), options)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusOK).JSON(models)
}

func (h *Handler) Create(c fiber.Ctx) error {
	var dto CreateOrganizationDTO
	h.logger.Verbosef("%s %s Create", c.Method(), c.Path())
	if err := c.Bind().Body(&dto); err != nil {
		return err
	}
	return h.service.Create(c.Context(), dto)
}

func (h *Handler) Update(c fiber.Ctx) error {
	var dto UpdateOrganizationDTO
	h.logger.Verbosef("%s %s Update", c.Method(), c.Path())
	if err := c.Bind().Body(&dto); err != nil {
		return err
	}
	return h.service.Update(c.Context(), c.Params("id"), dto)
}

func (h *Handler) Delete(c fiber.Ctx) error {
	h.logger.Verbosef("%s %s Delete", c.Method(), c.Path())
	return h.service.Delete(c.Context(), c.Params("id"))
}

func NewHandler(service *Service, logger *logger.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}
