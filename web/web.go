//go:build web

package web

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
)

//go:embed all:dist
var embedded embed.FS

func Handler() http.Handler {
	static, err := fs.Sub(embedded, "dist")
	if err != nil {
		panic(err)
	}

	httpFileServer := http.FileServer(http.FS(static))
	return http.StripPrefix("/", http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		f, err := static.Open(r.URL.Path)
		if os.IsNotExist(err) {
			r.URL.Path = "/"
		}

		if err == nil {
			f.Close()
		}

		log.Printf("%s - err: %v", r.URL.Path, err)

		httpFileServer.ServeHTTP(rw, r)
	}))
}
