package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/device-manager/internal/model"
	"github.com/go-redis/redis/v8"
)

var (
	ctx = context.Background()
	rdb *redis.Client
)

func Init(addr, password string, db int) error {
	rdb = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})
	return rdb.Ping(ctx).Err()
}

func GetClient() *redis.Client {
	return rdb
}

func SetDeviceStatus(deviceID string, status model.DeviceStatus, expiration time.Duration) error {
	key := "device:status:" + deviceID
	return rdb.Set(ctx, key, string(status), expiration).Err()
}

func GetDeviceStatus(deviceID string) (model.DeviceStatus, error) {
	key := "device:status:" + deviceID
	result, err := rdb.Get(ctx, key).Result()
	if err != nil {
		return "", err
	}
	return model.DeviceStatus(result), nil
}

func SetDeviceHeartbeat(deviceID string, timestamp time.Time) error {
	key := "device:heartbeat:" + deviceID
	return rdb.Set(ctx, key, timestamp.Unix(), 0).Err()
}

func GetDeviceHeartbeat(deviceID string) (time.Time, error) {
	key := "device:heartbeat:" + deviceID
	result, err := rdb.Get(ctx, key).Int64()
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(result, 0), nil
}

func SetDeviceInfo(device *model.Device, expiration time.Duration) error {
	key := "device:info:" + device.DeviceID
	data, err := json.Marshal(device)
	if err != nil {
		return err
	}
	return rdb.Set(ctx, key, data, expiration).Err()
}

func GetDeviceInfo(deviceID string) (*model.Device, error) {
	key := "device:info:" + deviceID
	data, err := rdb.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	var device model.Device
	if err := json.Unmarshal(data, &device); err != nil {
		return nil, err
	}
	return &device, nil
}

func DeleteDeviceInfo(deviceID string) error {
	key := "device:info:" + deviceID
	return rdb.Del(ctx, key).Err()
}

func SetPendingCommand(command *model.DeviceCommand) error {
	key := "device:command:pending:" + command.DeviceID
	data, err := json.Marshal(command)
	if err != nil {
		return err
	}
	return rdb.LPush(ctx, key, data).Err()
}

func GetPendingCommand(deviceID string) (*model.DeviceCommand, error) {
	key := "device:command:pending:" + deviceID
	data, err := rdb.RPop(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}
	var command model.DeviceCommand
	if err := json.Unmarshal(data, &command); err != nil {
		return nil, err
	}
	return &command, nil
}
