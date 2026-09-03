---
to: internal/model/<%= h.kebab(name) %>.go
sh: gofmt -w internal/model/<%= h.kebab(name) %>.go
---
package model

<% if (goFields.some((f) => f.jsonMap)) { -%>
import (
	"time"

	"<%= h.goModule() %>/pkg/jsonx"
)
<% } else { -%>
import "time"
<% } -%>

// <%= h.pascal(name) %> — persistence shape of the <%= h.kebab(name) %> domain.
// gorm tags are the schema source of truth for Atlas (docs/backend/migrations.md).
type <%= h.pascal(name) %> struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
<% goFields.forEach(function (f) { -%>

	<%= f.goName %> <%= f.goType %> `gorm:"<%= f.gormTag %>" json:"<%= f.json %>"`
<% }); -%>

	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (<%= h.pascal(name) %>) TableName() string {
	return "<%= h.tableName(name) %>"
}
