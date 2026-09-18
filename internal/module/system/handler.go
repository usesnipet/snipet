package system

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/usesnipet/snipet/internal/api"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) api.Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	r.Route("/system", func(r chi.Router) {
		r.Get("/info", serve(h.info))
	})
}

// @Summary		Get system info
// @Description	Returns application system information.
// @Tags			system
// @Produce		json
// @Success		200	{object}	InfoDTO
// @Router			/system/info [get]
func (h *Handler) info(w http.ResponseWriter, r *http.Request) error {
	return api.WriteJSON(w, http.StatusOK, h.service.Info())
}
