package event

import (
	"sync"
	"time"
)

type EventType string

const (
	EventTypeDeviceOnline     EventType = "device_online"
	EventTypeDeviceOffline    EventType = "device_offline"
	EventTypeDeviceRegistered EventType = "device_registered"
	EventTypeDeviceDeleted    EventType = "device_deleted"
	EventTypeCommandSuccess   EventType = "command_success"
	EventTypeCommandFailed    EventType = "command_failed"
	EventTypeAlertTriggered   EventType = "alert_triggered"
	EventTypeFirmwareUpgrade  EventType = "firmware_upgrade"
)

type Event struct {
	Type      EventType   `json:"type"`
	DeviceID  string      `json:"device_id"`
	Timestamp time.Time   `json:"timestamp"`
	Data      interface{} `json:"data"`
}

type EventHandler func(Event)

type EventBus struct {
	subscribers map[EventType][]EventHandler
	mu          sync.RWMutex
}

var bus = &EventBus{
	subscribers: make(map[EventType][]EventHandler),
}

func Subscribe(eventType EventType, handler EventHandler) {
	bus.mu.Lock()
	defer bus.mu.Unlock()
	bus.subscribers[eventType] = append(bus.subscribers[eventType], handler)
}

func Publish(event Event) {
	bus.mu.RLock()
	defer bus.mu.RUnlock()

	if handlers, ok := bus.subscribers[event.Type]; ok {
		for _, handler := range handlers {
			go handler(event)
		}
	}
}

func NewEvent(eventType EventType, deviceID string, data interface{}) Event {
	return Event{
		Type:      eventType,
		DeviceID:  deviceID,
		Timestamp: time.Now(),
		Data:      data,
	}
}
