package device

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/device-manager/internal/model"
	"github.com/device-manager/pkg/cache"
	"github.com/device-manager/pkg/database"
	"github.com/device-manager/pkg/event"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RegisterRequest struct {
	MacAddress   string `json:"mac_address"`
	SerialNumber string `json:"serial_number"`
	ChipID       string `json:"chip_id"`
	BoardSerial  string `json:"board_serial"`
	Name         string `json:"name"`
	DeviceType   string `json:"device_type"`
	FirmwareVersion string `json:"firmware_version"`
	IPAddress    string `json:"ip_address"`
	Location     string `json:"location"`
	Region       string `json:"region"`
	Metadata     string `json:"metadata"`
}

type DeviceQuery struct {
	DeviceID   string `form:"device_id"`
	DeviceType string `form:"device_type"`
	Status     string `form:"status"`
	GroupID    uint   `form:"group_id"`
	Region     string `form:"region"`
	Owner      string `form:"owner"`
	Tags       string `form:"tags"`
	Page       int    `form:"page"`
	PageSize   int    `form:"page_size"`
}

type DeviceListResult struct {
	Total   int64          `json:"total"`
	Devices []model.Device `json:"devices"`
}

func getIdentifier(req *RegisterRequest) (string, string) {
	if req.MacAddress != "" {
		return strings.ToLower(req.MacAddress), "mac"
	}
	if req.SerialNumber != "" {
		return req.SerialNumber, "serial"
	}
	if req.ChipID != "" {
		return req.ChipID, "chip_id"
	}
	if req.BoardSerial != "" {
		return req.BoardSerial, "board_serial"
	}
	return "", ""
}

func CheckWhitelist(identifier, idType string) (bool, error) {
	var whitelist model.DeviceWhitelist
	err := database.DB.Where("identifier = ? AND id_type = ?", identifier, idType).First(&whitelist).Error
	if err == gorm.ErrRecordNotFound {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return whitelist.Allowed, nil
}

func RegisterDevice(req *RegisterRequest) (*model.Device, error) {
	identifier, idType := getIdentifier(req)
	if identifier == "" {
		return nil, errors.New("no device identifier provided")
	}

	allowed, err := CheckWhitelist(identifier, idType)
	if err != nil {
		return nil, fmt.Errorf("whitelist check failed: %w", err)
	}
	if !allowed {
		return nil, errors.New("device not in whitelist, registration denied")
	}

	var existingDevice model.Device
	query := database.DB
	switch idType {
	case "mac":
		query = query.Where("mac_address = ?", req.MacAddress)
	case "serial":
		query = query.Where("serial_number = ?", req.SerialNumber)
	case "chip_id":
		query = query.Where("chip_id = ?", req.ChipID)
	case "board_serial":
		query = query.Where("board_serial = ?", req.BoardSerial)
	}
	err = query.First(&existingDevice).Error
	if err == nil {
		return &existingDevice, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	deviceID := generateDeviceID()
	now := time.Now()
	device := &model.Device{
		DeviceID:        deviceID,
		MacAddress:      strings.ToLower(req.MacAddress),
		SerialNumber:    req.SerialNumber,
		ChipID:          req.ChipID,
		BoardSerial:     req.BoardSerial,
		Name:            req.Name,
		Status:          model.DeviceStatusOffline,
		DeviceType:      req.DeviceType,
		FirmwareVersion: req.FirmwareVersion,
		IPAddress:       req.IPAddress,
		Location:        req.Location,
		Region:          req.Region,
		Metadata:        req.Metadata,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := database.DB.Create(device).Error; err != nil {
		return nil, err
	}

	cache.SetDeviceInfo(device, 24*time.Hour)
	event.Publish(event.NewEvent(event.EventTypeDeviceRegistered, deviceID, device))

	return device, nil
}

func generateDeviceID() string {
	return "dev_" + strings.ReplaceAll(uuid.New().String(), "-", "")
}

func GetDeviceByID(deviceID string) (*model.Device, error) {
	device, err := cache.GetDeviceInfo(deviceID)
	if err == nil {
		return device, nil
	}

	var dbDevice model.Device
	if err := database.DB.Where("device_id = ?", deviceID).First(&dbDevice).Error; err != nil {
		return nil, err
	}

	cache.SetDeviceInfo(&dbDevice, 24*time.Hour)
	return &dbDevice, nil
}

func ListDevices(query DeviceQuery) (*DeviceListResult, error) {
	db := database.DB.Model(&model.Device{})

	if query.DeviceID != "" {
		db = db.Where("device_id LIKE ?", "%"+query.DeviceID+"%")
	}
	if query.DeviceType != "" {
		db = db.Where("device_type = ?", query.DeviceType)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.GroupID > 0 {
		db = db.Where("group_id = ?", query.GroupID)
	}
	if query.Region != "" {
		db = db.Where("region = ?", query.Region)
	}
	if query.Owner != "" {
		db = db.Where("owner = ?", query.Owner)
	}
	if query.Tags != "" {
		db = db.Where("tags LIKE ?", "%"+query.Tags+"%")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var devices []model.Device
	offset := (page - 1) * pageSize
	if err := db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&devices).Error; err != nil {
		return nil, err
	}

	return &DeviceListResult{
		Total:   total,
		Devices: devices,
	}, nil
}

func UpdateDevice(deviceID string, updates map[string]interface{}) (*model.Device, error) {
	if err := database.DB.Model(&model.Device{}).Where("device_id = ?", deviceID).Updates(updates).Error; err != nil {
		return nil, err
	}
	cache.DeleteDeviceInfo(deviceID)
	return GetDeviceByID(deviceID)
}

func DeleteDevice(deviceID string) error {
	if err := database.DB.Where("device_id = ?", deviceID).Delete(&model.Device{}).Error; err != nil {
		return err
	}
	cache.DeleteDeviceInfo(deviceID)
	event.Publish(event.NewEvent(event.EventTypeDeviceDeleted, deviceID, nil))
	return nil
}

func AddToWhitelist(identifier, idType, deviceType, description string) error {
	whitelist := &model.DeviceWhitelist{
		Identifier:  identifier,
		IDType:      idType,
		DeviceType:  deviceType,
		Allowed:     true,
		Description: description,
		CreatedAt:   time.Now(),
	}
	return database.DB.Create(whitelist).Error
}

func SetDeviceTags(deviceID string, tags map[string]string) error {
	tagsStr := ""
	for k, v := range tags {
		if tagsStr != "" {
			tagsStr += ","
		}
		tagsStr += fmt.Sprintf("%s:%s", k, v)
	}
	_, err := UpdateDevice(deviceID, map[string]interface{}{"tags": tagsStr})
	return err
}

func SetDeviceGroup(deviceID string, groupID uint) error {
	_, err := UpdateDevice(deviceID, map[string]interface{}{"group_id": groupID})
	return err
}
