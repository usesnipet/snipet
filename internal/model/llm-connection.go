package model

import (
	"time"

	"github.com/usesnipet/snipet/pkg/jsonx"
)

// LlmConnection is the persistence shape of the llm-connection domain — a named,
// configured connection to an LLM provider (the provider drivers themselves live
// in internal/llm).
// Keep the gorm tags in sync with migrations/ — schema is generated from this
// struct by Atlas (see docs/backend/migrations.md), never hand-written.
type LlmConnection struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`

	Name string `gorm:"type:varchar(255);not null" json:"name"`

	Provider string `gorm:"type:varchar(255);not null" json:"provider"`

	Config jsonx.JSONMap `gorm:"type:jsonb;not null" json:"config"`

	Enabled bool `gorm:"type:boolean" json:"enabled"`

	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
	UpdatedAt time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

func (LlmConnection) TableName() string {
	return "llm_connections"
}
