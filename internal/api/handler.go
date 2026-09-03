package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

type ServeFunc func(handler HandlerFunc) http.HandlerFunc

type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

type Handler interface {
	RegisterRoutes(r chi.Router, serve ServeFunc)
}

func (a *Api) RegisterHandlers(handlers ...Handler) {
	for _, handler := range handlers {
		handler.RegisterRoutes(a.Router, a.Serve)
	}
}
