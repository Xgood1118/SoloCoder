package algorithm

import (
	"context"
	"errors"
	"time"
)

var (
	ErrInvalidRate          = errors.New("rate must be greater than 0")
	ErrInvalidBurst         = errors.New("burst must be greater than or equal to 0")
	ErrInvalidWindow        = errors.New("window must be greater than 0")
	ErrInvalidAlgorithmType = errors.New("invalid algorithm type")
	ErrInvalidTokens        = errors.New("tokens must be greater than 0")
	ErrInvalidKey           = errors.New("key must not be empty")
	ErrInvalidBucketSize    = errors.New("bucket size must be greater than 0 and less than window")
)

type AlgorithmType string

const (
	TokenBucketType   AlgorithmType = "token_bucket"
	SlidingWindowType AlgorithmType = "sliding_window"
)


type LimitResult struct {
	Allowed       bool
	Remaining     int64
	Limit         int64
	RetryAfter    time.Duration
	ResetTime     time.Time
	Algorithm     AlgorithmType
	Key           string
	Consumed      int64
}

type Algorithm interface {
	Allow(ctx context.Context, key string, tokens int64) (LimitResult, error)
	SetRate(rate int64, burst int64, window time.Duration)
	GetType() AlgorithmType
}

type AlgorithmConfig struct {
	Type       AlgorithmType
	Rate       int64
	Burst      int64
	Window     time.Duration
	BucketSize time.Duration
}

func ValidateConfig(cfg AlgorithmConfig) error {
	if cfg.Rate <= 0 {
		return ErrInvalidRate
	}
	if cfg.Burst < 0 {
		return ErrInvalidBurst
	}
	if cfg.Window <= 0 {
		return ErrInvalidWindow
	}
	if cfg.Type != TokenBucketType && cfg.Type != SlidingWindowType {
		return ErrInvalidAlgorithmType
	}

	return nil
}
