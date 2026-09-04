package llmconnection

import (
	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/llm"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

type LLMConnectionResponse = model.LlmConnection

type LLMConnectionsPage = page.Paginated[model.LlmConnection]

// LLMProviderRegistry is one entry of the available provider drivers (internal/llm),
// as returned by GET /llm-connection/registry.
type LLMProviderRegistry = llm.Info

// CreateLlmConnectionDTO is the POST body — value fields, `validate:"required"`
// on what the entity cannot exist without.
type CreateLlmConnectionDTO struct {
	Name     string        `json:"name" validate:"required,max=255"`
	Provider string        `json:"provider" validate:"required,max=255"`
	Config   jsonx.JSONMap `json:"config" validate:"required"`
	Enabled  bool          `json:"enabled" validate:"omitempty"`
}

// UpdateLlmConnectionDTO is the PUT body — every field a pointer + `omitempty`:
// nil means "leave unchanged", which makes PUT a partial patch.
type UpdateLlmConnectionDTO struct {
	Name     *string       `json:"name" validate:"omitempty,max=255"`
	Provider *string       `json:"provider" validate:"omitempty,max=255"`
	Config   jsonx.JSONMap `json:"config" validate:"omitempty"`
	Enabled  *bool         `json:"enabled" validate:"omitempty"`
}

// FindLlmConnectionsFilterDTO is the list query string; ToFilter turns it
// into the repository's filter options.
type FindLlmConnectionsFilterDTO struct {
	Take *int `form:"take" validate:"omitempty,min=1"`
	Skip *int `form:"skip" validate:"omitempty,min=0"`
}

func (dto *FindLlmConnectionsFilterDTO) ToFilter() *filter.Options[model.LlmConnection] {
	return filter.New[model.LlmConnection](
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
	)
}
