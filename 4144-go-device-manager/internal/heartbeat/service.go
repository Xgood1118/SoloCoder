package heartbeat

import (
	"log"
	"sync"
	"time"

	"github.com/device-manager/internal/model"
	"github.com/device-manager/pkg/cache"
	"github.com/device-manager/pkg/database"
	"github.com/device-manager/pkg/event"
)

type HeartbeatManager struct {
	timeoutSeconds int
	checkInterval  time.Duration
	stopChan       chan struct{}
	once           sync.Once
}

var (
	manager *HeartbeatManager
	once    sync.Once
)

func GetManager(timeoutSeconds int, checkIntervalSeconds int) *HeartbeatManager {
	once.Do(func() {
		manager = &HeartbeatManager{
			timeoutSeconds: timeoutSeconds,
			checkInterval:  time.Duration(checkIntervalSeconds) * time.Second,
			stopChan:       make(chan struct{}),
		}
	})
	return manager
}

func (hm *HeartbeatManager) Start() {
	hm.once.Do(func() {
		go hm.checkOfflineDevices()
	})
}

func (hm *HeartbeatManager) Stop() {
	close(hm.stopChan)
}

func (hm *HeartbeatManager) checkOfflineDevices() {
	ticker := time.NewTicker(hm.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			hm.scanAndMarkOffline()
		case <-hm.stopChan:
			return
		}
	}
}

func (hm *HeartbeatManager) scanAndMarkOffline() {
	var devices []model.Device
	threshold := time.Now().Add(-time.Duration(hm.timeoutSeconds) * time.Second)

	database.DB.Where("status = ? AND (last_heartbeat IS NULL OR last_heartbeat < ?)",
		model.DeviceStatusOnline, threshold).Find(&devices)

	for _, d := range devices {
		if err := hm.markDeviceOffline(&d, "heartbeat_timeout"); err != nil {
			log.Printf("Failed to mark device %s offline: %v", d.DeviceID, err)
		}
	}
}

func (hm *HeartbeatManager) markDeviceOffline(d *model.Device, reason string) error {
	oldStatus := d.Status

	d.Status = model.DeviceStatusOffline
	now := time.Now()
	d.UpdatedAt = now

	if err := database.DB.Save(d).Error; err != nil {
		return err
	}

	cache.SetDeviceStatus(d.DeviceID, model.DeviceStatusOffline, 0)
	cache.DeleteDeviceInfo(d.DeviceID)

	history := &model.DeviceStatusHistory{
		DeviceID:  d.DeviceID,
		OldStatus: oldStatus,
		NewStatus: model.DeviceStatusOffline,
		Reason:    reason,
		Timestamp: now,
	}
	database.DB.Create(history)

	event.Publish(event.NewEvent(event.EventTypeDeviceOffline, d.DeviceID, map[string]interface{}{
		"reason": reason,
		"time":   now,
	}))

	return nil
}

func getDeviceByID(deviceID string) (*model.Device, error) {
	d, err := cache.GetDeviceInfo(deviceID)
	if err == nil {
		return d, nil
	}
	var dbDevice model.Device
	if err := database.DB.Where("device_id = ?", deviceID).First(&dbDevice).Error; err != nil {
		return nil, err
	}
	cache.SetDeviceInfo(&dbDevice, 24*time.Hour)
	return &dbDevice, nil
}

func ProcessHeartbeat(deviceID string, ipAddress string, payload string) error {
	d, err := getDeviceByID(deviceID)
	if err != nil {
		return err
	}

	now := time.Now()
	wasOffline := d.Status == model.DeviceStatusOffline

	record := &model.HeartbeatRecord{
		DeviceID:  deviceID,
		Timestamp: now,
		IPAddress: ipAddress,
		Payload:   payload,
	}
	database.DB.Create(record)

	cache.SetDeviceHeartbeat(deviceID, now)

	d.LastHeartbeat = &now
	d.LastOnline = &now
	d.IPAddress = ipAddress
	d.UpdatedAt = now

	if wasOffline {
		d.Status = model.DeviceStatusOnline
		cache.SetDeviceStatus(deviceID, model.DeviceStatusOnline, 0)

		history := &model.DeviceStatusHistory{
			DeviceID:  deviceID,
			OldStatus: model.DeviceStatusOffline,
			NewStatus: model.DeviceStatusOnline,
			Reason:    "heartbeat_received",
			Timestamp: now,
		}
		database.DB.Create(history)

		event.Publish(event.NewEvent(event.EventTypeDeviceOnline, deviceID, map[string]interface{}{
			"ip_address": ipAddress,
			"time":       now,
		}))
	}

	database.DB.Save(d)
	cache.SetDeviceInfo(d, 24*time.Hour)

	return nil
}

func GetDeviceStatusHistory(deviceID string, startTime, endTime *time.Time, limit int) ([]model.DeviceStatusHistory, error) {
	var history []model.DeviceStatusHistory
	query := database.DB.Where("device_id = ?", deviceID)

	if startTime != nil {
		query = query.Where("timestamp >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("timestamp <= ?", *endTime)
	}

	if limit > 0 {
		query = query.Limit(limit)
	}

	err := query.Order("timestamp DESC").Find(&history).Error
	return history, err
}
