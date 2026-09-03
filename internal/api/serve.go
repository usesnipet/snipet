package api

import (
	"errors"
	"net/http"

	apperr "github.com/usesnipet/go-template/internal/app-err"
	"github.com/usesnipet/go-template/internal/infra/database"
)

func (a *Api) Serve(handler HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := handler(w, r); err != nil {
			var appErr *apperr.Error
			if errors.As(err, &appErr) {
				WriteAppError(w, appErr)
				return
			} else {
				if err, ok := database.HandleDBError(err); ok {
					WriteAppError(w, err)
					return
				}
				WriteError(w, http.StatusInternalServerError, err)
				return
			}
		}
	}
}
