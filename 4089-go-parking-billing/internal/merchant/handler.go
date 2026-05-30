package merchant

import (
	"encoding/json"
	"net/http"

	"parking-billing/pkg/database"
	"parking-billing/pkg/mq"

	"github.com/gin-gonic/gin"
)

type ConsumeRequest struct {
	MerchantID  uint   `json:"merchant_id" binding:"required"`
	OrderNo     string `json:"order_no" binding:"required"`
	PlateNumber string `json:"plate_number" binding:"required"`
	AmountCents int64  `json:"amount_cents" binding:"required"`
}

type ApplyBenefitRequest struct {
	EntryID     uint `json:"entry_id" binding:"required"`
	MerchantID  uint `json:"merchant_id" binding:"required"`
	OrderNo     string `json:"order_no"`
}

func CreateMerchant(c *gin.Context) {
	var merchant Merchant
	if err := c.ShouldBindJSON(&merchant); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&merchant).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, merchant)
}

func ListMerchants(c *gin.Context) {
	var merchants []Merchant
	if err := database.DB.Find(&merchants).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, merchants)
}

func CreateRule(c *gin.Context) {
	var rule MerchantRule
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

func ReportConsumption(c *gin.Context) {
	var req ConsumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var merchant Merchant
	if err := database.DB.First(&merchant, req.MerchantID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "merchant not found"})
		return
	}

	var rules []MerchantRule
	database.DB.Where("merchant_id = ? AND status = ?", req.MerchantID, "active").Find(&rules)

	freeMinutes := 0
	for _, rule := range rules {
		switch rule.RuleType {
		case "full_free":
			if req.AmountCents >= rule.MinConsumptionCents {
				freeMinutes = -1
			}
		case "partial_free":
			if req.AmountCents >= rule.MinConsumptionCents {
				freeMinutes += rule.FreeMinutes
			}
		}
	}

	record := ConsumptionRecord{
		MerchantID:  req.MerchantID,
		OrderNo:     req.OrderNo,
		PlateNumber: req.PlateNumber,
		AmountCents: req.AmountCents,
		FreeMinutes: freeMinutes,
	}
	if err := database.DB.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	msg, _ := json.Marshal(map[string]interface{}{
		"event":        "merchant_consumption",
		"plate_number": req.PlateNumber,
		"merchant_id":  req.MerchantID,
		"order_no":     req.OrderNo,
		"free_minutes": freeMinutes,
	})
	mq.Publish("merchant.events", msg)

	c.JSON(http.StatusOK, gin.H{
		"consumption_id": record.ID,
		"free_minutes":   freeMinutes,
		"message":        formatBenefitMessage(freeMinutes),
	})
}

func ApplyBenefit(c *gin.Context) {
	var req ApplyBenefitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var records []ConsumptionRecord
	database.DB.Where("merchant_id = ? AND plate_number IN (SELECT plate_number FROM vehicle_entries WHERE id = ?)",
		req.MerchantID, req.EntryID).Find(&records)

	totalFreeMinutes := 0
	totalDiscountCents := int64(0)

	for _, rec := range records {
		if rec.FreeMinutes == -1 {
			benefit := MerchantBenefit{
				EntryID:     req.EntryID,
				MerchantID:  req.MerchantID,
				BenefitType: "full_free",
				FreeMinutes: -1,
			}
			database.DB.Create(&benefit)

			msg, _ := json.Marshal(map[string]interface{}{
				"event":    "benefit_applied",
				"entry_id": req.EntryID,
				"type":     "full_free",
			})
			mq.Publish("merchant.events", msg)

			c.JSON(http.StatusOK, gin.H{
				"benefit_type": "full_free",
				"message":      "本次停车全免",
			})
			return
		}
		totalFreeMinutes += rec.FreeMinutes
	}

	if totalFreeMinutes > 0 || totalDiscountCents > 0 {
		benefit := MerchantBenefit{
			EntryID:       req.EntryID,
			MerchantID:    req.MerchantID,
			BenefitType:   "partial_free",
			FreeMinutes:   totalFreeMinutes,
			DiscountCents: totalDiscountCents,
		}
		database.DB.Create(&benefit)

		msg, _ := json.Marshal(map[string]interface{}{
			"event":        "benefit_applied",
			"entry_id":     req.EntryID,
			"type":         "partial_free",
			"free_minutes": totalFreeMinutes,
		})
		mq.Publish("merchant.events", msg)
	}

	c.JSON(http.StatusOK, gin.H{
		"benefit_type":   "partial_free",
		"free_minutes":   totalFreeMinutes,
		"discount_cents": totalDiscountCents,
		"message":        formatBenefitMessage(totalFreeMinutes),
	})
}

func GetBenefits(c *gin.Context) {
	entryID := c.Param("entry_id")
	var benefits []MerchantBenefit
	database.DB.Where("entry_id = ?", entryID).Find(&benefits)
	c.JSON(http.StatusOK, benefits)
}

func formatBenefitMessage(freeMinutes int) string {
	if freeMinutes == -1 {
		return "消费免单，本次停车全免"
	}
	if freeMinutes > 0 {
		return "消费减免，免" + intToStr(freeMinutes) + "分钟停车费"
	}
	return "无减免"
}

func intToStr(n int) string {
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
