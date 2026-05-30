package firmware

import (
	"net/http"
	"strconv"

	"github.com/device-manager/internal/model"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		firmware := api.Group("/firmware")
		{
			firmware.POST("", CreateFirmwareHandler)
			firmware.GET("", ListFirmwareHandler)
			firmware.GET("/:firmware_id", GetFirmwareHandler)
			firmware.PUT("/:firmware_id/status", UpdateStatusHandler)
			firmware.POST("/check-compatibility", CheckCompatibilityHandler)
		}

		upgradeJobs := api.Group("/upgrade-jobs")
		{
			upgradeJobs.POST("", CreateUpgradeJobHandler)
			upgradeJobs.GET("/:job_id", GetUpgradeJobHandler)
			upgradeJobs.PUT("/:job_id/progress", UpdateProgressHandler)
		}

		deviceUpgrades := api.Group("/devices/:device_id/upgrades")
		{
			deviceUpgrades.GET("", GetDeviceUpgradesHandler)
		}
	}
}

func CreateFirmwareHandler(c *gin.Context) {
	var body struct {
		Version      string `json:"version" binding:"required"`
		DeviceType   string `json:"device_type" binding:"required"`
		Name         string `json:"name" binding:"required"`
		Description  string `json:"description"`
		FileURL      string `json:"file_url" binding:"required"`
		FileSize     int64  `json:"file_size"`
		Checksum     string `json:"checksum"`
		ChecksumType string `json:"checksum_type"`
		MinVersion   string `json:"min_version"`
		MaxVersion   string `json:"max_version"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	firmware, err := CreateFirmware(
		body.Version, body.DeviceType, body.Name, body.Description,
		body.FileURL, body.Checksum, body.ChecksumType, body.FileSize,
		body.MinVersion, body.MaxVersion,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, firmware)
}

func ListFirmwareHandler(c *gin.Context) {
	deviceType := c.Query("device_type")
	status := model.FirmwareStatus(c.Query("status"))

	firmwares, err := ListFirmware(deviceType, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, firmwares)
}

func GetFirmwareHandler(c *gin.Context) {
	firmwareID := c.Param("firmware_id")
	firmware, err := GetFirmware(firmwareID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "firmware not found"})
		return
	}
	c.JSON(http.StatusOK, firmware)
}

func UpdateStatusHandler(c *gin.Context) {
	firmwareID := c.Param("firmware_id")
	var body struct {
		Status model.FirmwareStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := UpdateFirmwareStatus(firmwareID, body.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "status updated"})
}

func CheckCompatibilityHandler(c *gin.Context) {
	var body struct {
		DeviceType     string `json:"device_type" binding:"required"`
		CurrentVersion string `json:"current_version" binding:"required"`
		TargetVersion  string `json:"target_version" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	compatible, message, err := CheckUpgradeCompatibility(body.DeviceType, body.CurrentVersion, body.TargetVersion)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"compatible": compatible,
		"message":    message,
	})
}

func CreateUpgradeJobHandler(c *gin.Context) {
	var body struct {
		FirmwareID string   `json:"firmware_id" binding:"required"`
		DeviceType string   `json:"device_type" binding:"required"`
		DeviceIDs  []string `json:"device_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	job, err := CreateUpgradeJob(body.FirmwareID, body.DeviceType, body.DeviceIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, job)
}

func GetUpgradeJobHandler(c *gin.Context) {
	jobID := c.Param("job_id")
	job, err := GetUpgradeJob(jobID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}
	c.JSON(http.StatusOK, job)
}

func UpdateProgressHandler(c *gin.Context) {
	jobID := c.Param("job_id")
	var body struct {
		DeviceID   string              `json:"device_id" binding:"required"`
		Status     model.UpgradeStatus `json:"status" binding:"required"`
		Progress   int                 `json:"progress"`
		ErrorMsg   string              `json:"error_message"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := UpdateUpgradeProgress(body.DeviceID, jobID, body.Status, body.Progress, body.ErrorMsg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "progress updated"})
}

func GetDeviceUpgradesHandler(c *gin.Context) {
	deviceID := c.Param("device_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	records, err := GetDeviceUpgradeRecords(deviceID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, records)
}
