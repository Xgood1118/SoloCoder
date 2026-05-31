package channel

import (
	"context"
	"sync"
	"time"

	"github.com/sms-gateway/internal/config"
	"github.com/sms-gateway/internal/core"
)

type BaseChannel struct {
	name       string
	channelType string
	weight     int
	group      string
	enabled    bool
	healthy    bool
	config     config.ChannelConfig

	totalRequests  int64
	failedRequests int64
	healthMu       sync.RWMutex
}

func NewBaseChannel(cfg config.ChannelConfig) *BaseChannel {
	return &BaseChannel{
		name:       cfg.Name,
		channelType: cfg.Type,
		weight:     cfg.Weight,
		group:      cfg.Group,
		enabled:    cfg.Enabled,
		healthy:    true,
		config:     cfg,
	}
}

func (c *BaseChannel) Name() string {
	return c.name
}

func (c *BaseChannel) Type() string {
	return c.channelType
}

func (c *BaseChannel) Weight() int {
	return c.weight
}

func (c *BaseChannel) Group() string {
	return c.group
}

func (c *BaseChannel) IsEnabled() bool {
	return c.enabled
}

func (c *BaseChannel) IsHealthy() bool {
	c.healthMu.RLock()
	defer c.healthMu.RUnlock()
	return c.healthy
}

func (c *BaseChannel) SetHealthy(healthy bool) {
	c.healthMu.Lock()
	defer c.healthMu.Unlock()
	c.healthy = healthy
}

func (c *BaseChannel) HealthCheck(ctx context.Context) error {
	return nil
}

func (c *BaseChannel) GetConfig() map[string]interface{} {
	return map[string]interface{}{
		"name":    c.name,
		"type":    c.channelType,
		"weight":  c.weight,
		"group":   c.group,
		"enabled": c.enabled,
		"healthy": c.healthy,
	}
}

func (c *BaseChannel) GetTimeout() time.Duration {
	if c.config.Timeout > 0 {
		return c.config.Timeout
	}
	return 5 * time.Second
}

func (c *BaseChannel) GetMaxRetries() int {
	if c.config.MaxRetries > 0 {
		return c.config.MaxRetries
	}
	return 3
}

func (c *BaseChannel) IncrTotal() {
	c.healthMu.Lock()
	defer c.healthMu.Unlock()
	c.totalRequests++
}

func (c *BaseChannel) IncrFailed() {
	c.healthMu.Lock()
	defer c.healthMu.Unlock()
	c.failedRequests++
}

func (c *BaseChannel) GetStats() (total int64, failed int64, rate float64) {
	c.healthMu.RLock()
	defer c.healthMu.RUnlock()
	total = c.totalRequests
	failed = c.failedRequests
	if total > 0 {
		rate = float64(total-failed) / float64(total)
	}
	return
}

func (c *BaseChannel) ResetStats() {
	c.healthMu.Lock()
	defer c.healthMu.Unlock()
	c.totalRequests = 0
	c.failedRequests = 0
}

func (c *BaseChannel) ParseDeliveryReport(body []byte) (*core.DeliveryReport, error) {
	return nil, nil
}

func (c *BaseChannel) ParseMoMessage(body []byte) (*core.MoMessage, error) {
	return nil, nil
}
