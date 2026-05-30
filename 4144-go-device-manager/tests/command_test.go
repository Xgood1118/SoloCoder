package tests

import (
	"testing"

	"github.com/device-manager/internal/command"
	"github.com/device-manager/internal/device"
	"github.com/device-manager/internal/model"
	"github.com/device-manager/pkg/database"
)

func TestSendCommandOfflineDevice(t *testing.T) {
	identifier := "66:77:88:99:00:aa"
	device.AddToWhitelist(identifier, "mac", "sensor", "Test")

	req := &device.RegisterRequest{
		MacAddress: identifier,
		Name:        "Command Test Device",
		DeviceType:  "sensor",
	}

	dev, _ := device.RegisterDevice(req)

	cmdReq := &command.SendCommandRequest{
		DeviceID:    dev.DeviceID,
		CommandType: "get_config",
		Mode:        model.CommandModeAsync,
		Payload:     "{}",
	}

	_, err := command.SendCommand(cmdReq)
	if err == nil {
		t.Error("Expected error when sending command to offline device")
	}
}

func TestSendCommandOnlineDevice(t *testing.T) {
	identifier := "77:88:99:00:aa:bb"
	device.AddToWhitelist(identifier, "mac", "sensor", "Test")

	req := &device.RegisterRequest{
		MacAddress: identifier,
		Name:        "Online Command Test",
		DeviceType:  "sensor",
	}

	dev, _ := device.RegisterDevice(req)

	var devUpdate model.Device
	database.DB.Model(&model.Device{}).Where("device_id = ?", dev.DeviceID).First(&devUpdate)
	devUpdate.Status = model.DeviceStatusOnline
	database.DB.Save(&devUpdate)

	cmdReq := &command.SendCommandRequest{
		DeviceID:    dev.DeviceID,
		CommandType: "get_config",
		Mode:        model.CommandModeAsync,
		Payload:     "{}",
	}

	result, err := command.SendCommand(cmdReq)
	if err != nil {
		t.Fatalf("SendCommand failed: %v", err)
	}
	if result.CommandID == "" {
		t.Error("CommandID should not be empty")
	}
}

func TestIdempotency(t *testing.T) {
	identifier := "88:99:00:aa:bb:cc"
	device.AddToWhitelist(identifier, "mac", "sensor", "Test")

	req := &device.RegisterRequest{
		MacAddress: identifier,
		Name:        "Idempotency Test",
		DeviceType:  "sensor",
	}

	dev, _ := device.RegisterDevice(req)

	var devUpdate model.Device
	database.DB.Model(&model.Device{}).Where("device_id = ?", dev.DeviceID).First(&devUpdate)
	devUpdate.Status = model.DeviceStatusOnline
	database.DB.Save(&devUpdate)

	requestID := "req-test-123"

	cmdReq := &command.SendCommandRequest{
		DeviceID:    dev.DeviceID,
		CommandType: "get_config",
		Mode:        model.CommandModeAsync,
		Payload:     "{}",
		RequestID:   requestID,
	}

	result1, err := command.SendCommand(cmdReq)
	if err != nil {
		t.Fatalf("First SendCommand failed: %v", err)
	}

	result2, err := command.SendCommand(cmdReq)
	if err != nil {
		t.Fatalf("Second SendCommand failed: %v", err)
	}

	if result1.CommandID != result2.CommandID {
		t.Error("Idempotent requests should return same command ID")
	}
}

func TestUpdateCommandStatus(t *testing.T) {
	identifier := "99:00:aa:bb:cc:dd"
	device.AddToWhitelist(identifier, "mac", "sensor", "Test")

	req := &device.RegisterRequest{
		MacAddress: identifier,
		Name:        "Status Update Test",
		DeviceType:  "sensor",
	}

	dev, _ := device.RegisterDevice(req)

	var devUpdate model.Device
	database.DB.Model(&model.Device{}).Where("device_id = ?", dev.DeviceID).First(&devUpdate)
	devUpdate.Status = model.DeviceStatusOnline
	database.DB.Save(&devUpdate)

	cmdReq := &command.SendCommandRequest{
		DeviceID:    dev.DeviceID,
		CommandType: "reboot",
		Mode:        model.CommandModeAsync,
		Payload:     "{}",
	}

	result, _ := command.SendCommand(cmdReq)

	err := command.UpdateCommandStatus(result.CommandID, model.CommandStatusSuccess, "Reboot complete")
	if err != nil {
		t.Fatalf("UpdateCommandStatus failed: %v", err)
	}

	cmd, err := command.GetCommand(result.CommandID)
	if err != nil {
		t.Fatalf("GetCommand failed: %v", err)
	}
	if cmd.Status != model.CommandStatusSuccess {
		t.Errorf("Expected status success, got %s", cmd.Status)
	}
}

func TestParsePayload(t *testing.T) {
	payload := `{"key": "value", "number": 123}`
	result, err := command.ParsePayload(payload)
	if err != nil {
		t.Fatalf("ParsePayload failed: %v", err)
	}
	if result["key"] != "value" {
		t.Error("Expected key=value")
	}
}
