package ratelimiter

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestTokenBucketAllow(t *testing.T) {
	mockRedis := NewMockRedisClient()
	limiter := NewTokenBucketLimiter(mockRedis)

	ctx := context.Background()
	key := "test:bucket"
	capacity := 10.0
	rate := 5.0

	for i := 0; i < 10; i++ {
		result, err := limiter.Allow(ctx, key, capacity, rate, 1)
		assert.NoError(t, err)
		assert.True(t, result.Allowed)
	}

	result, err := limiter.Allow(ctx, key, capacity, rate, 1)
	assert.NoError(t, err)
	assert.False(t, result.Allowed)
	assert.Greater(t, result.RetryAfter, time.Duration(0))
}

func TestTokenBucketRefill(t *testing.T) {
	mockRedis := NewMockRedisClient()
	limiter := NewTokenBucketLimiter(mockRedis)

	ctx := context.Background()
	key := "test:bucket:refill"
	capacity := 10.0
	rate := 100.0

	for i := 0; i < 10; i++ {
		result, err := limiter.Allow(ctx, key, capacity, rate, 1)
		assert.NoError(t, err)
		assert.True(t, result.Allowed)
	}

	time.Sleep(100 * time.Millisecond)

	result, err := limiter.Allow(ctx, key, capacity, rate, 1)
	assert.NoError(t, err)
	assert.True(t, result.Allowed)
}

func TestTokenBucketReset(t *testing.T) {
	mockRedis := NewMockRedisClient()
	limiter := NewTokenBucketLimiter(mockRedis)

	ctx := context.Background()
	key := "test:bucket:reset"
	capacity := 5.0
	rate := 5.0

	for i := 0; i < 5; i++ {
		result, err := limiter.Allow(ctx, key, capacity, rate, 1)
		assert.NoError(t, err)
		assert.True(t, result.Allowed)
	}

	err := limiter.Reset(ctx, key)
	assert.NoError(t, err)

	result, err := limiter.Allow(ctx, key, capacity, rate, 1)
	assert.NoError(t, err)
	assert.True(t, result.Allowed)
}

func TestParseTokenBucketConfig(t *testing.T) {
	tests := []struct {
		name     string
		config   map[string]string
		wantCap  float64
		wantRate float64
		wantErr  bool
	}{
		{
			name: "valid config",
			config: map[string]string{
				"capacity": "100",
				"rate":     "50",
			},
			wantCap:  100,
			wantRate: 50,
			wantErr:  false,
		},
		{
			name: "missing capacity",
			config: map[string]string{
				"rate": "50",
			},
			wantErr: true,
		},
		{
			name: "invalid capacity",
			config: map[string]string{
				"capacity": "abc",
				"rate":     "50",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			capacity, rate, err := ParseTokenBucketConfig(tt.config)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tt.wantCap, capacity)
			assert.Equal(t, tt.wantRate, rate)
		})
	}
}
