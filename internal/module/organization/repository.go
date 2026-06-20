package organization

import (
	"github.com/usesnipet/snipet/app/internal/infra/database"
	"github.com/usesnipet/snipet/app/internal/model"
	"gorm.io/gorm"
)

type Repository struct {
	*database.Repository[model.Organization]
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		Repository: database.NewRepository[model.Organization](db),
	}
}
