package model

import (
	"time"

	"github.com/google/uuid"
)

type MemberStatus string

const (
	MemberStatusActive   MemberStatus = "active"
	MemberStatusInactive MemberStatus = "inactive"
	MemberStatusPending  MemberStatus = "pending"
)

type Member struct {
	UserID         uuid.UUID    `gorm:"type:uuid;primaryKey" json:"userId"`
	OrganizationID uuid.UUID    `gorm:"type:uuid;primaryKey" json:"organizationId"`
	Role           Role         `gorm:"type:varchar(255);not null;default:user" json:"role"`
	Status         MemberStatus `gorm:"type:varchar(255);not null;default:pending" json:"status"`
	CreatedAt      time.Time    `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time    `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP;autoUpdateTime" json:"updatedAt"`

	User         User         `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE" json:"-"`
	Organization Organization `gorm:"foreignKey:OrganizationID;references:ID;constraint:OnDelete:CASCADE" json:"-"`
}
