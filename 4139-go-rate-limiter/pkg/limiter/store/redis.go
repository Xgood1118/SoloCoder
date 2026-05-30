package store

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/solo/ratelimiter/pkg/limiter/algorithm"
)

type RedisClient interface {
	Eval(ctx context.Context, script string, keys []string, args ...interface{}) *redis.Cmd
	SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.BoolCmd
	Get(ctx context.Context, key string) *redis.StringCmd
	Del(ctx context.Context, keys ...string) *redis.IntCmd
	Ping(ctx context.Context) *redis.StatusCmd
	Close() error
}

type RedisStore struct {
	client         RedisClient
	defaultCfg     algorithm.AlgorithmConfig
	stats          StoreStats
	mu             sync.RWMutex
	consecutiveErr int32
	status         StoreStatus
	nowFunc        func() time.Time
}

func NewRedisStore(addr, password string, db int, poolSize int, timeout time.Duration, defaultCfg algorithm.AlgorithmConfig) (*RedisStore, error) {
	if err := algorithm.ValidateConfig(defaultCfg); err != nil {
		return nil, err
	}

	if poolSize <= 0 {
		poolSize = 10
	}
	if timeout <= 0 {
		timeout = time.Second
	}

	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           db,
		PoolSize:     poolSize,
		DialTimeout:  timeout,
		ReadTimeout:  timeout,
		WriteTimeout: timeout,
	})

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	return &RedisStore{
		client:     client,
		defaultCfg: defaultCfg,
		status:     StatusHealthy,
		nowFunc:    time.Now,
	}, nil
}

func NewRedisStoreWithClient(client RedisClient, defaultCfg algorithm.AlgorithmConfig) (*RedisStore, error) {
	if err := algorithm.ValidateConfig(defaultCfg); err != nil {
		return nil, err
	}

	return &RedisStore{
		client:     client,
		defaultCfg: defaultCfg,
		status:     StatusHealthy,
		nowFunc:    time.Now,
	}, nil
}

var tokenBucketScript = `
local key = KEYS[1]
local tokens = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local burst = tonumber(ARGV[3])
local window = tonumber(ARGV[4])
local now = tonumber(ARGV[5])

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local currentTokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if currentTokens == nil then
    currentTokens = burst
    lastRefill = now
end

local elapsed = now - lastRefill
local refillAmount = math.floor((elapsed / window) * rate)

if refillAmount > 0 then
    currentTokens = math.min(currentTokens + refillAmount, burst)
    lastRefill = lastRefill + math.floor((refillAmount / rate) * window)
end

local allowed = 0
local remaining = currentTokens
local retryAfter = 0

if currentTokens >= tokens then
    currentTokens = currentTokens - tokens
    allowed = 1
    remaining = currentTokens
else
    local deficit = tokens - currentTokens
    retryAfter = math.ceil((deficit / rate) * window)
end

redis.call('HMSET', key, 'tokens', currentTokens, 'last_refill', lastRefill)
redis.call('EXPIRE', key, math.ceil(window / 1000) + 60)

return {allowed, remaining, burst, retryAfter, now + retryAfter * 1000}
`

var slidingWindowScript = `
local key = KEYS[1]
local tokens = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local burst = tonumber(ARGV[3])
local window = tonumber(ARGV[4])
local bucketSize = tonumber(ARGV[5])
local now = tonumber(ARGV[6])

local numBuckets = math.floor(window / bucketSize)
local currentBucketIdx = math.floor(now / bucketSize) % numBuckets
local currentBucketStart = math.floor(now / bucketSize) * bucketSize

local total = 0
local oldestTime = currentBucketStart

for i = 0, numBuckets - 1 do
    local bucketKey = key .. ':b:' .. i
    local bucketData = redis.call('HMGET', bucketKey, 'count', 'start_time')
    local count = tonumber(bucketData[1]) or 0
    local startTime = tonumber(bucketData[2]) or 0
    
    if now - startTime < window then
        total = total + count
        if count > 0 and startTime < oldestTime then
            oldestTime = startTime
        end
    end
end

local allowed = 0
local remaining = burst - total
local retryAfter = 0

if total + tokens <= burst then
    local bucketKey = key .. ':b:' .. currentBucketIdx
    redis.call('HMSET', bucketKey, 'count', (total % numBuckets) + tokens, 'start_time', currentBucketStart)
    redis.call('EXPIRE', bucketKey, math.ceil(window / 1000) + 60)
    allowed = 1
    remaining = burst - total - tokens
else
    retryAfter = math.ceil((oldestTime + window - now) / 1000)
    if retryAfter < 0 then
        retryAfter = 0
    end
end

return {allowed, remaining, burst, retryAfter, now + retryAfter * 1000}
`

