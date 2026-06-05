package utils

import (
	"fmt"
	"log-pipeline/internal/config"
	"log-pipeline/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() error {
	var dialector gorm.Dialector

	switch config.AppConfig.Database.Driver {
	case "sqlite":
		dialector = sqlite.Open(config.AppConfig.Database.DSN)
	default:
		return fmt.Errorf("unsupported database driver: %s", config.AppConfig.Database.Driver)
	}

	logLevel := logger.Info
	if config.AppConfig.Server.Mode == "release" {
		logLevel = logger.Warn
	}

	var err error
	DB, err = gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("get sql DB: %w", err)
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	if err := DB.AutoMigrate(
		&models.Datasource{},
		&models.Pipeline{},
		&models.AlertRule{},
		&models.AlertHistory{},
		&models.AggregationRule{},
	); err != nil {
		return fmt.Errorf("auto migrate: %w", err)
	}

	return nil
}
