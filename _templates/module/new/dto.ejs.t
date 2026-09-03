---
to: internal/module/<%= h.kebab(name) %>/dto.go
sh: gofmt -w internal/module/<%= h.kebab(name) %>/dto.go
---
<% const P = h.pascal(name); const Plural = h.pluralPascal(name); -%>
package <%= h.pkgName(name) %>

import (
<% if (goFields.some((f) => f.isTime)) { -%>
	"time"

<% } -%>
	"<%= h.goModule() %>/internal/filter"
	"<%= h.goModule() %>/internal/model"
<% if (goFields.some((f) => f.jsonMap)) { -%>
	"<%= h.goModule() %>/pkg/jsonx"
<% } -%>
)

// Create<%= P %>DTO is the POST body — value fields, `validate:"required"`
// on what the entity cannot exist without.
type Create<%= P %>DTO struct {
<% goFields.forEach(function (f) { -%>
	<%= f.goName %> <%= f.goType %> `json:"<%= f.json %>" validate:"<%= f.createValidate %>"`
<% }); -%>
}

// Update<%= P %>DTO is the PUT body — every field a pointer + `omitempty`:
// nil means "leave unchanged", which makes PUT a partial patch.
type Update<%= P %>DTO struct {
<% goFields.forEach(function (f) { -%>
	<%= f.goName %> <%= f.updateType %> `json:"<%= f.json %>" validate:"<%= f.updateValidate %>"`
<% }); -%>
}

// Find<%= Plural %>FilterDTO is the list query string; ToFilter turns it
// into the repository's filter options.
type Find<%= Plural %>FilterDTO struct {
	Take *int `form:"take" validate:"omitempty,min=1"`
	Skip *int `form:"skip" validate:"omitempty,min=0"`
}

func (dto *Find<%= Plural %>FilterDTO) ToFilter() *filter.Options[model.<%= P %>] {
	return filter.New[model.<%= P %>](
		filter.PtrTake(dto.Take),
		filter.PtrSkip(dto.Skip),
	)
}
