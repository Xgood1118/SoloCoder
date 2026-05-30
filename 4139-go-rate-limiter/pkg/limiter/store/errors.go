package store

import "errors"

var (
	ErrInvalidConfig    = errors.New("invalid store configuration")
	ErrRedisUnavailable = errors.New("redis is unavailable")
	ErrDegradedMode     = errors.New("operating in degraded mode")
)
