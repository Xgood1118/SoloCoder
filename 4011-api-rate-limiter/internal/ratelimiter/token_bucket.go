package ratelimiter

import (
	"context"
	"fmt"
	"strconv"
	"time"
)

const (
	tokenBucketScript = `
-- token_bucket_algorithm
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
    tokens = capacity
    last_refill = now
end

local elapsed = now - last_refill
local refill = elapsed * rate
tokens = math.min(capacity, tokens + refill)

local allowed = 0
local retry_after = 0

if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
else
    local needed = requested - tokens
    retry_after = math.ceil(needed / rate)
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('EXPIRE', key, ttl)

return {allowed, retry_after, tokens}
`
)

type TokenBucketLimiter struct {
	client     RedisClient
	scriptSHA  string
	defaultTTL time.Duration
}

func NewTokenBucketLimiter(client RedisClient) *TokenBucketLimiter {
	return &TokenBucketLimiter{
		client:     client,
		scriptSHA:  ScriptSHA(tokenBucketScript),
		defaultTTL: 2 * time.Hour,
	}
}

type TokenBucketResult struct {
	Allowed     bool
	RetryAfter  time.Duration
	Remaining   float64
}

func (l *TokenBucketLimiter) Allow(ctx context.Context, key string, capacity, rate float64, requested int) (*TokenBucketResult, error) {
	now := float64(time.Now().UnixNano()) / float64(time.Second)

	keys := []string{key}
	args := []interface{}{
		capacity,
		rate,
		now,
		requested,
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
		rawResult, err = l.client.Eval(ctx, tokenBucketScript, keys, args...).Result()
		if err == nil {
			result, _ = rawResult.([]interface{})
			l.scriptSHA, _ = l.client.ScriptLoad(ctx, tokenBucketScript).Result()
		}
	}

	if err != nil {
		return nil, fmt.Errorf("token bucket eval failed: %w", err)
	}

	if result == nil || len(result) < 3 {
		return nil, fmt.Errorf("unexpected result length: %d", len(result))
	}

	allowed, _ := result[0].(int64)
	retryAfter, _ := result[1].(int64)
	remaining, _ := result[2].(float64)

	return &TokenBucketResult{
		Allowed:    allowed == 1,
		RetryAfter: time.Duration(retryAfter) * time.Second,
		Remaining:  remaining,
	}, nil
}

func (l *TokenBucketLimiter) Reset(ctx context.Context, key string) error {
	return l.client.Del(ctx, key).Err()
}

func ParseTokenBucketConfig(config map[string]string) (float64, float64, error) {
	capacityStr, ok := config["capacity"]
	if !ok {
		return 0, 0, fmt.Errorf("capacity not found in config")
	}
	capacity, err := strconv.ParseFloat(capacityStr, 64)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid capacity: %w", err)
	}

	rateStr, ok := config["rate"]
	if !ok {
		return 0, 0, fmt.Errorf("rate not found in config")
	}
	rate, err := strconv.ParseFloat(rateStr, 64)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid rate: %w", err)
	}

	return capacity, rate, nil
}
