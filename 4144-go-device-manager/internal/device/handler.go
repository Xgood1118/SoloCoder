package device

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		devices := api.Group("/devices")
		{
			devices.POST("/register", RegisterHandler)
			devices.GET("", ListHandler)
			devices.GET("/:device_id", GetHandler)
			devices.PUT("/:device_id", UpdateHandler)
			devices.DELETE("/:device_id", DeleteHandler)
			devices.POST("/:device_id/tags", SetTagsHandler)
			devices.PUT("/:device_id/group", SetGroupHandler)
		}

		whitelist := api.Group("/whitelist")
		{
			whitelist.POST("", AddWhitelistHandler)
		}
	}
}

func RegisterHandler(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	device, err := RegisterDevice(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, device)
}

func ListHandler(c *gin.Context) {
	var query DeviceQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := ListDevices(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func GetHandler(c *gin.Context) {
	deviceID := c.Param("device_id")
	device, err := GetDeviceByID(deviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		return
	}
	c.JSON(http.StatusOK, device)
}

func UpdateHandler(c *gin.Context) {
	deviceID := c.Param("device_id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	device, err := UpdateDevice(deviceID, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, device)
}

func DeleteHandler(c *gin.Context) {
	deviceID := c.Param("device_id")
	if err := DeleteDevice(deviceID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "device deleted"})
}

func SetTagsHandler(c *gin.Context) {
	deviceID := c.Param("device_id")
	var tags map[string]string
	if err := c.ShouldBindJSON(&tags); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := SetDeviceTags(deviceID, tags); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "tags updated"})
}

func SetGroupHandler(c *gin.Context) {
	deviceID := c.Param("device_id")
	var body struct {
		GroupID uint `json:"group_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := SetDeviceGroup(deviceID, body.GroupID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "group updated"})
}

func AddWhitelistHandler(c *gin.Context) {
	var body struct {
		Identifier  string `json:"identifier" binding:"required"`
		IDType      string `json:"id_type" binding:"required"`
		DeviceType  string `json:"device_type"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := AddToWhitelist(body.Identifier, body.IDType, body.DeviceType, body.Description); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "added to whitelist"})
}
