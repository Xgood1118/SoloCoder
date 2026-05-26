package ratelimiter

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestSlidingWindowAllow(t *testing.T) {
	mockRedis := NewMockRedisClient()
	limiter := NewSlidingWindowLimiter(mockRedis)

	ctx := context.Background()
	key := "test:window"
	limit := 10
	windowSize := 1 * time.Second

	for i := 0; i < 10; i++ {
		result, err := limiter.Allow(ctx, key, limit, windowSize)
		assert.NoError(t, err)
		assert.True(t, result.Allowed)
	}

	result, err := limiter.Allow(ctx, key, limit, windowSize)
	assert.NoError(t, err)
	assert.False(t, result.Allowed)
	assert.Greater(t, result.RetryAfter, time.Duration(0))
}

func TestSlidingWindowExpire(t *testing.T) {
	mockRedis := NewMockRedisClient()
	limiter := NewSlidingWindowLimiter(mockRedis)

	ctx := context.Background()
	key := "test:window:expire"
	limit := 5
	windowSize := 500 * time.Millisecond

	for i := 0; i < 5; i++ {
		result, err := limiter.Allow(ctx, key, limit, windowSize)
		assert.NoError(t, err)
		assert.True(t, result.Allowed)
	}

	result, err := limiter.Allow(ctx, key, limit, windowSize)
	assert.NoError(t, err)
	assert.False(t, result.Allowed)

	time.Sleep(600 * time.Millisecond)

	result, err = limiter.Allow(ctx, key, limit, windowSize)
	assert.NoError(t, err)
	assert.True(t, result.Allowed)
}

func TestSlidingWindowReset(t *testing.T) {
	mockRedis := NewMockRedisClient()
	limiter := NewSlidingWindowLimiter(mockRedis)

	ctx := context.Background()
	key := "test:window:reset"
	limit := 5
	windowSize := 1 * time.Second

	for i := 0; i < 5; i++ {
		result, err := limiter.Allow(ctx, key, limit, windowSize)
		assert.NoError(t, err)
		assert.True(t, result.Allowed)
	}

	err := limiter.Reset(ctx, key)
	assert.NoError(t, err)

	result, err := limiter.Allow(ctx, key, limit, windowSize)
	assert.NoError(t, err)
	assert.True(t, result.Allowed)
}

func TestParseSlidingWindowConfig(t *testing.T) {
	tests := []struct {
		name       string
		config     map[string]string
		wantLimit  int
		wantWindow time.Duration
		wantErr    bool
	}{
		{
			name: "valid config",
			config: map[string]string{
				"limit":  "100",
				"window": "1000",
			},
			wantLimit:  100,
			wantWindow: 1000 * time.Millisecond,
			wantErr:    false,
		},
		{
			name: "missing limit",
			config: map[string]string{
				"window": "1000",
			},
			wantErr: true,
		},
		{
			name: "invalid limit",
			config: map[string]string{
				"limit":  "abc",
				"window": "1000",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limit, window, err := ParseSlidingWindowConfig(tt.config)
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
			assert.Equal(t, tt.wantLimit, limit)
			assert.Equal(t, tt.wantWindow, window)
		})
	}
}
