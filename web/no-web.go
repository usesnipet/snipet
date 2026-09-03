//go:build !web

package web

import "net/http"

func Handler() http.Handler {
	return http.NotFoundHandler()
}
