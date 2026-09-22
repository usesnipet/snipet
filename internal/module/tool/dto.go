package tool

import (
	"github.com/usesnipet/snipet/internal/filter"
	"github.com/usesnipet/snipet/internal/model"
	"github.com/usesnipet/snipet/internal/page"
)

// ToolResponse and ToolsPage exist so swagger annotations in this package
// can name a plain type — swag can't parse a generic instantiation like
// page.Paginated[model.Tool] inline.
type ToolResponse = model.Tool

type ToolsPage = page.Paginated[model.Tool]

// FindToolsFilterDTO is the list query string; ToFilter turns it
// into the repository's filter options.
type FindToolsFilterDTO struct {
	Take *int `form:"take" validate:"omitempty,min=1"`
	Skip *int `form:"skip" validate:"omitempty,min=0"`
}

func (dto *FindToolsFilterDTO) ToFilter() *filter.Options[model.Tool] {
	return filter.New[model.Tool](
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
	)
}
