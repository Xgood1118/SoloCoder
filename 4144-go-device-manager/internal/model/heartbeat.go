package model

import (
	"time"
)

type HeartbeatRecord struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	DeviceID   string    `gorm:"index;size:64;not null" json:"device_id"`
	Timestamp  time.Time `gorm:"index;not null" json:"timestamp"`
	IPAddress  string    `gorm:"size:64" json:"ip_address"`
	Payload    string    `gorm:"type:text" json:"payload"`
}

type DeviceStatusHistory struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	DeviceID    string    `gorm:"index;size:64;not null" json:"device_id"`
	OldStatus   DeviceStatus `gorm:"size:16" json:"old_status"`
	NewStatus   DeviceStatus `gorm:"size:16" json:"new_status"`
	Reason      string    `gorm:"size:128" json:"reason"`
	Timestamp   time.Time `gorm:"index;not null" json:"timestamp"`
}
