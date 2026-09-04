package model

import (
	"time"
)

type RefreshToken struct {
	ID string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`

	UserID    string     `gorm:"type:uuid;not null;index" json:"user_id"`
	Hash      string     `gorm:"type:text;not null;uniqueIndex" json:"-"`
	ExpiresAt time.Time  `gorm:"type:timestamp;not null" json:"expires_at"`
	CreatedAt time.Time  `gorm:"type:timestamp;not null;default:now()" json:"created_at"`
	RevokedAt *time.Time `gorm:"type:timestamp" json:"revoked_at"`

	User *User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE" json:"user"`
}
