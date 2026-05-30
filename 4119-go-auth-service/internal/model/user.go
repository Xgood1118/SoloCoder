package model

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	Username     string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"username"`
	Email        string         `gorm:"type:varchar(100);uniqueIndex" json:"email"`
	Phone        string         `gorm:"type:varchar(20);uniqueIndex" json:"phone"`
	PasswordHash string         `gorm:"type:varchar(255);not null" json:"-"`
	Nickname     string         `gorm:"type:varchar(50)" json:"nickname"`
	Avatar       string         `gorm:"type:varchar(255)" json:"avatar"`
	Status       int            `gorm:"type:tinyint;default:1" json:"status"`
	Roles        []Role         `gorm:"many2many:user_roles" json:"roles,omitempty"`
}

type Role struct {
	ID          uint         `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	Name        string       `gorm:"type:varchar(50);uniqueIndex;not null" json:"name"`
	Code        string       `gorm:"type:varchar(50);uniqueIndex;not null" json:"code"`
	Description string       `gorm:"type:varchar(255)" json:"description"`
	Permissions []Permission `gorm:"many2many:role_permissions" json:"permissions,omitempty"`
	Users       []User       `gorm:"many2many:user_roles" json:"-"`
}

type Permission struct {
	ID          uint      `gorm:"primarykey" json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Name        string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"name"`
	Code        string    `gorm:"type:varchar(100);uniqueIndex;not null" json:"code"`
	Type        string    `gorm:"type:varchar(20);not null" json:"type"`
	Resource    string    `gorm:"type:varchar(50)" json:"resource"`
	Action      string    `gorm:"type:varchar(20)" json:"action"`
	Description string    `gorm:"type:varchar(255)" json:"description"`
	Roles       []Role    `gorm:"many2many:role_permissions" json:"-"`
}

type UserRole struct {
	UserID uint `gorm:"primaryKey"`
	RoleID uint `gorm:"primaryKey"`
}

type RolePermission struct {
	RoleID       uint `gorm:"primaryKey"`
	PermissionID uint `gorm:"primaryKey"`
}

const (
	UserStatusNormal   = 1
	UserStatusDisabled = 2
	UserStatusLocked   = 3
)

func (u *User) IsActive() bool {
	return u.Status == UserStatusNormal
}

func (u *User) HasRole(roleCode string) bool {
	for _, role := range u.Roles {
		if role.Code == roleCode {
			return true
		}
	}
	return false
}

func (u *User) GetPermissionCodes() []string {
	permissionMap := make(map[string]bool)
	for _, role := range u.Roles {
		for _, perm := range role.Permissions {
			permissionMap[perm.Code] = true
		}
	}
	codes := make([]string, 0, len(permissionMap))
	for code := range permissionMap {
		codes = append(codes, code)
	}
	return codes
}
