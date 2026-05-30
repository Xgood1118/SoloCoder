package tests

import (
	"os"
	"testing"

	"github.com/device-manager/internal/device"
	"github.com/device-manager/pkg/database"
)

func TestMain(m *testing.M) {
	if err := database.Init(":memory:"); err != nil {
		panic("failed to init database: " + err.Error())
	}
	os.Exit(m.Run())
}

func TestCheckWhitelist(t *testing.T) {
	identifier := "00:11:22:33:44:55"
	idType := "mac"

	allowed, err := device.CheckWhitelist(identifier, idType)
	if err != nil {
		t.Fatalf("CheckWhitelist failed: %v", err)
	}
	if allowed {
		t.Error("Expected not in whitelist should return false")
	}

	err = device.AddToWhitelist(identifier, idType, "sensor", "Test device")
	if err != nil {
		t.Fatalf("AddToWhitelist failed: %v", err)
	}

	allowed, err = device.CheckWhitelist(identifier, idType)
	if err != nil {
		t.Fatalf("CheckWhitelist failed: %v", err)
	}
	if !allowed {
		t.Error("Device in whitelist should return true")
	}
}

func TestRegisterDevice(t *testing.T) {
	identifier := "aa:bb:cc:dd:ee:ff"
	idType := "mac"
	device.AddToWhitelist(identifier, idType, "sensor", "Test device")

	req := &device.RegisterRequest{
		MacAddress: identifier,
		Name:        "Test Device",
		DeviceType:  "sensor",
	}

	dev, err := device.RegisterDevice(req)
	if err != nil {
		t.Fatalf("RegisterDevice failed: %v", err)
	}
	if dev == nil {
		t.Fatal("Device should not be nil")
	}
	if dev.DeviceID == "" {
		t.Error("DeviceID should not be empty")
	}
	if dev.MacAddress != identifier {
		t.Errorf("MacAddress mismatch: got %s, want %s", dev.MacAddress, identifier)
	}
}

func TestGetDeviceByID(t *testing.T) {
	identifier := "11:22:33:44:55:66"
	device.AddToWhitelist(identifier, "mac", "sensor", "Test")

	req := &device.RegisterRequest{
		MacAddress: identifier,
		Name:        "Test Device",
		DeviceType:  "sensor",
	}

	dev, _ := device.RegisterDevice(req)

	dev2, err := device.GetDeviceByID(dev.DeviceID)
	if err != nil {
		t.Fatalf("GetDeviceByID failed: %v", err)
	}
	if dev2.DeviceID != dev.DeviceID {
		t.Error("DeviceID mismatch")
	}
}

func TestListDevices(t *testing.T) {
	query := device.DeviceQuery{
		DeviceType: "sensor",
		Page:       1,
		PageSize:   10,
	}

	result, err := device.ListDevices(query)
	if err != nil {
		t.Fatalf("ListDevices failed: %v", err)
	}
	if result.Total < 1 {
		t.Errorf("Expected at least 1 device")
	}
}

func TestSetDeviceTags(t *testing.T) {
	identifier := "22:33:44:55:66:77"
	device.AddToWhitelist(identifier, "mac", "sensor", "Test")

	req := &device.RegisterRequest{
		MacAddress: identifier,
		Name:        "Tag Test Device",
		DeviceType:  "sensor",
	}

	dev, _ := device.RegisterDevice(req)

	tags := map[string]string{
		"env":     "prod",
		"version": "1.0",
	}

	err := device.SetDeviceTags(dev.DeviceID, tags)
	if err != nil {
		t.Fatalf("SetDeviceTags failed: %v", err)
	}
}
