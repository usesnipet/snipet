package tool

import (
	"strings"

	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
	"github.com/usesnipet/snipet/internal/tool"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// ToolResponse and ToolsPage exist so swagger annotations in this package
// can name a plain type — swag can't parse a generic instantiation like
// page.Paginated[model.Tool] inline.
type ToolResponse = model.Tool

type ToolsPage = page.Paginated[model.Tool]

type ExecuteToolResponse = tool.Result

// ExecuteToolDTO is the POST /tool/{id}/execute body; Arguments must match
// the tool's input schema.
type ExecuteToolDTO struct {
	Arguments jsonx.JSONMap `json:"arguments" swaggertype:"object"`
}

// FindToolsFilterDTO is the list query string; ToFilter turns it
// into the repository's filter options.
type FindToolsFilterDTO struct {
	Take        *int    `form:"take" validate:"omitempty,min=1"`
	Skip        *int    `form:"skip" validate:"omitempty,min=0"`
	Search      *string `form:"search" validate:"omitempty,max=255"`
	Source      *string `form:"source" validate:"omitempty,oneof=mcp native"`
	McpServerID *string `form:"mcp_server_id" validate:"omitempty,uuid"`
}

// likeEscaper escapes LIKE wildcards so a search term matches literally.
var likeEscaper = strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`)

func (dto *FindToolsFilterDTO) ToFilter() *filter.Options[model.Tool] {
	opts := []filter.Option{
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
		filter.OrderAsc("name"),
		filter.Include("McpServer"),
	}
	if dto.Search != nil && strings.TrimSpace(*dto.Search) != "" {
		opts = append(opts, filter.WhereILike("name", "%"+likeEscaper.Replace(strings.TrimSpace(*dto.Search))+"%"))
	}
	if dto.Source != nil {
		opts = append(opts, filter.WhereEq("source", *dto.Source))
	}
	if dto.McpServerID != nil {
		opts = append(opts, filter.WhereEq("mcp_server_id", *dto.McpServerID))
	}
	return filter.New[model.Tool](opts...)
}
