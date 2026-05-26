package ratelimiter

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
)

const (
	slidingWindowScript = `
-- sliding_window_algorithm
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_size = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local request_id = ARGV[4]
local ttl = tonumber(ARGV[5])

local window_start = now - window_size

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

local count = redis.call('ZCARD', key)

local allowed = 0
local retry_after = 0

if count < limit then
    redis.call('ZADD', key, now, request_id)
    redis.call('EXPIRE', key, ttl)
    allowed = 1
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    if #oldest >= 2 then
        local oldest_time = tonumber(oldest[2])
        retry_after = math.ceil((oldest_time + window_size - now) / 1000)
        if retry_after < 1 then
            retry_after = 1
        end
    else
        retry_after = 1
    end
end

local remaining = limit - count - 1
if remaining < 0 then
    remaining = 0
end

return {allowed, retry_after, remaining}
`
)

type SlidingWindowLimiter struct {
	client     RedisClient
	scriptSHA  string
	defaultTTL time.Duration
}

func NewSlidingWindowLimiter(client RedisClient) *SlidingWindowLimiter {
	return &SlidingWindowLimiter{
		client:     client,
		scriptSHA:  ScriptSHA(slidingWindowScript),
		defaultTTL: 2 * time.Hour,
	}
}

type SlidingWindowResult struct {
	Allowed    bool
	RetryAfter time.Duration
	Remaining  int64
}

func (l *SlidingWindowLimiter) Allow(ctx context.Context, key string, limit int, windowSize time.Duration) (*SlidingWindowResult, error) {
	now := float64(time.Now().UnixNano()) / float64(time.Millisecond)
	requestID := uuid.New().String()

	keys := []string{key}
	args := []interface{}{
		limit,
		windowSize.Milliseconds(),
		now,
		requestID,
		int(l.defaultTTL.Seconds()),
	}

	var result []interface{}
	var err error

	exists, err := l.client.ScriptExists(ctx, l.scriptSHA).Result()
	if err == nil && len(exists) > 0 && exists[0] {
		var rawResult interface{}
		rawResult, err = l.client.EvalSha(ctx, l.scriptSHA, keys, args...).Result()
		if err == nil {
			result, _ = rawResult.([]interface{})
		}
	}

	if err != nil || result == nil {
		var rawResult interface{}
		rawResult, err = l.client.Eval(ctx, slidingWindowScript, keys, args...).Result()
		if err == nil {
			result, _ = rawResult.([]interface{})
			l.scriptSHA, _ = l.client.ScriptLoad(ctx, slidingWindowScript).Result()
		}
	}

	if err != nil {
		return nil, fmt.Errorf("sliding window eval failed: %w", err)
	}

	if result == nil || len(result) < 3 {
		return nil, fmt.Errorf("unexpected result length: %d", len(result))
	}

	allowed, _ := result[0].(int64)
	retryAfter, _ := result[1].(int64)
	remaining, _ := result[2].(int64)

	return &SlidingWindowResult{
		Allowed:    allowed == 1,
		RetryAfter: time.Duration(retryAfter) * time.Second,
		Remaining:  remaining,
	}, nil
}

func (l *SlidingWindowLimiter) Reset(ctx context.Context, key string) error {
	return l.client.Del(ctx, key).Err()
}

func ParseSlidingWindowConfig(config map[string]string) (int, time.Duration, error) {
	limitStr, ok := config["limit"]
	if !ok {
		return 0, 0, fmt.Errorf("limit not found in config")
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid limit: %w", err)
	}

	windowStr, ok := config["window"]
	if !ok {
		return 0, 0, fmt.Errorf("window not found in config")
	}
	windowMs, err := strconv.ParseInt(windowStr, 10, 64)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid window: %w", err)
	}

	return limit, time.Duration(windowMs) * time.Millisecond, nil
}
