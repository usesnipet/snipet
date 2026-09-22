package model

import (
	"time"

	"github.com/usesnipet/snipet/internal/tool"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// Tool is the persistence shape of the tool domain.
// Keep the gorm tags in sync with migrations/ — schema is generated from this
// struct by Atlas (see docs/backend/migrations.md), never hand-written.
type Tool struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`

	Name string `gorm:"type:varchar(255);not null" json:"name"`

	Description string `gorm:"type:text;not null" json:"description"`

	InputSchema jsonx.JSONMap `gorm:"type:jsonb;not null" json:"input_schema"`

	Source tool.Source `gorm:"type:varchar(255);not null" json:"source"`

	McpServerId *string    `gorm:"type:uuid;index" json:"mcp_server_id"`
	McpServer   *McpServer `gorm:"foreignKey:McpServerId;references:ID;constraint:OnDelete:CASCADE" json:"mcp_server"`

	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (Tool) TableName() string {
	return "tools"
}
