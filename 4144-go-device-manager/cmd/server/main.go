package main

import (
	"log"

	"github.com/device-manager/internal/alert"
	"github.com/device-manager/internal/command"
	"github.com/device-manager/internal/device"
	"github.com/device-manager/internal/firmware"
	"github.com/device-manager/internal/heartbeat"
	"github.com/device-manager/pkg/cache"
	"github.com/device-manager/pkg/database"
	"github.com/device-manager/pkg/event"
	"github.com/device-manager/pkg/middleware"
	"github.com/gin-gonic/gin"
)

func main() {
	if err := database.Init("device_manager.db"); err != nil {
		log.Printf("Warning: Failed to init database: %v", err)
		log.Println("Continuing without database persistence...")
	}
	log.Println("Database initialized successfully")

	if err := cache.Init("localhost:6379", "", 0); err != nil {
		log.Printf("Warning: Failed to init Redis: %v", err)
		log.Println("Continuing without cache...")
	} else {
		log.Println("Redis cache initialized successfully")
	}

	event.Subscribe(event.EventTypeDeviceOnline, func(e event.Event) {
		log.Printf("[EVENT] Device %s is now online", e.DeviceID)
	})
	event.Subscribe(event.EventTypeDeviceOffline, func(e event.Event) {
		log.Printf("[EVENT] Device %s is now offline", e.DeviceID)
	})
	event.Subscribe(event.EventTypeCommandSuccess, func(e event.Event) {
		log.Printf("[EVENT] Command success for device %s", e.DeviceID)
	})
	event.Subscribe(event.EventTypeAlertTriggered, func(e event.Event) {
		log.Printf("[EVENT] Alert triggered for device %s: %+v", e.DeviceID, e.Data)
	})

	hm := heartbeat.GetManager(120, 10)
	hm.Start()
	log.Println("Heartbeat manager started")

	r := gin.Default()
	r.Use(middleware.Logger())
	r.Use(middleware.CORS())

	device.RegisterRoutes(r)
	heartbeat.RegisterRoutes(r)
	command.RegisterRoutes(r)
	alert.RegisterRoutes(r)
	firmware.RegisterRoutes(r)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	log.Println("Server starting on :8080")
	log.Println("API Endpoints:")
	log.Println("  POST   /api/v1/devices/register     - Register new device")
	log.Println("  GET    /api/v1/devices              - List devices")
	log.Println("  GET    /api/v1/devices/:id          - Get device")
	log.Println("  POST   /api/v1/devices/:id/heartbeat - Send heartbeat")
	log.Println("  POST   /api/v1/commands             - Send command")
	log.Println("  GET    /api/v1/alerts               - List alerts")
	log.Println("  GET    /api/v1/firmware             - List firmware")

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
