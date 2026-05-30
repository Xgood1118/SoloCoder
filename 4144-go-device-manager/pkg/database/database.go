package database

import (
	"github.com/device-manager/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init(dsn string) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}
	return migrate()
}

func migrate() error {
	return DB.AutoMigrate(
		&model.Device{},
		&model.DeviceWhitelist{},
		&model.DeviceGroup{},
		&model.DeviceTag{},
		&model.HeartbeatRecord{},
		&model.DeviceStatusHistory{},
		&model.DeviceCommand{},
		&model.CommandIDMapping{},
		&model.CommandVersionCompatibility{},
		&model.AlertRule{},
		&model.AlertRecord{},
		&model.Firmware{},
		&model.FirmwareUpgradeJob{},
		&model.DeviceUpgradeRecord{},
	)
}

func GetDB() *gorm.DB {
	return DB
}