func (s *RedisStore) Allow(ctx context.Context, key string, tokens int64, cfg algorithm.AlgorithmConfig) (algorithm.LimitResult, error) {
	if cfg.Type == "" {
		cfg = s.defaultCfg
	}

	now := s.nowFunc().UnixNano() / int64(time.Millisecond)

	var result algorithm.LimitResult
	result.Algorithm = cfg.Type
	result.Key = key
	result.Consumed = tokens

	var script string
	var args []interface{}

	switch cfg.Type {
	case algorithm.TokenBucketType:
		script = tokenBucketScript
		args = []interface{}{
			tokens,
			cfg.Rate,
			cfg.Burst,
			cfg.Window.Milliseconds(),
			now,
		}
	case algorithm.SlidingWindowType:
		bucketSize := cfg.BucketSize
		if bucketSize <= 0 || bucketSize >= cfg.Window {
			bucketSize = cfg.Window / 10
		}
		script = slidingWindowScript
		args = []interface{}{
			tokens,
			cfg.Rate,
			cfg.Burst,
			cfg.Window.Milliseconds(),
			bucketSize.Milliseconds(),
			now,
		}
	default:
		return algorithm.LimitResult{}, algorithm.ErrInvalidAlgorithmType
	}


	cmd := s.client.Eval(ctx, script, []string{key}, args...)
	err := cmd.Err()

	s.mu.Lock()
	s.stats.TotalRequests++
	s.mu.Unlock()

	if err != nil {
		s.recordError(err)
		return algorithm.LimitResult{}, fmt.Errorf("redis eval failed: %w", err)
	}

	atomic.StoreInt32(&s.consecutiveErr, 0)

	vals, err := cmd.Slice()
	if err != nil {
		s.recordError(err)
		return algorithm.LimitResult{}, fmt.Errorf("redis result parse failed: %w", err)
	}

	if len(vals) >= 5 {
		allowed, _ := vals[0].(int64)
		remaining, _ := vals[1].(int64)
		limit, _ := vals[2].(int64)
		retryAfterMs, _ := vals[3].(int64)
		resetTimeMs, _ := vals[4].(int64)

		result.Allowed = allowed == 1
		result.Remaining = remaining
		result.Limit = limit
		result.RetryAfter = time.Duration(retryAfterMs) * time.Millisecond
		result.ResetTime = time.Unix(0, resetTimeMs*int64(time.Millisecond))
	}

	s.mu.Lock()
	if result.Allowed {
		s.stats.AllowedRequests++
	} else {
		s.stats.BlockedRequests++
	}
	s.mu.Unlock()

	return result, nil
}

func (s *RedisStore) recordError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	atomic.AddInt32(&s.consecutiveErr, 1)
	s.stats.RedisErrors++
	s.stats.LastError = err
	s.stats.LastErrorTime = s.nowFunc()

	if atomic.LoadInt32(&s.consecutiveErr) >= 3 {
		s.status = StatusFailed
	}
}

func (s *RedisStore) SetRate(ctx context.Context, key string, cfg algorithm.AlgorithmConfig) error {
	if err := algorithm.ValidateConfig(cfg); err != nil {
		return err
	}

	configKey := key + ":config"
	configData := fmt.Sprintf("%s|%d|%d|%d|%d",
		cfg.Type,
		cfg.Rate,
		cfg.Burst,
		cfg.Window.Milliseconds(),
		cfg.BucketSize.Milliseconds(),
	)

	return s.client.SetNX(ctx, configKey, configData, 0).Err()
}

func (s *RedisStore) Reset(ctx context.Context, key string) error {
	numBuckets := 10
	keys := make([]string, numBuckets+1)
	keys[0] = key
	for i := 0; i < numBuckets; i++ {
		keys[i+1] = fmt.Sprintf("%s:b:%d", key, i)
	}

	return s.client.Del(ctx, keys...).Err()
}

func (s *RedisStore) GetStatus(ctx context.Context) StoreStatus {
	if atomic.LoadInt32(&s.consecutiveErr) == 0 {
		return StatusHealthy
	}

	err := s.client.Ping(ctx).Err()
	if err == nil {
		atomic.StoreInt32(&s.consecutiveErr, 0)
		s.mu.Lock()
		s.status = StatusHealthy
		s.mu.Unlock()
		return StatusHealthy
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.status
}

func (s *RedisStore) GetType() StoreType {
	return StoreTypeRedis
}

func (s *RedisStore) Close() error {
	return s.client.Close()
}

func (s *RedisStore) GetStats() StoreStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.stats
}

func (s *RedisStore) ResetStats() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stats = StoreStats{}
	atomic.StoreInt32(&s.consecutiveErr, 0)
}

func (s *RedisStore) CheckHealth(ctx context.Context) error {
	err := s.client.Ping(ctx).Err()
	if err == nil {
		atomic.StoreInt32(&s.consecutiveErr, 0)
		s.mu.Lock()
		s.status = StatusHealthy
		s.mu.Unlock()
	} else {
		s.mu.Lock()
		s.status = StatusFailed
		s.mu.Unlock()
	}
	return err
}

func ParseConfig(data string) (algorithm.AlgorithmConfig, error) {
	parts := strings.Split(data, "|")
	if len(parts) < 4 {
		return algorithm.AlgorithmConfig{}, fmt.Errorf("invalid config format")
	}

	rate, _ := strconv.ParseInt(parts[1], 10, 64)
	burst, _ := strconv.ParseInt(parts[2], 10, 64)
	windowMs, _ := strconv.ParseInt(parts[3], 10, 64)

	var bucketSize time.Duration
	if len(parts) >= 5 {
		bucketSizeMs, _ := strconv.ParseInt(parts[4], 10, 64)
		bucketSize = time.Duration(bucketSizeMs) * time.Millisecond
	}

	return algorithm.AlgorithmConfig{
		Type:       algorithm.AlgorithmType(parts[0]),
		Rate:       rate,
		Burst:      burst,
		Window:     time.Duration(windowMs) * time.Millisecond,
		BucketSize: bucketSize,
	}, nil
}
