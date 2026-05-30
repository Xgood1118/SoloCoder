package command

import (
	"net/http"
	"strconv"

	"github.com/device-manager/internal/model"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		commands := api.Group("/commands")
		{
			commands.POST("", SendCommandHandler)
			commands.GET("/:command_id", GetCommandHandler)
			commands.GET("", ListCommandsHandler)
			commands.PUT("/:command_id/status", UpdateStatusHandler)
		}

		deviceCommands := api.Group("/devices/:device_id/commands")
		{
			deviceCommands.GET("", ListDeviceCommandsHandler)
			deviceCommands.GET("/pending", GetPendingCommandHandler)
		}
	}
}

func SendCommandHandler(c *gin.Context) {
	var req SendCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Mode == "" {
		req.Mode = model.CommandModeAsync
	}

	result, err := SendCommand(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func GetCommandHandler(c *gin.Context) {
	commandID := c.Param("command_id")
	command, err := GetCommand(commandID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "command not found"})
		return
	}
	c.JSON(http.StatusOK, command)
}

func ListCommandsHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "use /devices/:device_id/commands to list commands"})
}

func ListDeviceCommandsHandler(c *gin.Context) {
	deviceID := c.Param("device_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	commands, total, err := ListDeviceCommands(deviceID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total":    total,
		"commands": commands,
	})
}

func GetPendingCommandHandler(c *gin.Context) {
	deviceID := c.Param("device_id")
	command, err := GetCommandForDevice(deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if command == nil {
		c.JSON(http.StatusOK, gin.H{"message": "no pending commands"})
		return
	}
	c.JSON(http.StatusOK, command)
}

func UpdateStatusHandler(c *gin.Context) {
	commandID := c.Param("command_id")
	var body struct {
		Status   model.CommandStatus `json:"status" binding:"required"`
		Response string              `json:"response"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := UpdateCommandStatus(commandID, body.Status, body.Response); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "status updated"})
}
