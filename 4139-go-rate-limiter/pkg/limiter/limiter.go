package limiter

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/solo/ratelimiter/pkg/limiter/algorithm"
	"github.com/solo/ratelimiter/pkg/limiter/config"
	"github.com/solo/ratelimiter/pkg/limiter/dimension"
	"github.com/solo/ratelimiter/pkg/limiter/logger"
	"github.com/solo/ratelimiter/pkg/limiter/store"
)

type RateLimiter struct {
	mu            sync.RWMutex
	configManager *config.ConfigManager
	store         store.Store
	logger        *logger.Logger
	options       Options
}

type Options struct {
	ConfigManager *config.ConfigManager
	Store         store.Store
	Logger        *logger.Logger
	DefaultTokens int64
}

func New(opts Options) (*RateLimiter, error) {
	if opts.DefaultTokens <= 0 {
		opts.DefaultTokens = 1
	}
	if opts.Logger == nil {
		opts.Logger = logger.Default()
	}

	rl := &RateLimiter{
		configManager: opts.ConfigManager,
		store:         opts.Store,
		logger:        opts.Logger,
		options:       opts,
	}

	if rl.configManager != nil {
		rl.configManager.AddReloadCallback(func(oldCfg, newCfg *config.Config) {
			rl.logger.RuleReloaded(len(newCfg.Rules), newCfg.Version)
		})
	}

	return rl, nil
}

func (rl *RateLimiter) Allow(ctx context.Context, req interface{}) (*LimitResult, error) {
	tokens := rl.options.DefaultTokens
	return rl.AllowN(ctx, req, tokens)
}

func (rl *RateLimiter) AllowN(ctx context.Context, req interface{}, tokens int64) (*LimitResult, error) {
	if tokens <= 0 {
		return nil, algorithm.ErrInvalidTokens
	}

	matchResult, err := rl.matchRule(req)
	if err != nil {
		rl.logger.InternalError(err, "match_rule")
		return &LimitResult{Allowed: true}, nil
	}

	if matchResult == nil {
		return &LimitResult{Allowed: true}, nil
	}

	rule := matchResult.Rule
	if rule.Action == config.ActionAllow {
		return &LimitResult{Allowed: true}, nil
	}

	if rule.Action == config.ActionLogOnly {
		result, err := rl.checkLimit(ctx, matchResult.Key, tokens, rule.Algorithm)
		if err == nil && !result.Allowed {
			rl.logger.LimitTriggered(
				matchResult.Key,
				rule.ID,
				string(rule.Algorithm.Type),
				result.Limit,
				result.Remaining,
				result.RetryAfter.Milliseconds(),
				nil,
			)
		}
		result.Allowed = true
		result.RuleID = rule.ID
		result.Action = string(rule.Action)
		return result, err
	}

	result, err := rl.checkLimit(ctx, matchResult.Key, tokens, rule.Algorithm)
	if err != nil {
		rl.logger.InternalError(err, "check_limit")
		return &LimitResult{Allowed: true}, nil
	}

	result.RuleID = rule.ID
	result.Action = string(rule.Action)

	if !result.Allowed {
		rl.logger.LimitTriggered(
			matchResult.Key,
			rule.ID,
			string(rule.Algorithm.Type),
			result.Limit,
			result.Remaining,
			result.RetryAfter.Milliseconds(),
			nil,
		)
	}

	return result, nil
}

func (rl *RateLimiter) matchRule(req interface{}) (*config.RuleMatchResult, error) {
	if rl.configManager == nil {
		return nil, nil
	}

	reqCtx, ok := req.(*config.RequestContext)
	if !ok {
		reqCtx = rl.buildRequestContext(req)
	}

	match := rl.configManager.Match(reqCtx)
	return match, nil
}

func (rl *RateLimiter) buildRequestContext(req interface{}) *config.RequestContext {
	switch r := req.(type) {
	case *http.Request:
		return &config.RequestContext{
			Request: r,
			Path:    r.URL.Path,
			IP:      dimension.GetClientIP(r),
		}
	default:
		return &config.RequestContext{}
	}
}

func (rl *RateLimiter) checkLimit(ctx context.Context, key string, tokens int64, cfg algorithm.AlgorithmConfig) (*LimitResult, error) {
	if rl.store == nil {
		return &LimitResult{Allowed: true}, nil
	}

	result, err := rl.store.Allow(ctx, key, tokens, cfg)
	if err != nil {
		return nil, err
	}

	return &LimitResult{
		Allowed:    result.Allowed,
		Remaining:  result.Remaining,
		Limit:      result.Limit,
		RetryAfter: result.RetryAfter,
		ResetTime:  result.ResetTime,
		Algorithm:  string(result.Algorithm),
		Key:        result.Key,
		Consumed:   result.Consumed,
	}, nil
}

