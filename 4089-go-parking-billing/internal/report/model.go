package report

import (
	"time"

	"gorm.io/gorm"
)

type OccupancyStat struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	ZoneID       uint           `gorm:"index;not null" json:"zone_id"`
	TotalSpots   int            `gorm:"not null" json:"total_spots"`
	OccupiedSpots int           `gorm:"not null" json:"occupied_spots"`
	OccupancyRate float64       `gorm:"not null" json:"occupancy_rate"`
	RecordedAt   time.Time      `gorm:"index;not null" json:"recorded_at"`
	CreatedAt    time.Time      `json:"created_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type DailyRevenue struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	Date           string         `gorm:"size:10;uniqueIndex;not null" json:"date"`
	TotalPayments  int            `gorm:"not null;default:0" json:"total_payments"`
	TotalCents     int64          `gorm:"not null;default:0" json:"total_cents"`
	WechatCents    int64          `gorm:"not null;default:0" json:"wechat_cents"`
	AlipayCents    int64          `gorm:"not null;default:0" json:"alipay_cents"`
	CashCents      int64          `gorm:"not null;default:0" json:"cash_cents"`
	BankCardCents  int64          `gorm:"not null;default:0" json:"bank_card_cents"`
	AutoDeductCents int64         `gorm:"not null;default:0" json:"auto_deduct_cents"`
	CreatedAt      time.Time      `json:"created_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

type PeakHourStat struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Date        string         `gorm:"size:10;index;not null" json:"date"`
	Hour        int            `gorm:"not null" json:"hour"`
	EntryCount  int            `gorm:"not null;default:0" json:"entry_count"`
	ExitCount   int            `gorm:"not null;default:0" json:"exit_count"`
	CreatedAt   time.Time      `json:"created_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
