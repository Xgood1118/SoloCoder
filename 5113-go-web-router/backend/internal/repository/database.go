package repository

import (
	"github.com/purchase-workflow/internal/config"
	"github.com/purchase-workflow/internal/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() error {
	dsn := config.AppConfig.Database.GetDSN()
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}

	DB = db

	err = DB.AutoMigrate(
		&model.User{},
		&model.Department{},
		&model.WorkflowDefinition{},
		&model.WorkflowNode{},
		&model.WorkflowCondition{},
		&model.WorkflowEdge{},
		&model.PurchaseApplication{},
		&model.PurchaseItem{},
		&model.ApprovalTask{},
		&model.ApprovalHistory{},
		&model.TimeoutMonitor{},
	)
	if err != nil {
		return err
	}

	return nil
}

func GetDB() *gorm.DB {
	return DB
}
