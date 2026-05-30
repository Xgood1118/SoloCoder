package alert

import (
	"net/http"
	"strconv"

	"github.com/device-manager/internal/model"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		alertRules := api.Group("/alert-rules")
		{
			alertRules.POST("", CreateRuleHandler)
			alertRules.GET("", ListRulesHandler)
			alertRules.GET("/:id", GetRuleHandler)
		}

		alerts := api.Group("/alerts")
		{
			alerts.GET("", ListAlertsHandler)
			alerts.PUT("/:alert_id/resolve", ResolveAlertHandler)
		}
	}
}

func CreateRuleHandler(c *gin.Context) {
	var body struct {
		Name        string          `json:"name" binding:"required"`
		Description string          `json:"description"`
		RuleType    string          `json:"rule_type" binding:"required"`
		Condition   string          `json:"condition" binding:"required"`
		Level       model.AlertLevel `json:"level" binding:"required"`
		DeviceType  string          `json:"device_type"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule, err := CreateAlertRule(body.Name, body.Description, body.RuleType, body.Condition, body.Level, body.DeviceType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rule)
}

func ListRulesHandler(c *gin.Context) {
	rules, err := ListAlertRules()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rules)
}

func GetRuleHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	rule, err := GetAlertRule(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}
	c.JSON(http.StatusOK, rule)
}

func ListAlertsHandler(c *gin.Context) {
	deviceID := c.Query("device_id")
	status := model.AlertStatus(c.Query("status"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	alerts, total, err := ListAlerts(deviceID, status, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"alerts": alerts,
	})
}

func ResolveAlertHandler(c *gin.Context) {
	alertID := c.Param("alert_id")
	if err := ResolveAlert(alertID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "alert resolved"})
}
