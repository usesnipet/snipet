package model

import (
	"time"

	"github.com/usesnipet/snipet/internal/mcp"
	"github.com/usesnipet/snipet/pkg/jsonx"
)

// McpServer is the persistence shape of the mcp-server domain.
// Keep the gorm tags in sync with migrations/ — schema is generated from this
// struct by Atlas (see docs/backend/migrations.md), never hand-written.
type McpServer struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`

	Name string `gorm:"type:varchar(255);not null" json:"name"`

	Transport mcp.Transport `gorm:"type:varchar(255);not null" json:"transport"`

	Config jsonx.JSONMap `gorm:"type:jsonb;not null" json:"config"`

	LastSyncedAt time.Time `gorm:"type:timestamptz" json:"last_synced_at"`

	LastSyncedError string `gorm:"type:varchar(255)" json:"last_synced_error"`

	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (McpServer) TableName() string {
	return "mcp_servers"
}
