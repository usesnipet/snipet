---
to: <%= jsonxImportTo %>
inject: true
after: ^import \(
skip_if: pkg/jsonx
sh: gofmt -w internal/module/<%= h.kebab(mod) %>/dto.go
---
	"<%= h.goModule() %>/pkg/jsonx"
