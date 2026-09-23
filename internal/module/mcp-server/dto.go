package mcpserver

import (
	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/mcp"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// McpServerResponse and McpServersPage exist so swagger annotations in this
// package can name a plain type — swag can't parse a generic instantiation
// like page.Paginated[model.McpServer] inline.
type McpServerResponse = model.McpServer

type McpServersPage = page.Paginated[model.McpServer]

type McpServerRegistryItem = mcp.MCPServersRegistryItem

// CreateMcpServerDTO is the POST body — value fields, `validate:"required"`
// on what the entity cannot exist without. LastSyncedAt/LastSyncedError are
// set by the tool-sync process, never by the client.
type CreateMcpServerDTO struct {
	Name      string        `json:"name" validate:"required,max=255"`
	Transport mcp.Transport `json:"transport" validate:"required,oneof=http stdio"`
	Config    jsonx.JSONMap `json:"config" validate:"required"`
}

// UpdateMcpServerDTO is the PUT body — every field a pointer + `omitempty`:
// nil means "leave unchanged", which makes PUT a partial patch.
type UpdateMcpServerDTO struct {
	Name      *string        `json:"name" validate:"omitempty,max=255"`
	Transport *mcp.Transport `json:"transport" validate:"omitempty,oneof=http stdio"`
	Config    jsonx.JSONMap  `json:"config" validate:"omitempty"`
}

// FindMcpServersFilterDTO is the list query string; ToFilter turns it
// into the repository's filter options.
type FindMcpServersFilterDTO struct {
	Take *int `form:"take" validate:"omitempty,min=1"`
	Skip *int `form:"skip" validate:"omitempty,min=0"`
}

func (dto *FindMcpServersFilterDTO) ToFilter() *filter.Options[model.McpServer] {
	return filter.New[model.McpServer](
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
	)
}
