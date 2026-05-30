package model

import (
	"time"
)

type FirmwareStatus string

const (
	FirmwareStatusDraft     FirmwareStatus = "draft"
	FirmwareStatusTesting   FirmwareStatus = "testing"
	FirmwareStatusReleased  FirmwareStatus = "released"
	FirmwareStatusDeprecated FirmwareStatus = "deprecated"
)

type UpgradeStatus string

const (
	UpgradeStatusPending    UpgradeStatus = "pending"
	UpgradeStatusDownloading UpgradeStatus = "downloading"
	UpgradeStatusUpgrading  UpgradeStatus = "upgrading"
	UpgradeStatusSuccess    UpgradeStatus = "success"
	UpgradeStatusFailed     UpgradeStatus = "failed"
)

type Firmware struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	FirmwareID    string         `gorm:"uniqueIndex;size:64;not null" json:"firmware_id"`
	Version       string         `gorm:"size:32;not null" json:"version"`
	DeviceType    string         `gorm:"size:32;index;not null" json:"device_type"`
	Name          string         `gorm:"size:128;not null" json:"name"`
	Description   string         `gorm:"size:512" json:"description"`
	FileSize      int64          `json:"file_size"`
	FileURL       string         `gorm:"size:256" json:"file_url"`
	Checksum      string         `gorm:"size:128" json:"checksum"`
	ChecksumType  string         `gorm:"size:16" json:"checksum_type"`
	Status        FirmwareStatus `gorm:"size:16;default:'draft'" json:"status"`
	MinVersion    string         `gorm:"size:32" json:"min_version"`
	MaxVersion    string         `gorm:"size:32" json:"max_version"`
	ForceUpgrade  bool           `gorm:"default:false" json:"force_upgrade"`
	ReleaseNotes  string         `gorm:"type:text" json:"release_notes"`
	CreatedBy     string         `gorm:"size:64" json:"created_by"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

type FirmwareUpgradeJob struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	JobID         string         `gorm:"uniqueIndex;size:64;not null" json:"job_id"`
	FirmwareID    string         `gorm:"size:64;not null" json:"firmware_id"`
	DeviceIDs     string         `gorm:"type:text" json:"device_ids"`
	GroupIDs      string         `gorm:"type:text" json:"group_ids"`
	DeviceType    string         `gorm:"size:32;index" json:"device_type"`
	Status        UpgradeStatus  `gorm:"size:16;default:'pending'" json:"status"`
	ScheduledAt   *time.Time     `json:"scheduled_at"`
	StartedAt     *time.Time     `json:"started_at"`
	CompletedAt   *time.Time     `json:"completed_at"`
	TotalDevices  int            `json:"total_devices"`
	SuccessCount  int            `json:"success_count"`
	FailedCount   int            `json:"failed_count"`
	CreatedBy     string         `gorm:"size:64" json:"created_by"`
	CreatedAt     time.Time      `json:"created_at"`
}

type DeviceUpgradeRecord struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	RecordID      string         `gorm:"uniqueIndex;size:64;not null" json:"record_id"`
	JobID         string         `gorm:"index;size:64;not null" json:"job_id"`
	DeviceID      string         `gorm:"index;size:64;not null" json:"device_id"`
	FirmwareID    string         `gorm:"size:64;not null" json:"firmware_id"`
	FromVersion   string         `gorm:"size:32" json:"from_version"`
	ToVersion     string         `gorm:"size:32" json:"to_version"`
	Status        UpgradeStatus  `gorm:"size:16;default:'pending'" json:"status"`
	Progress      int            `gorm:"default:0" json:"progress"`
	ErrorMessage  string         `gorm:"size:512" json:"error_message"`
	DownloadSpeed float64        `json:"download_speed"`
	StartedAt     *time.Time     `json:"started_at"`
	CompletedAt   *time.Time     `json:"completed_at"`
	CreatedAt     time.Time      `json:"created_at"`
}
