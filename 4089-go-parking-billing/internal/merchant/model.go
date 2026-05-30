package merchant

import (
	"time"

	"gorm.io/gorm"
)

type Merchant struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"size:100;not null" json:"name"`
	Code      string         `gorm:"size:30;uniqueIndex;not null" json:"code"`
	Contact   string         `gorm:"size:50" json:"contact"`
	Phone     string         `gorm:"size:20" json:"phone"`
	Status    string         `gorm:"size:20;not null;default:'active'" json:"status"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type MerchantRule struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	MerchantID        uint           `gorm:"index;not null" json:"merchant_id"`
	RuleType          string         `gorm:"size:30;not null" json:"rule_type"`
	MinConsumptionCents int64        `gorm:"not null;default:0" json:"min_consumption_cents"`
	FreeMinutes       int            `gorm:"not null;default:0" json:"free_minutes"`
	DiscountCents     int64          `gorm:"not null;default:0" json:"discount_cents"`
	Status            string         `gorm:"size:20;not null;default:'active'" json:"status"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

type ConsumptionRecord struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	MerchantID  uint           `gorm:"index;not null" json:"merchant_id"`
	OrderNo     string         `gorm:"size:50;not null" json:"order_no"`
	PlateNumber string         `gorm:"size:20;index;not null" json:"plate_number"`
	AmountCents int64          `gorm:"not null" json:"amount_cents"`
	FreeMinutes int            `gorm:"not null;default:0" json:"free_minutes"`
	CreatedAt   time.Time      `json:"created_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type MerchantBenefit struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	EntryID     uint           `gorm:"index;not null" json:"entry_id"`
	MerchantID  uint           `gorm:"index;not null" json:"merchant_id"`
	RuleID      uint           `gorm:"index" json:"rule_id"`
	BenefitType string         `gorm:"size:30;not null" json:"benefit_type"`
	FreeMinutes int            `gorm:"not null;default:0" json:"free_minutes"`
	DiscountCents int64        `gorm:"not null;default:0" json:"discount_cents"`
	CreatedAt   time.Time      `json:"created_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
