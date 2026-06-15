package model

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleGuest Role = "guest"
	RoleUser  Role = "user"
	RoleAdmin Role = "admin"
)

type User struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name      string    `gorm:"type:varchar(255);not null" json:"name"`
	Email     string    `gorm:"type:varchar(255);not null;uniqueIndex:users_email_key" json:"email"`
	Password  string    `gorm:"type:varchar(255);not null" json:"password"`
	Role      Role      `gorm:"type:varchar(255);not null;default:guest" json:"role"`
	CreatedAt time.Time `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP;autoUpdateTime" json:"updatedAt"`
}

func (u User) GetID() string {
	return u.ID.String()
}
