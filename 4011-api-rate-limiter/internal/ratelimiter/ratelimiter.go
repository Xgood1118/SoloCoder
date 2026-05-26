package ratelimiter

import "time"

const (
	AlgorithmTokenBucketStr   = string(AlgorithmTokenBucket)
	AlgorithmSlidingWindowStr = string(AlgorithmSlidingWindow)
	DimensionUserIDStr        = string(DimensionUserID)
	DimensionIPStr            = string(DimensionIP)
)

type (
	LimitConfigT       = LimitConfig
	AlgorithmTypeT     = AlgorithmType
	LimitDimensionT    = LimitDimension
	RedisClientT       = RedisClient
	TokenBucketLimiterT = TokenBucketLimiter
	SlidingWindowLimiterT = SlidingWindowLimiter
	TokenBucketResultT = TokenBucketResult
	SlidingWindowResultT = SlidingWindowResult
	QueueItemT         = QueueItem
	QueueT             = Queue
	RateLimiterMiddlewareT = RateLimiterMiddleware
	MiddlewareOptionT  = MiddlewareOption
)

func NewRedisClientWrap(addr, password string, db int) RedisClient {
	return NewRedisClient(addr, password, db)
}

func NewTokenBucketLimiterWrap(client RedisClient) *TokenBucketLimiter {
	return NewTokenBucketLimiter(client)
}

func NewSlidingWindowLimiterWrap(client RedisClient) *SlidingWindowLimiter {
	return NewSlidingWindowLimiter(client)
}

func NewConfigManagerWrap(client RedisClient) *ConfigManager {
	return NewConfigManager(client)
}

func NewQueueWrap(client RedisClient) *Queue {
	return NewQueue(client)
}

func NewRateLimiterMiddlewareWrap(
	client RedisClient,
	opts ...MiddlewareOption,
) (*RateLimiterMiddleware, error) {
	return NewRateLimiterMiddleware(client, opts...)
}

func WithUserIDHeaderWrap(header string) MiddlewareOption {
	return WithUserIDHeader(header)
}

func WithRebuildOnStartWrap(rebuild bool) MiddlewareOption {
	return WithRebuildOnStart(rebuild)
}

func NewDefaultConfig(algorithm AlgorithmType, dimension LimitDimension, qps float64, burst int) *LimitConfig {
	config := &LimitConfig{
		Algorithm:    algorithm,
		Dimension:    dimension,
		QPS:          qps,
		Burst:        burst,
		QueueSize:    100,
		QueueTimeout: 30 * time.Second,
		Enabled:      true,
	}

	if algorithm == AlgorithmTokenBucket {
		config.Capacity = float64(burst)
		config.Rate = qps
	} else if algorithm == AlgorithmSlidingWindow {
		config.Limit = burst
		config.Window = time.Second
	}

	return config
}
