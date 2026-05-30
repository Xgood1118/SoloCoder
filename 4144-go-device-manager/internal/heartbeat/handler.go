package heartbeat

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		devices := api.Group("/devices")
		{
			devices.POST("/:device_id/heartbeat", HeartbeatHandler)
			devices.GET("/:device_id/history", StatusHistoryHandler)
		}
	}
}

type HeartbeatRequest struct {
	Payload string `json:"payload"`
}

func HeartbeatHandler(c *gin.Context) {
	deviceID := c.Param("device_id")
	ipAddress := c.ClientIP()

	var req HeartbeatRequest
	c.ShouldBindJSON(&req)

	if err := ProcessHeartbeat(deviceID, ipAddress, req.Payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "heartbeat received"})
}

func StatusHistoryHandler(c *gin.Context) {
	deviceID := c.Param("device_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	history, err := GetDeviceStatusHistory(deviceID, nil, nil, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, history)
}
