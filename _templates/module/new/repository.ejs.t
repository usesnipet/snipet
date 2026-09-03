---
to: internal/repository/<%= h.kebab(name) %>.go
sh: gofmt -w internal/repository/<%= h.kebab(name) %>.go
---
package repository

import (
	"<%= h.goModule() %>/internal/model"
	"gorm.io/gorm"
)

type I<%= h.pascal(name) %>Repository interface {
	IRepository[model.<%= h.pascal(name) %>]
	// Add scoped queries here only when generic CRUD is not enough.
}

type <%= h.pascal(name) %>Repository struct {
	*Repository[model.<%= h.pascal(name) %>]
}

func New<%= h.pascal(name) %>Repository(db *gorm.DB) I<%= h.pascal(name) %>Repository {
	return &<%= h.pascal(name) %>Repository{Repository: NewRepository[model.<%= h.pascal(name) %>](db)}
}
