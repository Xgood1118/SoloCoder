package billing

import (
	"math"
	"time"

	"gorm.io/gorm"
)

type BillingRule struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	ZoneID          uint           `gorm:"index;not null" json:"zone_id"`
	Name            string         `gorm:"size:100;not null" json:"name"`
	RuleType        string         `gorm:"size:30;not null;default:'progressive'" json:"rule_type"`
	FreeMinutes     int            `gorm:"not null;default:0" json:"free_minutes"`
	FirstMinutes    int            `gorm:"not null;default:60" json:"first_minutes"`
	FirstRateCents  int64          `gorm:"not null;default:500" json:"first_rate_cents"`
	NextMinutes     int            `gorm:"not null;default:30" json:"next_minutes"`
	NextRateCents   int64          `gorm:"not null;default:200" json:"next_rate_cents"`
	DailyCapCents   int64          `gorm:"not null;default:5000" json:"daily_cap_cents"`
	StartTime       string         `gorm:"size:10" json:"start_time"`
	EndTime         string         `gorm:"size:10" json:"end_time"`
	IsHoliday       bool           `gorm:"not null;default:false" json:"is_holiday"`
	EffectiveDate   *time.Time     `json:"effective_date"`
	ExpiryDate      *time.Time     `json:"expiry_date"`
	Priority        int            `gorm:"not null;default:0" json:"priority"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

type BillingDetail struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	EntryID         uint           `gorm:"index;not null" json:"entry_id"`
	RuleID          uint           `gorm:"index" json:"rule_id"`
	TotalMinutes    int            `gorm:"not null" json:"total_minutes"`
	FreeMinutes     int            `gorm:"not null;default:0" json:"free_minutes"`
	ChargeableMin   int            `gorm:"not null" json:"chargeable_min"`
	FirstPhaseMin   int            `gorm:"not null;default:0" json:"first_phase_min"`
	FirstPhaseCents int64          `gorm:"not null;default:0" json:"first_phase_cents"`
	NextPhaseMin    int            `gorm:"not null;default:0" json:"next_phase_min"`
	NextPhaseCents  int64          `gorm:"not null;default:0" json:"next_phase_cents"`
	SubtotalCents   int64          `gorm:"not null" json:"subtotal_cents"`
	DailyCapCents   int64          `gorm:"not null;default:0" json:"daily_cap_cents"`
	TotalCents      int64          `gorm:"not null" json:"total_cents"`
	CreatedAt       time.Time      `json:"created_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

type Discount struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	Name           string         `gorm:"size:100;not null" json:"name"`
	DiscountType   string         `gorm:"size:30;not null" json:"discount_type"`
	DiscountValue  int64          `gorm:"not null" json:"discount_value"`
	MinAmountCents int64          `gorm:"not null;default:0" json:"min_amount_cents"`
	Stackable      bool           `gorm:"not null;default:false" json:"stackable"`
	ValidFrom      *time.Time     `json:"valid_from"`
	ValidTo        *time.Time     `json:"valid_to"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

type Coupon struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Code        string         `gorm:"size:50;uniqueIndex;not null" json:"code"`
	Name        string         `gorm:"size:100;not null" json:"name"`
	CentsValue  int64          `gorm:"not null" json:"cents_value"`
	PlateNumber string         `gorm:"size:20;index" json:"plate_number"`
	Used        bool           `gorm:"not null;default:false" json:"used"`
	UsedAt      *time.Time     `json:"used_at"`
	ValidFrom   *time.Time     `json:"valid_from"`
	ValidTo     *time.Time     `json:"valid_to"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func CalculateBilling(rule BillingRule, totalMinutes int) BillingDetail {
	detail := BillingDetail{
		TotalMinutes:  totalMinutes,
		FreeMinutes:   0,
		ChargeableMin: totalMinutes,
		DailyCapCents: rule.DailyCapCents,
	}

	if totalMinutes <= rule.FreeMinutes {
		detail.FreeMinutes = totalMinutes
		detail.ChargeableMin = 0
		detail.TotalCents = 0
		return detail
	}

	detail.FreeMinutes = rule.FreeMinutes
	detail.ChargeableMin = totalMinutes - rule.FreeMinutes

	chargeable := detail.ChargeableMin

	firstMin := chargeable
	if firstMin > rule.FirstMinutes {
		firstMin = rule.FirstMinutes
	}
	detail.FirstPhaseMin = firstMin
	detail.FirstPhaseCents = rule.FirstRateCents

	remaining := chargeable - firstMin
	if remaining > 0 {
		nextPhases := int(math.Ceil(float64(remaining) / float64(rule.NextMinutes)))
		detail.NextPhaseMin = remaining
		detail.NextPhaseCents = int64(nextPhases) * rule.NextRateCents
	}

	detail.SubtotalCents = detail.FirstPhaseCents + detail.NextPhaseCents

	if rule.DailyCapCents > 0 && detail.SubtotalCents > rule.DailyCapCents {
		detail.TotalCents = rule.DailyCapCents
	} else {
		detail.TotalCents = detail.SubtotalCents
	}

	return detail
}

func ApplyDiscounts(totalCents int64, discounts []Discount) int64 {
	result := totalCents
	var stackableCents int64

	for _, d := range discounts {
		if d.MinAmountCents > 0 && result < d.MinAmountCents {
			continue
		}
		switch d.DiscountType {
		case "percentage":
			amt := result * d.DiscountValue / 100
			if d.Stackable {
				stackableCents += amt
			} else {
				result -= amt
			}
		case "fixed":
			if d.Stackable {
				stackableCents += d.DiscountValue
			} else {
				result -= d.DiscountValue
			}
		case "free":
			result = 0
			return 0
		}
	}

	result -= stackableCents
	if result < 0 {
		result = 0
	}
	return result
}
