package model

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/usesnipet/snipet/app/internal/auth"
	"gorm.io/gorm"
)

type Role string

const (
	RoleUser  Role = "user"
	RoleAdmin Role = "admin"
)

type User struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Nickname  string    `gorm:"type:varchar(255);not null;uniqueIndex:users_nickname_key" json:"nickname"`
	Name      string    `gorm:"type:varchar(255);not null" json:"name"`
	Email     string    `gorm:"type:varchar(255);not null;uniqueIndex:users_email_key" json:"email"`
	Password  string    `gorm:"type:varchar(255);not null" json:"-"`
	Role      Role      `gorm:"type:varchar(255);not null;default:user" json:"role"`
	CreatedAt time.Time `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP;autoUpdateTime" json:"updatedAt"`
}

func (u *User) BeforeSave(tx *gorm.DB) (err error) {
	u.Nickname = strings.ToLower(u.Nickname)
	u.Email = strings.ToLower(u.Email)
	u.Password, err = auth.HashPassword(u.Password)
	return err
}
