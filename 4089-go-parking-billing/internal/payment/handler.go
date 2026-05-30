package payment

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"parking-billing/config"
	"parking-billing/pkg/database"
	"parking-billing/pkg/mq"
	"parking-billing/pkg/util"

	"github.com/gin-gonic/gin"
)

type PayRequest struct {
	EntryID     uint   `json:"entry_id" binding:"required"`
	AmountCents int64  `json:"amount_cents" binding:"required"`
	Method      string `json:"method" binding:"required"`
	CouponCode  string `json:"coupon_code"`
	MemberID    *uint  `json:"member_id"`
}

type SeasonCardRequest struct {
	PlateNumber string `json:"plate_number" binding:"required"`
	CardType    string `json:"card_type" binding:"required"`
	StartDate   string `json:"start_date" binding:"required"`
	EndDate     string `json:"end_date" binding:"required"`
}

type AutoPayRequest struct {
	PlateNumber string `json:"plate_number" binding:"required"`
	Method      string `json:"method" binding:"required"`
	OpenID      string `json:"open_id"`
}

func Pay(c *gin.Context) {
	var req PayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	validMethods := map[string]bool{
		"wechat": true, "alipay": true, "cash": true, "bank_card": true, "auto_deduct": true,
	}
	if !validMethods[req.Method] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported payment method"})
		return
	}

	var existing Payment
	if err := database.DB.Where("entry_id = ? AND status = ?", req.EntryID, "paid").First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "already paid"})
		return
	}

	graceMinutes := config.C.Parking.GracePeriodMinutes
	graceDeadline := time.Now().Add(time.Duration(graceMinutes) * time.Minute)

	payment := Payment{
		EntryID:       req.EntryID,
		AmountCents:   req.AmountCents,
		OriginalCents: req.AmountCents,
		Method:        req.Method,
		Status:        "paid",
		GraceDeadline: &graceDeadline,
	}

	now := time.Now()
	payment.PaidAt = &now

	tx := database.DB.Begin()

	if err := tx.Create(&payment).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()

	msg, _ := json.Marshal(map[string]interface{}{
		"event":       "payment_completed",
		"payment_id":  payment.ID,
		"entry_id":    req.EntryID,
		"amount_cents": req.AmountCents,
		"method":      req.Method,
		"paid_at":     now,
	})
	mq.Publish("payment.events", msg)

	c.JSON(http.StatusOK, gin.H{
		"payment_id":     payment.ID,
		"amount_yuan":    util.CentsToYuan(req.AmountCents),
		"amount_cents":   req.AmountCents,
		"method":         req.Method,
		"status":         payment.Status,
		"grace_deadline": payment.GraceDeadline,
	})
}

func CheckSeasonCard(c *gin.Context) {
	plateNumber := c.Param("plate_number")
	now := time.Now()

	var card SeasonCard
	if err := database.DB.Where("plate_number = ? AND status = ? AND start_date <= ? AND end_date >= ?",
		plateNumber, "active", now, now).First(&card).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"has_card": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"has_card":   true,
		"card_type":  card.CardType,
		"start_date": card.StartDate,
		"end_date":   card.EndDate,
	})
}

func CreateSeasonCard(c *gin.Context) {
	var req SeasonCardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	validTypes := map[string]bool{"monthly": true, "quarterly": true, "yearly": true}
	if !validTypes[req.CardType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid card type"})
		return
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_date"})
		return
	}
	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_date"})
		return
	}

	card := SeasonCard{
		PlateNumber: req.PlateNumber,
		CardType:    req.CardType,
		StartDate:   startDate,
		EndDate:     endDate,
		Status:      "active",
	}
	if err := database.DB.Create(&card).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, card)
}

func BindAutoPay(c *gin.Context) {
	var req AutoPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	binding := AutoPayBinding{
		PlateNumber: req.PlateNumber,
		Method:      req.Method,
		OpenID:      req.OpenID,
		Status:      "active",
	}
	if err := database.DB.Create(&binding).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, binding)
}

func CheckAutoDeduct(c *gin.Context) {
	plateNumber := c.Param("plate_number")

	var binding AutoPayBinding
	if err := database.DB.Where("plate_number = ? AND status = ?", plateNumber, "active").First(&binding).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"auto_deduct": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"auto_deduct": true,
		"method":      binding.Method,
	})
}

func AutoDeductProcess(plateNumber string, entryID uint, amountCents int64) error {
	var binding AutoPayBinding
	if err := database.DB.Where("plate_number = ? AND status = ?", plateNumber, "active").First(&binding).Error; err != nil {
		return fmt.Errorf("auto pay not bound")
	}

	now := time.Now()
	graceMinutes := config.C.Parking.GracePeriodMinutes
	graceDeadline := now.Add(time.Duration(graceMinutes) * time.Minute)

	payment := Payment{
		EntryID:       entryID,
		AmountCents:   amountCents,
		OriginalCents: amountCents,
		Method:        string(PaymentAuto),
		Status:        "paid",
		PaidAt:        &now,
		GraceDeadline: &graceDeadline,
	}
	return database.DB.Create(&payment).Error
}

func GetPaymentByEntry(c *gin.Context) {
	entryID := c.Param("entry_id")
	var payment Payment
	if err := database.DB.Where("entry_id = ?", entryID).First(&payment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"payment_id":     payment.ID,
		"amount_cents":   payment.AmountCents,
		"amount_yuan":    util.CentsToYuan(payment.AmountCents),
		"method":         payment.Method,
		"status":         payment.Status,
		"paid_at":        payment.PaidAt,
		"grace_deadline": payment.GraceDeadline,
	})
}
