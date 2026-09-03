package llmprovider

import (
	"github.com/usesnipet/go-template/internal/filter"
	"github.com/usesnipet/go-template/internal/model"
	"github.com/usesnipet/go-template/pkg/jsonx"
)

// CreateLlmProviderDTO is the POST body — value fields, `validate:"required"`
// on what the entity cannot exist without.
type CreateLlmProviderDTO struct {
	Name     string        `json:"name" validate:"required,max=255"`
	Provider string        `json:"provider" validate:"required,max=255"`
	Config   jsonx.JSONMap `json:"config" validate:"required"`
	Enabled  jsonx.JSONMap `json:"enabled" validate:"omitempty"`
}

// UpdateLlmProviderDTO is the PUT body — every field a pointer + `omitempty`:
// nil means "leave unchanged", which makes PUT a partial patch.
type UpdateLlmProviderDTO struct {
	Name     *string       `json:"name" validate:"omitempty,max=255"`
	Provider *string       `json:"provider" validate:"omitempty,max=255"`
	Config   jsonx.JSONMap `json:"config" validate:"omitempty"`
	Enabled  jsonx.JSONMap `json:"enabled" validate:"omitempty"`
}

// FindLlmProvidersFilterDTO is the list query string; ToFilter turns it
// into the repository's filter options.
type FindLlmProvidersFilterDTO struct {
	Take *int `form:"take" validate:"omitempty,min=1"`
	Skip *int `form:"skip" validate:"omitempty,min=0"`
}

func (dto *FindLlmProvidersFilterDTO) ToFilter() *filter.Options[model.LlmProvider] {
	return filter.New[model.LlmProvider](
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
	)
}
