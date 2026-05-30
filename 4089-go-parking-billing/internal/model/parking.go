package model

import (
	"time"

	"gorm.io/gorm"
)

type ParkingZone struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	Name       string         `gorm:"size:50;not null" json:"name"`
	Code       string         `gorm:"size:20;uniqueIndex;not null" json:"code"`
	TotalSpots int            `gorm:"not null;default:0" json:"total_spots"`
	FixedSpots int            `gorm:"not null;default:0" json:"fixed_spots"`
	TempSpots  int            `gorm:"not null;default:0" json:"temp_spots"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

type ParkingSpot struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	ZoneID     uint           `gorm:"index;not null" json:"zone_id"`
	SpotNumber string         `gorm:"size:20;not null" json:"spot_number"`
	SpotType   string         `gorm:"size:20;not null;default:'temp'" json:"spot_type"`
	Status     string         `gorm:"size:20;not null;default:'available'" json:"status"`
	Zone       ParkingZone    `gorm:"foreignKey:ZoneID" json:"zone,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

type VehicleEntry struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	PlateNumber  string         `gorm:"size:20;index;not null" json:"plate_number"`
	PlateType    string         `gorm:"size:20;not null;default:'regular'" json:"plate_type"`
	EntryTime    time.Time      `gorm:"not null" json:"entry_time"`
	EntryChannel string         `gorm:"size:50" json:"entry_channel"`
	FixedSpotID  *uint          `json:"fixed_spot_id"`
	FixedSpot    *ParkingSpot   `gorm:"foreignKey:FixedSpotID" json:"fixed_spot,omitempty"`
	ExitTime     *time.Time     `json:"exit_time"`
	ExitChannel  string         `gorm:"size:50" json:"exit_channel"`
	Status       string         `gorm:"size:20;not null;default:'parked'" json:"status"`
	QRCode       string         `gorm:"size:200" json:"qr_code"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type ParkingScreen struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	ZoneID    uint           `gorm:"index;not null" json:"zone_id"`
	Location  string         `gorm:"size:100" json:"location"`
	Content   string         `gorm:"type:text" json:"content"`
	Zone      ParkingZone    `gorm:"foreignKey:ZoneID" json:"zone,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
