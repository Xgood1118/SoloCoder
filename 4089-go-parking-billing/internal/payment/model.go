package payment

import (
	"time"

	"gorm.io/gorm"
)

type PaymentMethod string

const (
	PaymentWechat   PaymentMethod = "wechat"
	PaymentAlipay   PaymentMethod = "alipay"
	PaymentCash     PaymentMethod = "cash"
	PaymentBankCard PaymentMethod = "bank_card"
	PaymentAuto     PaymentMethod = "auto_deduct"
)

type Payment struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	EntryID        uint           `gorm:"index;not null" json:"entry_id"`
	AmountCents    int64          `gorm:"not null" json:"amount_cents"`
	OriginalCents  int64          `gorm:"not null" json:"original_cents"`
	DiscountCents  int64          `gorm:"not null;default:0" json:"discount_cents"`
	Method         string         `gorm:"size:20;not null" json:"method"`
	Status         string         `gorm:"size:20;not null;default:'pending'" json:"status"`
	TransactionID  string         `gorm:"size:100" json:"transaction_id"`
	PaidAt         *time.Time     `json:"paid_at"`
	GraceDeadline  *time.Time     `json:"grace_deadline"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

type SeasonCard struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	PlateNumber string         `gorm:"size:20;index;not null" json:"plate_number"`
	CardType    string         `gorm:"size:20;not null" json:"card_type"`
	StartDate   time.Time      `gorm:"not null" json:"start_date"`
	EndDate     time.Time      `gorm:"not null" json:"end_date"`
	Status      string         `gorm:"size:20;not null;default:'active'" json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type AutoPayBinding struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	PlateNumber string         `gorm:"size:20;uniqueIndex;not null" json:"plate_number"`
	Method      string         `gorm:"size:20;not null" json:"method"`
	OpenID      string         `gorm:"size:100" json:"open_id"`
	Status      string         `gorm:"size:20;not null;default:'active'" json:"status"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
