package ratelimiter

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"
)

const (
	ConfigPrefix      = "rate_limit:config:"
	DefaultConfigTTL  = 2 * time.Hour
	ConfigRefreshInterval = 30 * time.Second
)

type AlgorithmType string

const (
	AlgorithmTokenBucket   AlgorithmType = "token_bucket"
	AlgorithmSlidingWindow AlgorithmType = "sliding_window"
)

type LimitDimension string

const (
	DimensionUserID LimitDimension = "user_id"
	DimensionIP     LimitDimension = "ip"
)

type LimitConfig struct {
	Path          string            `json:"path"`
	Algorithm     AlgorithmType     `json:"algorithm"`
	Dimension     LimitDimension    `json:"dimension"`
	QPS           float64           `json:"qps"`
	Burst         int               `json:"burst"`
	Capacity      float64           `json:"capacity"`
	Rate          float64           `json:"rate"`
	Limit         int               `json:"limit"`
	Window        time.Duration     `json:"window"`
	QueueSize     int               `json:"queue_size"`
	QueueTimeout  time.Duration     `json:"queue_timeout"`
	Enabled       bool              `json:"enabled"`
}

type ConfigManager struct {
	client        RedisClient
	localCache    sync.Map
	refreshTicker *time.Ticker
	ctx           context.Context
	cancel        context.CancelFunc
	defaultConfig *LimitConfig
}

func NewConfigManager(client RedisClient) *ConfigManager {
	ctx, cancel := context.WithCancel(context.Background())
	cm := &ConfigManager{
		client:        client,
		ctx:           ctx,
		cancel:        cancel,
		refreshTicker: time.NewTicker(ConfigRefreshInterval),
		defaultConfig: &LimitConfig{
			Algorithm:    AlgorithmTokenBucket,
			Dimension:    DimensionIP,
			QPS:          100,
			Burst:        200,
			Capacity:     200,
			Rate:         100,
			QueueSize:    100,
			QueueTimeout: 30 * time.Second,
			Enabled:      true,
		},
	}
	go cm.refreshLoop()
	return cm
}

func (cm *ConfigManager) Close() {
	cm.cancel()
	cm.refreshTicker.Stop()
}

func (cm *ConfigManager) refreshLoop() {
	for {
		select {
		case <-cm.ctx.Done():
			return
		case <-cm.refreshTicker.C:
			cm.refreshAll()
		}
	}
}

func (cm *ConfigManager) refreshAll() {
	cm.localCache.Range(func(key, value interface{}) bool {
		path, ok := key.(string)
		if ok {
			_, _ = cm.loadConfigFromRedis(path)
		}
		return true
	})
}

func (cm *ConfigManager) GetConfig(path string) (*LimitConfig, error) {
	if cached, ok := cm.localCache.Load(path); ok {
		return cached.(*LimitConfig), nil
	}
	return cm.loadConfigFromRedis(path)
}

func (cm *ConfigManager) loadConfigFromRedis(path string) (*LimitConfig, error) {
	key := ConfigPrefix + path
	configMap, err := cm.client.HGetAll(context.Background(), key).Result()
	if err != nil {
		return cm.defaultConfig, nil
	}

	if len(configMap) == 0 {
		cm.localCache.Store(path, cm.defaultConfig)
		return cm.defaultConfig, nil
	}

	config, err := parseConfig(configMap, path)
	if err != nil {
		return cm.defaultConfig, nil
	}

	cm.localCache.Store(path, config)
	return config, nil
}

