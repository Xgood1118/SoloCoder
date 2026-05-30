package command

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/device-manager/internal/device"
	"github.com/device-manager/internal/model"
	"github.com/device-manager/pkg/cache"
	"github.com/device-manager/pkg/database"
	"github.com/device-manager/pkg/event"
	"github.com/google/uuid"
)

type SendCommandRequest struct {
	DeviceID       string            `json:"device_id"`
	CommandType    string            `json:"command_type"`
	Mode           model.CommandMode `json:"mode"`
	Payload        string            `json:"payload"`
	TimeoutSeconds int               `json:"timeout_seconds"`
	RequestID      string            `json:"request_id"`
}

type CommandResult struct {
	CommandID string             `json:"command_id"`
	Status    model.CommandStatus `json:"status"`
	Response  string             `json:"response"`
}

var (
	pendingCommands = make(map[string]chan *model.DeviceCommand)
	pendingMutex    sync.RWMutex
)

func generateCommandID() string {
	return "cmd_" + strings.ReplaceAll(uuid.New().String(), "-", "")
}

func checkIdempotency(deviceID, requestID string) (*model.DeviceCommand, error) {
	var mapping model.CommandIDMapping
	err := database.DB.Where("device_id = ? AND request_id = ?", deviceID, requestID).First(&mapping).Error
	if err == nil {
		var command model.DeviceCommand
		if err := database.DB.Where("command_id = ?", mapping.CommandID).First(&command).Error; err == nil {
			return &command, nil
		}
	}
	return nil, nil
}

func checkCompatibility(deviceType, firmwareVersion, commandType string) (bool, string, error) {
	var compat model.CommandVersionCompatibility
	err := database.DB.Where("command_type = ?", commandType).First(&compat).Error
	if err != nil {
		return true, "", nil
	}

	if firmwareVersion >= compat.MinVersion && (compat.MaxVersion == "" || firmwareVersion <= compat.MaxVersion) {
		return true, "", nil
	}

	return false, compat.UpgradePath, nil
}

func SendCommand(req *SendCommandRequest) (*CommandResult, error) {
	if req.RequestID != "" {
		existing, err := checkIdempotency(req.DeviceID, req.RequestID)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return &CommandResult{
				CommandID: existing.CommandID,
				Status:    existing.Status,
				Response:  existing.Response,
			}, nil
		}
	}

	d, err := device.GetDeviceByID(req.DeviceID)
	if err != nil {
		return nil, err
	}

	if d.Status != model.DeviceStatusOnline {
		return nil, errors.New("device is offline")
	}

	compatible, upgradePath, err := checkCompatibility(d.DeviceType, d.FirmwareVersion, req.CommandType)
	if err != nil {
		return nil, err
	}
	if !compatible {
		return nil, fmt.Errorf("command not compatible with current firmware version %s, upgrade path: %s", d.FirmwareVersion, upgradePath)
	}

	commandID := generateCommandID()
	now := time.Now()
	timeout := req.TimeoutSeconds
	if timeout <= 0 {
		timeout = 30
	}

	command := &model.DeviceCommand{
		CommandID:      commandID,
		DeviceID:       req.DeviceID,
		CommandType:    req.CommandType,
		Mode:           req.Mode,
		Status:         model.CommandStatusPending,
		Payload:        req.Payload,
		TimeoutSeconds: timeout,
		CreatedAt:      now,
	}

	if err := database.DB.Create(command).Error; err != nil {
		return nil, err
	}

	if req.RequestID != "" {
		mapping := &model.CommandIDMapping{
			DeviceID:  req.DeviceID,
			RequestID: req.RequestID,
			CommandID: commandID,
			CreatedAt: now,
		}
		database.DB.Create(mapping)
	}

	cache.SetPendingCommand(command)

	if req.Mode == model.CommandModeSync {
		resultChan := make(chan *model.DeviceCommand, 1)
		pendingMutex.Lock()
		pendingCommands[commandID] = resultChan
		pendingMutex.Unlock()

		select {
		case result := <-resultChan:
			pendingMutex.Lock()
			delete(pendingCommands, commandID)
			pendingMutex.Unlock()
			close(resultChan)

			return &CommandResult{
				CommandID: result.CommandID,
				Status:    result.Status,
				Response:  result.Response,
			}, nil
		case <-time.After(time.Duration(timeout) * time.Second):
			pendingMutex.Lock()
			delete(pendingCommands, commandID)
			pendingMutex.Unlock()
			close(resultChan)

			command.Status = model.CommandStatusTimeout
			database.DB.Save(command)
			return &CommandResult{
				CommandID: commandID,
				Status:    model.CommandStatusTimeout,
			}, errors.New("command timeout")
		}
	}

	return &CommandResult{
		CommandID: commandID,
		Status:    model.CommandStatusPending,
	}, nil
}

func GetCommandForDevice(deviceID string) (*model.DeviceCommand, error) {
	cmd, err := cache.GetPendingCommand(deviceID)
	if err != nil {
		return nil, nil
	}
	return cmd, nil
}

func UpdateCommandStatus(commandID string, status model.CommandStatus, response string) error {
	var command model.DeviceCommand
	if err := database.DB.Where("command_id = ?", commandID).First(&command).Error; err != nil {
		return err
	}

	command.Status = status
	command.Response = response
	now := time.Now()

	switch status {
	case model.CommandStatusSent:
		command.SentAt = &now
	case model.CommandStatusExecuting:
		command.ExecutedAt = &now
	case model.CommandStatusSuccess, model.CommandStatusFailed, model.CommandStatusTimeout:
		command.CompletedAt = &now
	}

	if err := database.DB.Save(&command).Error; err != nil {
		return err
	}

	if status == model.CommandStatusSuccess || status == model.CommandStatusFailed {
		pendingMutex.RLock()
		if ch, ok := pendingCommands[commandID]; ok {
			ch <- &command
		}
		pendingMutex.RUnlock()

		if status == model.CommandStatusSuccess {
			event.Publish(event.NewEvent(event.EventTypeCommandSuccess, command.DeviceID, map[string]interface{}{
				"command_id":   commandID,
				"command_type": command.CommandType,
				"response":     response,
			}))
		} else {
			event.Publish(event.NewEvent(event.EventTypeCommandFailed, command.DeviceID, map[string]interface{}{
				"command_id":   commandID,
				"command_type": command.CommandType,
				"error":        response,
			}))
		}
	}

	return nil
}

func GetCommand(commandID string) (*model.DeviceCommand, error) {
	var command model.DeviceCommand
	err := database.DB.Where("command_id = ?", commandID).First(&command).Error
	return &command, err
}

func ListDeviceCommands(deviceID string, page, pageSize int) ([]model.DeviceCommand, int64, error) {
	var commands []model.DeviceCommand
	var total int64

	query := database.DB.Model(&model.DeviceCommand{}).Where("device_id = ?", deviceID)
	query.Count(&total)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&commands).Error
	return commands, total, err
}

func ParsePayload(payload string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := json.Unmarshal([]byte(payload), &result)
	return result, err
}
