package model

import (
	"time"
)

type DeviceStatus string

const (
	DeviceStatusOnline  DeviceStatus = "online"
	DeviceStatusOffline DeviceStatus = "offline"
)

type Device struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	DeviceID     string     `gorm:"uniqueIndex;size:64;not null" json:"device_id"`
	MacAddress   string     `gorm:"size:32;index" json:"mac_address"`
	SerialNumber string     `gorm:"size:64;index" json:"serial_number"`
	ChipID       string     `gorm:"size:64;index" json:"chip_id"`
	BoardSerial  string     `gorm:"size:64" json:"board_serial"`
	Name         string     `gorm:"size:128" json:"name"`
	Status       DeviceStatus `gorm:"size:16;default:'offline'" json:"status"`
	GroupID      uint       `gorm:"index" json:"group_id"`
	Tags         string     `gorm:"size:512" json:"tags"`
	DeviceType   string     `gorm:"size:32;index" json:"device_type"`
	FirmwareVersion string  `gorm:"size:32" json:"firmware_version"`
	IPAddress    string     `gorm:"size:64" json:"ip_address"`
	Location     string     `gorm:"size:128" json:"location"`
	Region       string     `gorm:"size:32;index" json:"region"`
	Owner        string     `gorm:"size:64;index" json:"owner"`
	LastHeartbeat *time.Time `json:"last_heartbeat"`
	LastOnline   *time.Time `json:"last_online"`
	Metadata     string     `gorm:"type:text" json:"metadata"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `gorm:"index" json:"deleted_at,omitempty"`
}

type DeviceWhitelist struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Identifier   string    `gorm:"uniqueIndex;size:64;not null" json:"identifier"`
	IDType       string    `gorm:"size:16;not null" json:"id_type"`
	DeviceType   string    `gorm:"size:32" json:"device_type"`
	Allowed      bool      `gorm:"default:true" json:"allowed"`
	Description  string    `gorm:"size:256" json:"description"`
	CreatedAt    time.Time `json:"created_at"`
}

type DeviceGroup struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"uniqueIndex;size:64;not null" json:"name"`
	Description string    `gorm:"size:256" json:"description"`
	ParentID    uint      `gorm:"index" json:"parent_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type DeviceTag struct {
	ID    uint   `gorm:"primaryKey" json:"id"`
	Key   string `gorm:"size:32;not null" json:"key"`
	Value string `gorm:"size:64;not null" json:"value"`
}
