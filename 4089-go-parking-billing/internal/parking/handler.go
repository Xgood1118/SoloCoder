package parking

import (
	"net/http"
	"time"

	"parking-billing/internal/model"
	"parking-billing/pkg/database"
	"parking-billing/pkg/util"

	"github.com/gin-gonic/gin"
)

type EntryRequest struct {
	PlateNumber  string `json:"plate_number" binding:"required"`
	EntryChannel string `json:"entry_channel"`
	FixedSpotID  *uint  `json:"fixed_spot_id"`
}

type ExitRequest struct {
	PlateNumber string `json:"plate_number" binding:"required"`
	ExitChannel string `json:"exit_channel"`
}

func Entry(c *gin.Context) {
	var req EntryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !util.ValidatePlate(req.PlateNumber) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid plate number"})
		return
	}

	var existing model.VehicleEntry
	if err := database.DB.Where("plate_number = ? AND status = ?", req.PlateNumber, "parked").First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "vehicle already parked"})
		return
	}

	plateType := util.PlateType(req.PlateNumber)
	now := time.Now()

	entry := model.VehicleEntry{
		PlateNumber:  req.PlateNumber,
		PlateType:    plateType,
		EntryTime:    now,
		EntryChannel: req.EntryChannel,
		FixedSpotID:  req.FixedSpotID,
		Status:       "parked",
		QRCode:        req.PlateNumber + ":" + now.Format("20060102150405"),
	}

	if req.FixedSpotID != nil {
		var spot model.ParkingSpot
		if err := database.DB.First(&spot, *req.FixedSpotID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "spot not found"})
			return
		}
		if spot.Status != "available" {
			c.JSON(http.StatusConflict, gin.H{"error": "spot not available"})
			return
		}
		database.DB.Model(&spot).Update("status", "occupied")
	}

	if err := database.DB.Create(&entry).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"entry_id":     entry.ID,
		"plate_number": entry.PlateNumber,
		"plate_type":   entry.PlateType,
		"entry_time":   entry.EntryTime,
		"qr_code":      entry.QRCode,
	})
}

func Exit(c *gin.Context) {
	var req ExitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var entry model.VehicleEntry
	if err := database.DB.Where("plate_number = ? AND status = ?", req.PlateNumber, "parked").First(&entry).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "vehicle not found or already exited"})
		return
	}

	now := time.Now()
	entry.ExitTime = &now
	entry.ExitChannel = req.ExitChannel
	entry.Status = "exited"
	database.DB.Save(&entry)

	if entry.FixedSpotID != nil {
		database.DB.Model(&model.ParkingSpot{}).Where("id = ?", *entry.FixedSpotID).Update("status", "available")
	}

	c.JSON(http.StatusOK, gin.H{
		"entry_id":         entry.ID,
		"plate_number":     entry.PlateNumber,
		"entry_time":       entry.EntryTime,
		"exit_time":        entry.ExitTime,
		"duration_minutes": int(now.Sub(entry.EntryTime).Minutes()),
		"status":           entry.Status,
	})
}

func GetEntry(c *gin.Context) {
	entryID := c.Param("id")
	var entry model.VehicleEntry
	if err := database.DB.First(&entry, entryID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "entry not found"})
		return
	}
	c.JSON(http.StatusOK, entry)
}

func GetEntryByPlate(c *gin.Context) {
	plate := c.Param("plate_number")
	var entries []model.VehicleEntry
	database.DB.Where("plate_number = ?", plate).Order("entry_time DESC").Limit(10).Find(&entries)
	c.JSON(http.StatusOK, entries)
}

func GetEntryByQR(c *gin.Context) {
	qrCode := c.Param("qr_code")
	var entry model.VehicleEntry
	if err := database.DB.Where("qr_code = ?", qrCode).First(&entry).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "entry not found"})
		return
	}
	c.JSON(http.StatusOK, entry)
}

func GetAvailableSpots(c *gin.Context) {
	zoneID := c.Query("zone_id")
	var spots []model.ParkingSpot
	query := database.DB.Where("status = ?", "available")
	if zoneID != "" {
		query = query.Where("zone_id = ?", zoneID)
	}
	if err := query.Find(&spots).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"available_spots": len(spots), "spots": spots})
}

func GetZoneStatus(c *gin.Context) {
	var zones []model.ParkingZone
	database.DB.Find(&zones)

	type ZoneStatus struct {
		Zone          model.ParkingZone `json:"zone"`
		Available     int64         `json:"available"`
		Occupied      int64         `json:"occupied"`
		OccupancyRate float64     `json:"occupancy_rate"`
	}

	var result []ZoneStatus
	for _, zone := range zones {
		var available, occupied int64
		database.DB.Model(&model.ParkingSpot{}).Where("zone_id = ? AND status = ?", zone.ID, "available").Count(&available)
		database.DB.Model(&model.ParkingSpot{}).Where("zone_id = ? AND status = ?", zone.ID, "occupied").Count(&occupied)
		total := available + occupied
		rate := float64(0)
		if total > 0 {
			rate = float64(occupied) / float64(total) * 100
		}
		result = append(result, ZoneStatus{
			Zone:          zone,
			Available:     available,
			Occupied:      occupied,
			OccupancyRate: rate,
		})
	}
	c.JSON(http.StatusOK, result)
}

func CreateZone(c *gin.Context) {
	var zone model.ParkingZone
	if err := c.ShouldBindJSON(&zone); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&zone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, zone)
}

func CreateSpot(c *gin.Context) {
	var spot model.ParkingSpot
	if err := c.ShouldBindJSON(&spot); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&spot).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, spot)
}

func UpdateScreen(c *gin.Context) {
	screenID := c.Param("id")
	var screen model.ParkingScreen
	if err := database.DB.First(&screen, screenID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "screen not found"})
		return
	}
	var req struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	screen.Content = req.Content
	database.DB.Save(&screen)
	c.JSON(http.StatusOK, screen)
}

func CreateScreen(c *gin.Context) {
	var screen model.ParkingScreen
	if err := c.ShouldBindJSON(&screen); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&screen).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, screen)
}

func ListScreens(c *gin.Context) {
	var screens []model.ParkingScreen
	database.DB.Find(&screens)
	c.JSON(http.StatusOK, screens)
}
