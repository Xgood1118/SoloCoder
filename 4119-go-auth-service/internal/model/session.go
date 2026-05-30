package model

import (
	"time"

	"gorm.io/gorm"
)

type Session struct {
	ID           uint           `gorm:"primarykey" json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
	UserID       uint           `gorm:"index;not null" json:"user_id"`
	SessionID    string         `gorm:"type:varchar(64);uniqueIndex;not null" json:"session_id"`
	RefreshToken string         `gorm:"type:varchar(255);not null" json:"-"`
	IPAddress    string         `gorm:"type:varchar(45)" json:"ip_address"`
	UserAgent    string         `gorm:"type:varchar(512)" json:"user_agent"`
	DeviceType   string         `gorm:"type:varchar(50)" json:"device_type"`
	DeviceInfo   string         `gorm:"type:text" json:"device_info"`
	Location     string         `gorm:"type:varchar(100)" json:"location"`
	LastActiveAt time.Time      `gorm:"index" json:"last_active_at"`
	ExpiresAt    time.Time      `gorm:"index" json:"expires_at"`
	IsRevoked    bool           `gorm:"default:false;index" json:"is_revoked"`
	User         User           `gorm:"foreignKey:UserID" json:"-"`
}

type VerificationCode struct {
	ID         uint           `gorm:"primarykey" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	Target     string         `gorm:"type:varchar(100);index;not null" json:"target"`
	Code       string         `gorm:"type:varchar(10);not null" json:"code"`
	Type       string         `gorm:"type:varchar(20);index;not null" json:"type"`
	Usage      string         `gorm:"type:varchar(20);index;not null" json:"usage"`
	Attempts   int            `gorm:"default:0" json:"attempts"`
	MaxAttempts int           `gorm:"default:5" json:"max_attempts"`
	ExpiresAt  time.Time      `gorm:"index" json:"expires_at"`
	IsUsed     bool           `gorm:"default:false;index" json:"is_used"`
}

type QRCodeLogin struct {
	ID         uint           `gorm:"primarykey" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
	QRCodeID   string         `gorm:"type:varchar(64);uniqueIndex;not null" json:"qr_code_id"`
	Status     int            `gorm:"type:tinyint;default:1;index" json:"status"`
	UserID     *uint          `gorm:"index" json:"user_id"`
	Token      string         `gorm:"type:varchar(255)" json:"-"`
	ExpiresAt  time.Time      `gorm:"index" json:"expires_at"`
	ScannedAt  *time.Time     `json:"scanned_at"`
	ConfirmedAt *time.Time    `json:"confirmed_at"`
	User       *User          `gorm:"foreignKey:UserID" json:"-"`
}

type PasswordResetToken struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	UserID    uint           `gorm:"index;not null" json:"user_id"`
	Token     string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"-"`
	Type      string         `gorm:"type:varchar(20);not null" json:"type"`
	ExpiresAt time.Time      `gorm:"index" json:"expires_at"`
	IsUsed    bool           `gorm:"default:false;index" json:"is_used"`
	User      User           `gorm:"foreignKey:UserID" json:"-"`
}

type LoginHistory struct {
	ID         uint           `gorm:"primarykey" json:"id"`
	CreatedAt  time.Time      `json:"created_at"`
	UserID     uint           `gorm:"index;not null" json:"user_id"`
	IPAddress  string         `gorm:"type:varchar(45);index" json:"ip_address"`
	UserAgent  string         `gorm:"type:varchar(512)" json:"user_agent"`
	DeviceType string         `gorm:"type:varchar(50)" json:"device_type"`
	Location   string         `gorm:"type:varchar(100)" json:"location"`
	Status     int            `gorm:"type:tinyint;not null" json:"status"`
	FailReason string         `gorm:"type:varchar(255)" json:"fail_reason"`
	User       User           `gorm:"foreignKey:UserID" json:"-"`
}

const (
	QRCodeStatusWaiting   = 1
	QRCodeStatusScanned   = 2
	QRCodeStatusConfirmed = 3
	QRCodeStatusExpired   = 4
	QRCodeStatusCanceled  = 5
)

const (
	LoginStatusSuccess = 1
	LoginStatusFailed  = 2
)

const (
	CodeTypeSMS   = "sms"
	CodeTypeEmail = "email"
)

const (
	UsageRegister     = "register"
	UsageLogin        = "login"
	UsageResetPassword = "reset_password"
)

func (s *Session) IsValid() bool {
	return !s.IsRevoked && time.Now().Before(s.ExpiresAt)
}

func (c *VerificationCode) CanAttempt() bool {
	return c.Attempts < c.MaxAttempts && !c.IsUsed && time.Now().Before(c.ExpiresAt)
}

func (q *QRCodeLogin) IsExpired() bool {
	return time.Now().After(q.ExpiresAt)
}

func (t *PasswordResetToken) IsValid() bool {
	return !t.IsUsed && time.Now().Before(t.ExpiresAt)
}
