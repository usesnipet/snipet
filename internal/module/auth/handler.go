package auth

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/usesnipet/snipet/internal/api"
	coreauth "github.com/usesnipet/snipet/internal/auth"
)

type Handler struct {
	service  *Service
	authGate api.Gate
}

// NewHandler builds the auth HTTP layer. authGate is guard.RequireUserJWT —
// applied only to /auth/me*; POST /auth/login is public (it's how you get
// the token authGate checks).
func NewHandler(service *Service, authGate api.Gate) api.Handler {
	return &Handler{service: service, authGate: authGate}
}

func (h *Handler) RegisterRoutes(r chi.Router, serve api.ServeFunc) {
	r.Route("/auth", func(r chi.Router) {
		r.Post("/login", serve(h.login))
		// refresh/logout take the opaque refresh token itself as proof of
		// identity — no bearer access token required (it may already be
		// expired, which is exactly when /refresh gets called).
		r.Post("/refresh", serve(h.refresh))
		r.Post("/logout", serve(h.logout))

		r.Group(func(r chi.Router) {
			r.Use(h.authGate.Handler())
			r.Get("/me", serve(h.me))
			r.Put("/me/password", serve(h.changeOwnPassword))
		})
	})
}

// @Summary		Login
// @Tags			auth
// @Accept			json
// @Produce		json
// @Param			body	body		LoginDTO	true	"credentials"
// @Success		200		{object}	AuthResponse
// @Failure		401		{object}	api.Error
// @Router			/auth/login [post]
func (h *Handler) login(w http.ResponseWriter, r *http.Request) error {
	var dto LoginDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	result, err := h.service.Login(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Refresh an access token
// @Tags			auth
// @Accept			json
// @Produce		json
// @Param			body	body		RefreshTokenDTO	true	"refresh token"
// @Success		200		{object}	AuthResponse
// @Failure		401		{object}	api.Error
// @Router			/auth/refresh [post]
func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) error {
	var dto RefreshTokenDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	result, err := h.service.Refresh(r.Context(), dto)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, result)
}

// @Summary		Logout
// @Description	Revokes the given refresh token. Idempotent.
// @Tags			auth
// @Accept			json
// @Param			body	body	RefreshTokenDTO	true	"refresh token"
// @Success		204
// @Router			/auth/logout [post]
func (h *Handler) logout(w http.ResponseWriter, r *http.Request) error {
	var dto RefreshTokenDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	if err := h.service.Logout(r.Context(), dto); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}

// @Summary		Current user
// @Tags			auth
// @Produce		json
// @Success		200	{object}	MeResponse
// @Failure		401	{object}	api.Error
// @Router			/auth/me [get]
func (h *Handler) me(w http.ResponseWriter, r *http.Request) error {
	caller, err := coreauth.CurrentUser(r.Context())
	if err != nil {
		return err
	}
	found, err := h.service.Me(r.Context(), caller.ID)
	if err != nil {
		return err
	}
	return api.WriteJSON(w, http.StatusOK, found)
}

// @Summary		Change own password
// @Tags			auth
// @Accept			json
// @Param			body	body	ChangeOwnPasswordDTO	true	"passwords"
// @Success		204
// @Failure		400	{object}	api.Error
// @Failure		401	{object}	api.Error
// @Router			/auth/me/password [put]
func (h *Handler) changeOwnPassword(w http.ResponseWriter, r *http.Request) error {
	caller, err := coreauth.CurrentUser(r.Context())
	if err != nil {
		return err
	}
	var dto ChangeOwnPasswordDTO
	if err := api.ParseBody(r, &dto); err != nil {
		return err
	}
	if err := h.service.ChangeOwnPassword(r.Context(), caller.ID, dto); err != nil {
		return err
	}
	return api.WriteNoContent(w)
}
