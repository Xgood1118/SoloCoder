package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/solo/ratelimiter/pkg/limiter"
	"github.com/solo/ratelimiter/pkg/limiter/algorithm"
	"github.com/solo/ratelimiter/pkg/limiter/config"
	"github.com/solo/ratelimiter/pkg/limiter/dimension"
)

type HTTPOptions struct {
	Limiter        *limiter.RateLimiter
	IncludeHeaders bool
	ContextKey     string
	ErrorHandler   func(w http.ResponseWriter, r *http.Request, result *limiter.LimitResult)
}

func NewHTTPMiddleware(opts HTTPOptions) func(next http.Handler) http.Handler {
	if opts.ContextKey == "" {
		opts.ContextKey = "rate_limit_result"
	}
	if opts.ErrorHandler == nil {
		opts.ErrorHandler = DefaultErrorHandler
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqCtx := &config.RequestContext{
				Request: r,
				Path:    r.URL.Path,
				IP:      dimension.GetClientIP(r),
				Headers: extractHeaders(r),
				Query:   extractQuery(r),
			}

			result, err := opts.Limiter.Allow(r.Context(), reqCtx)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			if opts.IncludeHeaders {
				headers := result.HTTPHeaders()
				for k, v := range headers {
					w.Header().Set(k, v)
				}
			}

			if opts.ContextKey != "" {
				ctx := context.WithValue(r.Context(), opts.ContextKey, result)
				r = r.WithContext(ctx)
			}

			if !result.Allowed {
				opts.ErrorHandler(w, r, result)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func DefaultErrorHandler(w http.ResponseWriter, r *http.Request, result *limiter.LimitResult) {
	limitErr := result.ToLimitError()

	headers := limitErr.HTTPHeaders()
	for k, v := range headers {
		w.Header().Set(k, v)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusTooManyRequests)

	response := map[string]interface{}{
		"error": map[string]interface{}{
			"code":        limitErr.Code,
			"message":     limitErr.Message,
			"retry_after": limitErr.RetryAfter,
			"limit":       limitErr.Limit,
			"remaining":   limitErr.Remaining,
			"reset_time":  limitErr.ResetTime,
			"key":         limitErr.Key,
			"rule_id":     limitErr.RuleID,
			"algorithm":   limitErr.Algorithm,
		},
	}

	_ = json.NewEncoder(w).Encode(response)
}

func extractHeaders(r *http.Request) map[string]string {
	headers := make(map[string]string)
	for k, v := range r.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}
	return headers
}

func extractQuery(r *http.Request) map[string]string {
	query := make(map[string]string)
	for k, v := range r.URL.Query() {
		if len(v) > 0 {
			query[k] = v[0]
		}
	}
	return query
}

func GetRateLimitResult(ctx context.Context, key string) *limiter.LimitResult {
	if val := ctx.Value(key); val != nil {
		if result, ok := val.(*limiter.LimitResult); ok {
			return result
		}
	}
	return nil
}

func NewSimpleHTTPMiddleware(rate, burst int64, window time.Duration, algo string) func(next http.Handler) http.Handler {
	algoType := GetAlgorithmType(algo)

	rl, err := limiter.NewSimpleLimiter(rate, burst, window, algoType)
	if err != nil {
		return func(next http.Handler) http.Handler {
			return next
		}
	}

	return NewHTTPMiddleware(HTTPOptions{
		Limiter:        rl,
		IncludeHeaders: true,
	})
}

func GetAlgorithmType(algo string) algorithm.AlgorithmType {
	switch strings.ToLower(algo) {
	case "sliding_window", "slidingwindow", "sw":
		return algorithm.SlidingWindowType
	default:
		return algorithm.TokenBucketType
	}
}


