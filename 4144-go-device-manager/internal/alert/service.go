package alert

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/device-manager/internal/model"
	"github.com/device-manager/pkg/database"
	"github.com/device-manager/pkg/event"
	"github.com/google/uuid"
)

type AlertRuleCondition struct {
	Type       string      `json:"type"`
	Operator   string      `json:"operator"`
	Value      interface{} `json:"value"`
	Duration   int         `json:"duration_seconds"`
}

type AlertRuleService struct{}

func generateAlertID() string {
	return "alert_" + strings.ReplaceAll(uuid.New().String(), "-", "")
}

func CreateAlertRule(name, description, ruleType, condition string, level model.AlertLevel, deviceType string) (*model.AlertRule, error) {
	rule := &model.AlertRule{
		Name:        name,
		Description: description,
		RuleType:    ruleType,
		Condition:   condition,
		Level:       level,
		Enabled:     true,
		DeviceType:  deviceType,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := database.DB.Create(rule).Error; err != nil {
		return nil, err
	}
	return rule, nil
}

func GetAlertRule(id uint) (*model.AlertRule, error) {
	var rule model.AlertRule
	err := database.DB.First(&rule, id).Error
	return &rule, err
}

func ListAlertRules() ([]model.AlertRule, error) {
	var rules []model.AlertRule
	err := database.DB.Find(&rules).Error
	return rules, err
}

func TriggerAlert(ruleID uint, deviceID string, title, message string, data map[string]interface{}) (*model.AlertRecord, error) {
	rule, err := GetAlertRule(ruleID)
	if err != nil {
		return nil, err
	}

	alertID := generateAlertID()
	dataStr := ""
	if data != nil {
		dataBytes, _ := json.Marshal(data)
		dataStr = string(dataBytes)
	}

	alert := &model.AlertRecord{
		AlertID:     alertID,
		RuleID:      ruleID,
		DeviceID:    deviceID,
		Level:       rule.Level,
		Title:       title,
		Message:     message,
		Status:      model.AlertStatusActive,
		TriggeredAt: time.Now(),
		Data:        dataStr,
	}

	if err := database.DB.Create(alert).Error; err != nil {
		return nil, err
	}

	event.Publish(event.NewEvent(event.EventTypeAlertTriggered, deviceID, map[string]interface{}{
		"alert_id": alertID,
		"level":    rule.Level,
		"title":    title,
		"message":  message,
	}))

	return alert, nil
}

func ResolveAlert(alertID string) error {
	now := time.Now()
	return database.DB.Model(&model.AlertRecord{}).Where("alert_id = ?", alertID).Updates(map[string]interface{}{
		"status":      model.AlertStatusResolved,
		"resolved_at": now,
	}).Error
}

func ListAlerts(deviceID string, status model.AlertStatus, page, pageSize int) ([]model.AlertRecord, int64, error) {
	var alerts []model.AlertRecord
	var total int64

	query := database.DB.Model(&model.AlertRecord{})
	if deviceID != "" {
		query = query.Where("device_id = ?", deviceID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	err := query.Order("triggered_at DESC").Offset(offset).Limit(pageSize).Find(&alerts).Error
	return alerts, total, err
}

func CheckOfflineRule(deviceID string, offlineMinutes int) error {
	var rules []model.AlertRule
	database.DB.Where("rule_type = ? AND enabled = ?", "offline_duration", true).Find(&rules)

	for _, rule := range rules {
		var condition AlertRuleCondition
		json.Unmarshal([]byte(rule.Condition), &condition)
		if condition.Type == "offline_duration" {
			threshold, _ := condition.Value.(float64)
			if offlineMinutes >= int(threshold) {
				_, err := TriggerAlert(rule.ID, deviceID,
					"Device Offline Alert",
					"Device has been offline for more than threshold",
					map[string]interface{}{
						"offline_minutes": offlineMinutes,
						"threshold":       threshold,
					})
				if err != nil {
					return err
				}
			}
		}
	}
	return nil
}
