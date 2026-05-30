package model

import (
	"time"
)

type AlertLevel string

const (
	AlertLevelInfo    AlertLevel = "info"
	AlertLevelWarning AlertLevel = "warning"
	AlertLevelError   AlertLevel = "error"
	AlertLevelCritical AlertLevel = "critical"
)

type AlertStatus string

const (
	AlertStatusActive   AlertStatus = "active"
	AlertStatusResolved AlertStatus = "resolved"
	AlertStatusIgnored  AlertStatus = "ignored"
)

type AlertRule struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	Name             string     `gorm:"size:64;not null" json:"name"`
	Description      string     `gorm:"size:256" json:"description"`
	RuleType         string     `gorm:"size:32;not null" json:"rule_type"`
	Condition        string     `gorm:"type:text;not null" json:"condition"`
	Level            AlertLevel `gorm:"size:16;not null" json:"level"`
	Enabled          bool       `gorm:"default:true" json:"enabled"`
	DeviceType       string     `gorm:"size:32" json:"device_type"`
	DeviceIDs        string     `gorm:"size:512" json:"device_ids"`
	GroupIDs         string     `gorm:"size:512" json:"group_ids"`
	Action           string     `gorm:"type:text" json:"action"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type AlertRecord struct {
	ID               uint        `gorm:"primaryKey" json:"id"`
	AlertID          string      `gorm:"uniqueIndex;size:64;not null" json:"alert_id"`
	RuleID           uint        `gorm:"index" json:"rule_id"`
	DeviceID         string      `gorm:"index;size:64;not null" json:"device_id"`
	Level            AlertLevel  `gorm:"size:16;not null" json:"level"`
	Title            string      `gorm:"size:128;not null" json:"title"`
	Message          string      `gorm:"type:text" json:"message"`
	Status           AlertStatus `gorm:"size:16;default:'active'" json:"status"`
	TriggeredAt      time.Time   `gorm:"index;not null" json:"triggered_at"`
	ResolvedAt       *time.Time  `json:"resolved_at"`
	Data             string      `gorm:"type:text" json:"data"`
}
