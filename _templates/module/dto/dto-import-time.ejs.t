---
to: <%= timeImportTo %>
inject: true
after: ^import \(
skip_if: \"time\"
sh: gofmt -w internal/module/<%= h.kebab(mod) %>/dto.go
---
	"time"
