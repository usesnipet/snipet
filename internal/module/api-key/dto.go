package apikey

import (
	"time"

	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
)

// APIKeyResponse and APIKeysPage exist so swagger annotations in this package
// can reference them without importing internal/model or internal/page directly.
type APIKeyResponse = model.APIKey

type APIKeysPage = page.Paginated[model.APIKey]

type CreateAPIKeyDTO struct {
	Name      string     `json:"name" validate:"required,max=255"`
	ExpiresAt *time.Time `json:"expires_at"`
}

type UpdateExpirationDTO struct {
	ExpiresAt *time.Time `json:"expires_at"`
}

type APIKeyWithSecret struct {
	*model.APIKey
	Key string `json:"key"`
}

type FindAPIKeysFilterDTO struct {
	Take *int `form:"take" validate:"omitempty,min=1"`
	Skip *int `form:"skip" validate:"omitempty,min=0"`
}

func (dto *FindAPIKeysFilterDTO) ToFilter() *filter.Options[model.APIKey] {
	return filter.New[model.APIKey](
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
	)
}
