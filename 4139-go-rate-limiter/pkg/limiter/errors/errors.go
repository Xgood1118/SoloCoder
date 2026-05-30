package errors

import (
	"errors"
	"fmt"
	"net/http"
)

var (
	ErrInvalidRate           = errors.New("rate must be greater than 0")
	ErrInvalidBurst          = errors.New("burst must be greater than or equal to 0")
	ErrInvalidWindow         = errors.New("window must be greater than 0")
	ErrInvalidAlgorithmType  = errors.New("invalid algorithm type")
	ErrInvalidTokens         = errors.New("tokens must be greater than 0")
	ErrRedisUnavailable      = errors.New("redis is unavailable")
	ErrInvalidKey            = errors.New("invalid key")
	ErrInvalidConfig         = errors.New("invalid configuration")
	ErrRuleNotFound          = errors.New("rule not found")
	ErrInvalidDimension      = errors.New("invalid dimension")
	ErrDegradedMode          = errors.New("operating in degraded mode")
	ErrHotReloadFailed       = errors.New("hot reload failed")
	ErrInvalidBucketSize     = errors.New("bucket size must be greater than 0 and less than window")
)

type LimitError struct {
	Code       int
	Message    string
	RetryAfter int64
	Limit      int64
	Remaining  int64
	ResetTime  int64
	Key        string
}

func (e *LimitError) Error() string {
	return fmt.Sprintf("rate limit exceeded: code=%d, message=%s, key=%s, limit=%d, remaining=%d, retry_after=%ds",
		e.Code, e.Message, e.Key, e.Limit, e.Remaining, e.RetryAfter)
}

func NewLimitError(result interface{}) *LimitError {
	return &LimitError{
		Code:    http.StatusTooManyRequests,
		Message: "Rate limit exceeded. Please try again later.",
	}
}

func (e *LimitError) HTTPHeaders() map[string]string {
	return map[string]string{
		"X-RateLimit-Limit":     fmt.Sprintf("%d", e.Limit),
		"X-RateLimit-Remaining": fmt.Sprintf("%d", e.Remaining),
		"X-RateLimit-Reset":     fmt.Sprintf("%d", e.ResetTime),
		"Retry-After":           fmt.Sprintf("%d", e.RetryAfter),
	}
}

type ErrorCode string

const (
	CodeRateLimitExceeded ErrorCode = "RATE_LIMIT_EXCEEDED"
	CodeConfigError       ErrorCode = "CONFIG_ERROR"
	CodeRedisError        ErrorCode = "REDIS_ERROR"
	CodeInternalError     ErrorCode = "INTERNAL_ERROR"
)

type StructuredError struct {
	Code      ErrorCode `json:"code"`
	Message   string    `json:"message"`
	Details   string    `json:"details,omitempty"`
	Timestamp int64     `json:"timestamp"`
}

func (e *StructuredError) Error() string {
	return fmt.Sprintf("[%s] %s: %s", e.Code, e.Message, e.Details)
}
