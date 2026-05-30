package billing

import (
	"net/http"
	"time"

	"parking-billing/pkg/database"
	"parking-billing/pkg/util"

	"github.com/gin-gonic/gin"
)

type CalculateRequest struct {
	EntryID    uint   `json:"entry_id" binding:"required"`
	ZoneID     uint   `json:"zone_id"`
	CouponCode string `json:"coupon_code"`
	MemberID   *uint  `json:"member_id"`
	IsEmployee bool   `json:"is_employee"`
}

type CalculateResponse struct {
	EntryID          uint   `json:"entry_id"`
	TotalMinutes     int    `json:"total_minutes"`
	FreeMinutes      int    `json:"free_minutes"`
	ChargeableMin    int    `json:"chargeable_min"`
	SubtotalYuan     string `json:"subtotal_yuan"`
	DiscountYuan     string `json:"discount_yuan"`
	TotalYuan        string `json:"total_yuan"`
	TotalCents       int64  `json:"total_cents"`
	Detail           BillingDetail `json:"detail"`
}

func CreateRule(c *gin.Context) {
	var rule BillingRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rule)
}

func ListRules(c *gin.Context) {
	var rules []BillingRule
	zoneID := c.Query("zone_id")
	query := database.DB.Order("priority DESC")
	if zoneID != "" {
		query = query.Where("zone_id = ?", zoneID)
	}
	if err := query.Find(&rules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rules)
}

func Calculate(c *gin.Context) {
	var req CalculateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var entry struct {
		ID          uint      `json:"id"`
		EntryTime   time.Time `json:"entry_time"`
		PlateNumber string    `json:"plate_number"`
	}
	if err := database.DB.Table("vehicle_entries").Where("id = ?", req.EntryID).Take(&entry).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "entry not found"})
		return
	}

	now := time.Now()
	totalMinutes := int(now.Sub(entry.EntryTime).Minutes())

	zoneID := req.ZoneID
	if zoneID == 0 {
		zoneID = 1
	}

	var rule BillingRule
	err := database.DB.Where("zone_id = ? AND is_holiday = ? AND effective_date <= ? AND (expiry_date IS NULL OR expiry_date >= ?)",
		zoneID, isHoliday(now), now, now).
		Order("priority DESC").
		First(&rule).Error
	if err != nil {
		err = database.DB.Where("zone_id = ? AND is_holiday = ?", zoneID, false).
			Order("priority DESC").
			First(&rule).Error
	}
	if err != nil {
		err = database.DB.Where("zone_id = ?", zoneID).
			Order("priority DESC").
			First(&rule).Error
	}
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no billing rule found"})
		return
	}

	detail := CalculateBilling(rule, totalMinutes)
	detail.EntryID = req.EntryID
	detail.RuleID = rule.ID

	totalCents := detail.TotalCents

	var discounts []Discount

	if req.IsEmployee {
		discounts = append(discounts, Discount{
			DiscountType:  "free",
			DiscountValue: 0,
			Stackable:     false,
		})
	}

	if req.MemberID != nil {
		var memberDiscount Discount
		if err := database.DB.Where("name LIKE ?", "%member%").First(&memberDiscount).Error; err == nil {
			discounts = append(discounts, memberDiscount)
		}
	}

	if req.CouponCode != "" {
		var coupon Coupon
		if err := database.DB.Where("code = ? AND used = ? AND (valid_to IS NULL OR valid_to >= ?)", req.CouponCode, false, now).First(&coupon).Error; err == nil {
			discounts = append(discounts, Discount{
				Name:          coupon.Name,
				DiscountType:  "fixed",
				DiscountValue: coupon.CentsValue,
				Stackable:     true,
			})
		}
	}

	discountCents := totalCents
	if len(discounts) > 0 {
		discountCents = ApplyDiscounts(totalCents, discounts)
	}
	discountAmount := totalCents - discountCents

	detail.TotalCents = discountCents
	database.DB.Create(&detail)

	c.JSON(http.StatusOK, CalculateResponse{
		EntryID:      req.EntryID,
		TotalMinutes: totalMinutes,
		FreeMinutes:  detail.FreeMinutes,
		ChargeableMin: detail.ChargeableMin,
		SubtotalYuan: formatCents(detail.SubtotalCents),
		DiscountYuan: formatCents(discountAmount),
		TotalYuan:    formatCents(discountCents),
		TotalCents:   discountCents,
		Detail:       detail,
	})
}

func CreateCoupon(c *gin.Context) {
	var coupon Coupon
	if err := c.ShouldBindJSON(&coupon); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&coupon).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, coupon)
}

func CreateDiscount(c *gin.Context) {
	var discount Discount
	if err := c.ShouldBindJSON(&discount); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&discount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, discount)
}

func formatCents(cents int64) string {
	yuan := util.CentsToYuan(cents)
	return formatFloat(yuan)
}

func formatFloat(f float64) string {
	return int64toStr(int64(f*100+0.5), 2)
}

func int64toStr(v int64, decimals int) string {
	if decimals == 0 {
		return intStr(v)
	}
	neg := false
	if v < 0 {
		neg = true
		v = -v
	}
	div := int64(1)
	for i := 0; i < decimals; i++ {
		div *= 10
	}
	intPart := v / div
	decPart := v % div
	s := intStr(intPart) + "."
	d := decPart
	for i := 0; i < decimals; i++ {
		div /= 10
		s += string(rune('0' + d/div))
		d %= div
	}
	if neg {
		s = "-" + s
	}
	return s
}

func intStr(n int64) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}

func isHoliday(t time.Time) bool {
	loc := t.Location()
	midnight := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
	return midnight.Weekday() == time.Saturday || midnight.Weekday() == time.Sunday
}
