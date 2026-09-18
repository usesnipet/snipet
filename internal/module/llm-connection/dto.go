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
	Default  bool          `json:"default" validate:"omitempty"`
}

// UpdateLlmConnectionDTO is the PUT body — every field a pointer + `omitempty`:
// nil means "leave unchanged", which makes PUT a partial patch.
type UpdateLlmConnectionDTO struct {
	Name     *string       `json:"name" validate:"omitempty,max=255"`
	Provider *string       `json:"provider" validate:"omitempty,max=255"`
	Config   jsonx.JSONMap `json:"config" validate:"omitempty"`
	Enabled  *bool         `json:"enabled" validate:"omitempty"`
	Default  *bool         `json:"default" validate:"omitempty"`
}

// ExecuteLlmTargetDTO is one llm.Target the Runner may try. Model is a
// "provider-key/model" reference. ConnectionOptions, when set, is used as-is;
// otherwise ConnectionID names a specific stored LlmConnection, or — when
// neither is set — the provider's default connection is used, falling back
// to its oldest connection.
type ExecuteLlmTargetDTO struct {
	Model             string        `json:"model" validate:"required"`
	ConnectionID      *string       `json:"connection_id" validate:"omitempty"`
	ConnectionOptions jsonx.JSONMap `json:"connection_options" validate:"omitempty"`
	ExtraOptions      jsonx.JSONMap `json:"extra_options" validate:"omitempty"`
}

// ExecuteLlmDTO is the body of both execute endpoints: an ordered list of
// targets the Runner tries in turn (see llm.Runner's failover semantics),
// plus the conversation to run them against.
type ExecuteLlmDTO struct {
	Targets  []ExecuteLlmTargetDTO `json:"targets" validate:"required,min=1,dive"`
	Messages []llm.Message         `json:"messages" validate:"required,min=1"`
}

// ExecuteLlmResponse is the result of the non-streaming execute endpoint.
type ExecuteLlmResponse = llm.Response

// FindLlmConnectionsFilterDTO is the list query string; ToFilter turns it
// into the repository's filter options.
type FindLlmConnectionsFilterDTO struct {
	Take *int `form:"take" validate:"omitempty,min=1"`
	Skip *int `form:"skip" validate:"omitempty,min=0"`
}

// ProviderModel is one entry of a provider's model catalog (llm.Model), as
// returned by GET /llm-connection/providers/{key}/models.
type ProviderModel = llm.Model

// ListProviderModelsFilterDTO is the query string of GET
// /llm-connection/providers/{key}/models. ConnectionID, when set, names the
// stored connection to source connection options from; otherwise the
// provider's default connection is used.
type ListProviderModelsFilterDTO struct {
	ConnectionID *string `form:"connection_id" validate:"omitempty"`
}

func (dto *FindLlmConnectionsFilterDTO) ToFilter() *filter.Options[model.LlmConnection] {
	return filter.New[model.LlmConnection](
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
	)
}