func (rl *RateLimiter) Reset(ctx context.Context, key string) error {
	if rl.store == nil {
		return nil
	}
	return rl.store.Reset(ctx, key)
}

func (rl *RateLimiter) SetRate(ctx context.Context, key string, cfg algorithm.AlgorithmConfig) error {
	if rl.store == nil {
		return nil
	}
	return rl.store.SetRate(ctx, key, cfg)
}

func (rl *RateLimiter) GetStatus(ctx context.Context) store.StoreStatus {
	if rl.store == nil {
		return store.StatusHealthy
	}
	return rl.store.GetStatus(ctx)
}

func (rl *RateLimiter) GetStore() store.Store {
	return rl.store
}

func (rl *RateLimiter) GetConfigManager() *config.ConfigManager {
	return rl.configManager
}

func (rl *RateLimiter) GetLogger() *logger.Logger {
	return rl.logger
}

func (rl *RateLimiter) Close() error {
	var firstErr error

	if rl.configManager != nil {
		if err := rl.configManager.Close(); err != nil {
			firstErr = err
		}
	}

	if rl.store != nil {
		if err := rl.store.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}

	if rl.logger != nil {
		if err := rl.logger.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}

	return firstErr
}

type LimitResult struct {
	Allowed    bool          `json:"allowed"`
	Remaining  int64         `json:"remaining"`
	Limit      int64         `json:"limit"`
	RetryAfter time.Duration `json:"retry_after"`
	ResetTime  time.Time     `json:"reset_time"`
	Algorithm  string        `json:"algorithm"`
	Key        string        `json:"key"`
	Consumed   int64         `json:"consumed"`
	RuleID     string        `json:"rule_id,omitempty"`
	Action     string        `json:"action,omitempty"`
}

func (r *LimitResult) HTTPHeaders() map[string]string {
	headers := make(map[string]string)

	headers["X-RateLimit-Limit"] = toString(r.Limit)
	headers["X-RateLimit-Remaining"] = toString(r.Remaining)
	headers["X-RateLimit-Reset"] = toString(r.ResetTime.Unix())
	headers["X-RateLimit-Algorithm"] = r.Algorithm

	if !r.Allowed {
		headers["Retry-After"] = toString(int64(r.RetryAfter.Seconds()))
	}

	if r.RuleID != "" {
		headers["X-RateLimit-Rule-ID"] = r.RuleID
	}

	return headers
}

func (r *LimitResult) ToLimitError() *LimiterError {
	return &LimiterError{
		Code:       http.StatusTooManyRequests,
		Message:    "Rate limit exceeded. Please try again later.",
		RetryAfter: int64(r.RetryAfter.Seconds()),
		Limit:      r.Limit,
		Remaining:  r.Remaining,
		ResetTime:  r.ResetTime.Unix(),
		Key:        r.Key,
		RuleID:     r.RuleID,
		Algorithm:  r.Algorithm,
	}
}

type LimiterError struct {
	Code       int    `json:"code"`
	Message    string `json:"message"`
	RetryAfter int64  `json:"retry_after"`
	Limit      int64  `json:"limit"`
	Remaining  int64  `json:"remaining"`
	ResetTime  int64  `json:"reset_time"`
	Key        string `json:"key"`
	RuleID     string `json:"rule_id,omitempty"`
	Algorithm  string `json:"algorithm"`
}

func (e *LimiterError) Error() string {
	return "rate limit exceeded"
}

func (e *LimiterError) HTTPHeaders() map[string]string {
	return map[string]string{
		"X-RateLimit-Limit":     toString(e.Limit),
		"X-RateLimit-Remaining": toString(e.Remaining),
		"X-RateLimit-Reset":     toString(e.ResetTime),
		"Retry-After":           toString(e.RetryAfter),
		"X-RateLimit-Rule-ID":   e.RuleID,
		"X-RateLimit-Algorithm": e.Algorithm,
	}
}

func toString(v interface{}) string {
	switch val := v.(type) {
	case int64:
		return strconv.FormatInt(val, 10)
	case int:
		return strconv.Itoa(val)
	default:
		return ""
	}
}


func NewLocalLimiter(cfg algorithm.AlgorithmConfig) (*RateLimiter, error) {
	localStore, err := store.NewLocalStore(cfg)
	if err != nil {
		return nil, err
	}

	return New(Options{
		Store:         localStore,
		DefaultTokens: 1,
	})
}

func NewSimpleLimiter(rate, burst int64, window time.Duration, algoType algorithm.AlgorithmType) (*RateLimiter, error) {
	cfg := algorithm.AlgorithmConfig{
		Type:   algoType,
		Rate:   rate,
		Burst:  burst,
		Window: window,
	}

	return NewLocalLimiter(cfg)
}
