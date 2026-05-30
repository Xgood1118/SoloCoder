package store

import (
	"context"
	"time"

	"github.com/solo/ratelimiter/pkg/limiter/algorithm"
)

type StoreType string

const (
	StoreTypeLocal  StoreType = "local"
	StoreTypeRedis  StoreType = "redis"
	StoreTypeHybrid StoreType = "hybrid"
)

type StoreStatus string

const (
	StatusHealthy  StoreStatus = "healthy"
	StatusDegraded StoreStatus = "degraded"
	StatusFailed   StoreStatus = "failed"
)

type Store interface {
	Allow(ctx context.Context, key string, tokens int64, cfg algorithm.AlgorithmConfig) (algorithm.LimitResult, error)
	SetRate(ctx context.Context, key string, cfg algorithm.AlgorithmConfig) error
	Reset(ctx context.Context, key string) error
	GetStatus(ctx context.Context) StoreStatus
	GetType() StoreType
	Close() error
}

type StoreConfig struct {
	Type            StoreType
	RedisAddr       string
	RedisPassword   string
	RedisDB         int
	RedisPoolSize   int
	RedisTimeout    time.Duration
	DegradeThreshold int
	RecoverThreshold int
	CheckInterval   time.Duration
	LocalAlgorithm  algorithm.AlgorithmConfig
}

type StoreStats struct {
	TotalRequests   int64
	AllowedRequests int64
	BlockedRequests int64
	RedisErrors     int64
	DegradedCount   int64
	RecoveredCount  int64
	LastError       error
	LastErrorTime   time.Time
}
