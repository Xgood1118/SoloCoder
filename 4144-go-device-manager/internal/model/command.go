package model

import (
	"time"
)

type CommandStatus string

const (
	CommandStatusPending   CommandStatus = "pending"
	CommandStatusSent      CommandStatus = "sent"
	CommandStatusExecuting CommandStatus = "executing"
	CommandStatusSuccess   CommandStatus = "success"
	CommandStatusFailed    CommandStatus = "failed"
	CommandStatusTimeout   CommandStatus = "timeout"
)

type CommandMode string

const (
	CommandModeSync  CommandMode = "sync"
	CommandModeAsync CommandMode = "async"
)

type DeviceCommand struct {
	ID            uint          `gorm:"primaryKey" json:"id"`
	CommandID     string        `gorm:"uniqueIndex;size:64;not null" json:"command_id"`
	DeviceID      string        `gorm:"index;size:64;not null" json:"device_id"`
	CommandType   string        `gorm:"size:32;not null" json:"command_type"`
	Mode          CommandMode   `gorm:"size:8;not null" json:"mode"`
	Status        CommandStatus `gorm:"size:16;default:'pending'" json:"status"`
	Payload       string        `gorm:"type:text" json:"payload"`
	Response      string        `gorm:"type:text" json:"response"`
	FirmwareVersion string      `gorm:"size:32" json:"firmware_version"`
	TimeoutSeconds int          `gorm:"default:30" json:"timeout_seconds"`
	SentAt        *time.Time    `json:"sent_at"`
	ExecutedAt    *time.Time    `json:"executed_at"`
	CompletedAt   *time.Time    `json:"completed_at"`
	CreatedAt     time.Time     `json:"created_at"`
}

type CommandIDMapping struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	DeviceID      string    `gorm:"index;size:64;not null" json:"device_id"`
	RequestID     string    `gorm:"uniqueIndex;size:64;not null" json:"request_id"`
	CommandID     string    `gorm:"size:64;not null" json:"command_id"`
	CreatedAt     time.Time `json:"created_at"`
}

type CommandVersionCompatibility struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	CommandType   string    `gorm:"size:32;not null" json:"command_type"`
	MinVersion    string    `gorm:"size:32;not null" json:"min_version"`
	MaxVersion    string    `gorm:"size:32" json:"max_version"`
	UpgradePath   string    `gorm:"type:text" json:"upgrade_path"`
}
