---
to: internal/module/<%= h.kebab(mod) %>/dto.go
inject: true
append: true
skip_if: type <%= dtoStruct %> struct
sh: gofmt -w internal/module/<%= h.kebab(mod) %>/dto.go
---

// <%= dtoStruct %> — added by `hygen module dto`.
type <%= dtoStruct %> struct {
<% goFields.forEach(function (f) { -%>
	<%= f.goName %> <%= f.goType %> `json:"<%= f.json %>" validate:"<%= f.createValidate %>"`
<% }); -%>
}