func (cm *ConfigManager) SetConfig(path string, config *LimitConfig) error {
	key := ConfigPrefix + path
	config.Path = path

	args := []interface{}{
		"path", config.Path,
		"algorithm", string(config.Algorithm),
		"dimension", string(config.Dimension),
		"qps", fmt.Sprintf("%f", config.QPS),
		"burst", strconv.Itoa(config.Burst),
		"capacity", fmt.Sprintf("%f", config.Capacity),
		"rate", fmt.Sprintf("%f", config.Rate),
		"limit", strconv.Itoa(config.Limit),
		"window_ms", strconv.FormatInt(config.Window.Milliseconds(), 10),
		"queue_size", strconv.Itoa(config.QueueSize),
		"queue_timeout", strconv.FormatInt(config.QueueTimeout.Milliseconds(), 10),
		"enabled", strconv.FormatBool(config.Enabled),
	}

	err := cm.client.HSet(context.Background(), key, args...).Err()
	if err != nil {
		return fmt.Errorf("failed to set config: %w", err)
	}

	err = cm.client.Expire(context.Background(), key, DefaultConfigTTL).Err()
	if err != nil {
		return fmt.Errorf("failed to set config TTL: %w", err)
	}

	cm.localCache.Store(path, config)
	return nil
}

func (cm *ConfigManager) DeleteConfig(path string) error {
	key := ConfigPrefix + path
	err := cm.client.Del(context.Background(), key).Err()
	if err != nil {
		return fmt.Errorf("failed to delete config: %w", err)
	}
	cm.localCache.Delete(path)
	return nil
}

func (cm *ConfigManager) InvalidateCache(path string) {
	cm.localCache.Delete(path)
}

func parseConfig(configMap map[string]string, path string) (*LimitConfig, error) {
	config := &LimitConfig{
		Path:    path,
		Enabled: true,
	}

	if algo, ok := configMap["algorithm"]; ok {
		config.Algorithm = AlgorithmType(algo)
	} else {
		config.Algorithm = AlgorithmTokenBucket
	}

	if dim, ok := configMap["dimension"]; ok {
		config.Dimension = LimitDimension(dim)
	} else {
		config.Dimension = DimensionIP
	}

	if qpsStr, ok := configMap["qps"]; ok {
		qps, _ := strconv.ParseFloat(qpsStr, 64)
		config.QPS = qps
	}

	if burstStr, ok := configMap["burst"]; ok {
		burst, _ := strconv.Atoi(burstStr)
		config.Burst = burst
	}

	if capacityStr, ok := configMap["capacity"]; ok {
		capacity, _ := strconv.ParseFloat(capacityStr, 64)
		config.Capacity = capacity
	}

	if rateStr, ok := configMap["rate"]; ok {
		rate, _ := strconv.ParseFloat(rateStr, 64)
		config.Rate = rate
	}

	if limitStr, ok := configMap["limit"]; ok {
		limit, _ := strconv.Atoi(limitStr)
		config.Limit = limit
	}

	if windowStr, ok := configMap["window_ms"]; ok {
		windowMs, _ := strconv.ParseInt(windowStr, 10, 64)
		config.Window = time.Duration(windowMs) * time.Millisecond
	}

	if queueSizeStr, ok := configMap["queue_size"]; ok {
		queueSize, _ := strconv.Atoi(queueSizeStr)
		config.QueueSize = queueSize
	}

	if queueTimeoutStr, ok := configMap["queue_timeout"]; ok {
		queueTimeoutMs, _ := strconv.ParseInt(queueTimeoutStr, 10, 64)
		config.QueueTimeout = time.Duration(queueTimeoutMs) * time.Millisecond
	}

	if enabledStr, ok := configMap["enabled"]; ok {
		enabled, _ := strconv.ParseBool(enabledStr)
		config.Enabled = enabled
	}

	if config.Algorithm == AlgorithmTokenBucket {
		if config.Capacity == 0 {
			config.Capacity = float64(config.Burst)
			if config.Capacity == 0 {
				config.Capacity = config.QPS * 2
			}
		}
		if config.Rate == 0 {
			config.Rate = config.QPS
		}
	} else if config.Algorithm == AlgorithmSlidingWindow {
		if config.Limit == 0 {
			config.Limit = config.Burst
			if config.Limit == 0 {
				config.Limit = int(config.QPS)
			}
		}
		if config.Window == 0 {
			config.Window = time.Second
		}
	}

	if config.QueueSize == 0 {
		config.QueueSize = 100
	}
	if config.QueueTimeout == 0 {
		config.QueueTimeout = 30 * time.Second
	}

	return config, nil
}
