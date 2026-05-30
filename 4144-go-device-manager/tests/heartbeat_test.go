package tests

import (
	"testing"
	"time"

	"github.com/device-manager/internal/device"
	"github.com/device-manager/internal/heartbeat"
	"github.com/device-manager/internal/model"
	"github.com/device-manager/pkg/database"
)

func TestProcessHeartbeat(t *testing.T) {
	identifier := "33:44:55:66:77:88"
	device.AddToWhitelist(identifier, "mac", "sensor", "Test")

	req := &device.RegisterRequest{
		MacAddress: identifier,
		Name:        "Heartbeat Test Device",
		DeviceType:  "sensor",
	}

	dev, err := device.RegisterDevice(req)
	if err != nil {
		t.Fatalf("RegisterDevice failed: %v", err)
	}

	err = heartbeat.ProcessHeartbeat(dev.DeviceID, "192.168.1.100", "")
	if err != nil {
		t.Fatalf("ProcessHeartbeat failed: %v", err)
	}

	devAfter, _ := device.GetDeviceByID(dev.DeviceID)
	if devAfter.Status != model.DeviceStatusOnline {
		t.Errorf("Expected device to be online, got %s", devAfter.Status)
	}
	if devAfter.LastHeartbeat == nil {
		t.Error("LastHeartbeat should not be nil")
	}
}

func TestGetDeviceStatusHistory(t *testing.T) {
	identifier := "44:55:66:77:88:99"
	device.AddToWhitelist(identifier, "mac", "sensor", "Test")

	req := &device.RegisterRequest{
		MacAddress: identifier,
		Name:        "History Test Device",
		DeviceType:  "sensor",
	}

	dev, _ := device.RegisterDevice(req)
	heartbeat.ProcessHeartbeat(dev.DeviceID, "192.168.1.101", "")

	history, err := heartbeat.GetDeviceStatusHistory(dev.DeviceID, nil, nil, 10)
	if err != nil {
		t.Fatalf("GetDeviceStatusHistory failed: %v", err)
	}
	if len(history) < 1 {
		t.Error("Expected at least 1 history record")
	}
}

func TestHeartbeatManager(t *testing.T) {
	hm := heartbeat.GetManager(5, 1)
	hm.Start()

	defer hm.Stop()

	identifier := "55:66:77:88:99:00"
	device.AddToWhitelist(identifier, "mac", "sensor", "Test")

	req := &device.RegisterRequest{
		MacAddress: identifier,
		Name:        "Manager Test Device",
		DeviceType:  "sensor",
	}

	dev, _ := device.RegisterDevice(req)

	var devUpdate model.Device
	database.DB.Model(&model.Device{}).Where("device_id = ?", dev.DeviceID).First(&devUpdate)
	now := time.Now().Add(-10 * time.Minute)
	devUpdate.LastHeartbeat = &now
	devUpdate.Status = model.DeviceStatusOnline
	database.DB.Save(&devUpdate)

	time.Sleep(2 * time.Second)
}
