package ratelimiter

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestConfigManagerSetAndGet(t *testing.T) {
	mockRedis := NewMockRedisClient()
	cm := NewConfigManager(mockRedis)
	defer cm.Close()

	path := "/api/test"
	config := &LimitConfig{
		Path:       path,
		Algorithm:  AlgorithmTokenBucket,
		Dimension:  DimensionUserID,
		QPS:        100,
		Burst:      200,
		Capacity:   200,
		Rate:       100,
		QueueSize:  50,
		QueueTimeout: 30 * time.Second,
		Enabled:    true,
	}

	err := cm.SetConfig(path, config)
	assert.NoError(t, err)

	retrieved, err := cm.GetConfig(path)
	assert.NoError(t, err)
	assert.Equal(t, config.Algorithm, retrieved.Algorithm)
	assert.Equal(t, config.Dimension, retrieved.Dimension)
	assert.Equal(t, config.QPS, retrieved.QPS)
	assert.Equal(t, config.Burst, retrieved.Burst)
	assert.Equal(t, config.Capacity, retrieved.Capacity)
	assert.Equal(t, config.Rate, retrieved.Rate)
	assert.Equal(t, config.QueueSize, retrieved.QueueSize)
	assert.Equal(t, config.Enabled, retrieved.Enabled)
}

func TestConfigManagerDefaultConfig(t *testing.T) {
	mockRedis := NewMockRedisClient()
	cm := NewConfigManager(mockRedis)
	defer cm.Close()

	path := "/api/nonexistent"

	config, err := cm.GetConfig(path)
	assert.NoError(t, err)
	assert.NotNil(t, config)
	assert.Equal(t, AlgorithmTokenBucket, config.Algorithm)
	assert.Equal(t, DimensionIP, config.Dimension)
	assert.Equal(t, 100.0, config.QPS)
	assert.Equal(t, 200, config.Burst)
}

func TestConfigManagerDelete(t *testing.T) {
	mockRedis := NewMockRedisClient()
	cm := NewConfigManager(mockRedis)
	defer cm.Close()

	path := "/api/delete"
	config := NewDefaultConfig(AlgorithmTokenBucket, DimensionIP, 50, 100)

	err := cm.SetConfig(path, config)
	assert.NoError(t, err)

	_, err = cm.GetConfig(path)
	assert.NoError(t, err)

	err = cm.DeleteConfig(path)
	assert.NoError(t, err)

	retrieved, err := cm.GetConfig(path)
	assert.NoError(t, err)
	assert.Equal(t, cm.defaultConfig.Algorithm, retrieved.Algorithm)
}

func TestConfigManagerInvalidateCache(t *testing.T) {
	mockRedis := NewMockRedisClient()
	cm := NewConfigManager(mockRedis)
	defer cm.Close()

	path := "/api/invalidate"
	config1 := NewDefaultConfig(AlgorithmTokenBucket, DimensionIP, 50, 100)

	err := cm.SetConfig(path, config1)
	assert.NoError(t, err)

	retrieved1, err := cm.GetConfig(path)
	assert.NoError(t, err)
	assert.Equal(t, 50.0, retrieved1.QPS)

	config2 := NewDefaultConfig(AlgorithmTokenBucket, DimensionIP, 100, 200)
	err = cm.SetConfig(path, config2)
	assert.NoError(t, err)

	cm.InvalidateCache(path)

	retrieved2, err := cm.GetConfig(path)
	assert.NoError(t, err)
	assert.Equal(t, 100.0, retrieved2.QPS)
}

func TestConfigManagerSlidingWindowConfig(t *testing.T) {
	mockRedis := NewMockRedisClient()
	cm := NewConfigManager(mockRedis)
	defer cm.Close()

	path := "/api/sliding"
	config := &LimitConfig{
		Path:       path,
		Algorithm:  AlgorithmSlidingWindow,
		Dimension:  DimensionIP,
		QPS:        50,
		Burst:      50,
		Limit:      50,
		Window:     time.Second,
		QueueSize:  30,
		QueueTimeout: 30 * time.Second,
		Enabled:    true,
	}

	err := cm.SetConfig(path, config)
	assert.NoError(t, err)

	retrieved, err := cm.GetConfig(path)
	assert.NoError(t, err)
	assert.Equal(t, AlgorithmSlidingWindow, retrieved.Algorithm)
	assert.Equal(t, 50, retrieved.Limit)
	assert.Equal(t, time.Second, retrieved.Window)
}

func TestParseConfigAutoFill(t *testing.T) {
	configMap := map[string]string{
		"algorithm": "token_bucket",
		"dimension": "user_id",
		"qps":       "100",
		"burst":     "200",
	}

	config, err := parseConfig(configMap, "/api/test")
	assert.NoError(t, err)
	assert.Equal(t, AlgorithmTokenBucket, config.Algorithm)
	assert.Equal(t, DimensionUserID, config.Dimension)
	assert.Equal(t, 200.0, config.Capacity)
	assert.Equal(t, 100.0, config.Rate)
	assert.Equal(t, 100, config.QueueSize)
	assert.Equal(t, 30*time.Second, config.QueueTimeout)
	assert.True(t, config.Enabled)
}

func TestParseConfigSlidingWindowAutoFill(t *testing.T) {
	configMap := map[string]string{
		"algorithm": "sliding_window",
		"dimension": "ip",
		"qps":       "50",
		"burst":     "50",
	}

	config, err := parseConfig(configMap, "/api/test")
	assert.NoError(t, err)
	assert.Equal(t, AlgorithmSlidingWindow, config.Algorithm)
	assert.Equal(t, DimensionIP, config.Dimension)
	assert.Equal(t, 50, config.Limit)
	assert.Equal(t, time.Second, config.Window)
}

func TestConfigTTL(t *testing.T) {
	mockRedis := NewMockRedisClient()
	cm := NewConfigManager(mockRedis)
	defer cm.Close()

	path := "/api/ttl"
	config := NewDefaultConfig(AlgorithmTokenBucket, DimensionIP, 100, 200)

	err := cm.SetConfig(path, config)
	assert.NoError(t, err)

	redisKey := ConfigPrefix + path
	ttl, err := mockRedis.TTL(context.Background(), redisKey).Result()
	assert.NoError(t, err)
	assert.Greater(t, ttl, time.Duration(0))
	assert.LessOrEqual(t, ttl, DefaultConfigTTL)
}
