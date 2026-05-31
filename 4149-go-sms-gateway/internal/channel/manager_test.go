package channel

import (
	"context"
	"testing"

	"github.com/sms-gateway/internal/config"
	"github.com/sms-gateway/internal/core"
	"github.com/stretchr/testify/assert"
)

func TestChannelManager_Register(t *testing.T) {
	manager := NewManager()

	cfg := config.ChannelConfig{
		Name:    "test_channel",
		Type:    "mock",
		Enabled: true,
		Weight:  100,
		Group:   "default",
	}

	channel := NewMockChannel(cfg)
	err := manager.Register(channel)
	assert.NoError(t, err)

	err = manager.Register(channel)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestChannelManager_Unregister(t *testing.T) {
	manager := NewManager()

	cfg := config.ChannelConfig{
		Name:    "test_channel",
		Type:    "mock",
		Enabled: true,
		Weight:  100,
		Group:   "default",
	}

	channel := NewMockChannel(cfg)
	manager.Register(channel)

	err := manager.Unregister("test_channel")
	assert.NoError(t, err)

	err = manager.Unregister("test_channel")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestChannelManager_Get(t *testing.T) {
	manager := NewManager()

	cfg := config.ChannelConfig{
		Name:    "test_channel",
		Type:    "mock",
		Enabled: true,
		Weight:  100,
		Group:   "default",
	}

	channel := NewMockChannel(cfg)
	manager.Register(channel)

	ch, err := manager.Get("test_channel")
	assert.NoError(t, err)
	assert.NotNil(t, ch)
	assert.Equal(t, "test_channel", ch.Name())

	_, err = manager.Get("non_existent")
	assert.Error(t, err)
}

func TestChannelManager_List(t *testing.T) {
	manager := NewManager()

	for i := 0; i < 3; i++ {
		cfg := config.ChannelConfig{
			Name:    "channel_" + string(rune('0'+i)),
			Type:    "mock",
			Enabled: true,
			Weight:  100,
			Group:   "default",
		}
		manager.Register(NewMockChannel(cfg))
	}

	channels := manager.List()
	assert.Len(t, channels, 3)
}

func TestChannelManager_ListByGroup(t *testing.T) {
	manager := NewManager()

	cfg1 := config.ChannelConfig{
		Name:    "channel_a",
		Type:    "mock",
		Enabled: true,
		Weight:  100,
		Group:   "group1",
	}
	cfg2 := config.ChannelConfig{
		Name:    "channel_b",
		Type:    "mock",
		Enabled: true,
		Weight:  100,
		Group:   "group2",
	}

	manager.Register(NewMockChannel(cfg1))
	manager.Register(NewMockChannel(cfg2))

	group1 := manager.ListByGroup("group1")
	assert.Len(t, group1, 1)
	assert.Equal(t, "channel_a", group1[0].Name())

	group2 := manager.ListByGroup("group2")
	assert.Len(t, group2, 1)
	assert.Equal(t, "channel_b", group2[0].Name())
}

func TestChannelManager_SelectChannel(t *testing.T) {
	manager := NewManager()

	for i := 0; i < 3; i++ {
		cfg := config.ChannelConfig{
			Name:    "channel_" + string(rune('0'+i)),
			Type:    "mock",
			Enabled: true,
			Weight:  100,
			Group:   "default",
		}
		manager.Register(NewMockChannel(cfg))
	}

	ch, err := manager.SelectChannel("default")
	assert.NoError(t, err)
	assert.NotNil(t, ch)
}

func TestChannelManager_SelectChannel_NoAvailable(t *testing.T) {
	manager := NewManager()

	cfg := config.ChannelConfig{
		Name:    "test_channel",
		Type:    "mock",
		Enabled: false,
		Weight:  100,
		Group:   "default",
	}
	manager.Register(NewMockChannel(cfg))

	_, err := manager.SelectChannel("default")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no available channels")
}

func TestMockChannel_Send(t *testing.T) {
	cfg := config.ChannelConfig{
		Name:    "mock",
		Type:    "mock",
		Enabled: true,
		Weight:  100,
		Group:   "default",
	}

	channel := NewMockChannel(cfg)

	req := &core.SMSRequest{
		Phone:      "13900000000",
		TemplateID: "test_template",
	}

	resp, err := channel.Send(context.Background(), req)
	assert.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, "sent", resp.Status)
	assert.Equal(t, "mock", resp.Channel)
}

func TestMockChannel_Send_InvalidPhone(t *testing.T) {
	cfg := config.ChannelConfig{
		Name:    "mock",
		Type:    "mock",
		Enabled: true,
		Weight:  100,
		Group:   "default",
	}

	channel := NewMockChannel(cfg)

	req := &core.SMSRequest{
		Phone:      "13800000000",
		TemplateID: "test_template",
	}

	_, err := channel.Send(context.Background(), req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid phone number")
}

func TestMockChannel_BatchSend(t *testing.T) {
	cfg := config.ChannelConfig{
		Name:    "mock",
		Type:    "mock",
		Enabled: true,
		Weight:  100,
		Group:   "default",
	}

	channel := NewMockChannel(cfg)

	req := &core.BatchSMSRequest{
		Phones:     []string{"13900000001", "13900000002", "13900000003"},
		TemplateID: "test_template",
	}

	responses, err := channel.BatchSend(context.Background(), req)
	assert.NoError(t, err)
	assert.Len(t, responses, 3)

	for _, resp := range responses {
		assert.Equal(t, "sent", resp.Status)
	}
}
