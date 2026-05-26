package ratelimiter

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type RateLimiterMiddleware struct {
	configManager      *ConfigManager
	tokenBucket        *TokenBucketLimiter
	slidingWindow      *SlidingWindowLimiter
	queue              *Queue
	userIDHeader       string
	rebuildOnStart     bool
}

type MiddlewareOption func(*RateLimiterMiddleware)

func WithUserIDHeader(header string) MiddlewareOption {
	return func(m *RateLimiterMiddleware) {
		m.userIDHeader = header
	}
}

func WithRebuildOnStart(rebuild bool) MiddlewareOption {
	return func(m *RateLimiterMiddleware) {
		m.rebuildOnStart = rebuild
	}
}

func NewRateLimiterMiddleware(
	client RedisClient,
	opts ...MiddlewareOption,
) (*RateLimiterMiddleware, error) {
	m := &RateLimiterMiddleware{
		configManager:  NewConfigManager(client),
		tokenBucket:    NewTokenBucketLimiter(client),
		slidingWindow:  NewSlidingWindowLimiter(client),
		queue:          NewQueue(client),
		userIDHeader:   "X-User-ID",
		rebuildOnStart: false,
	}

	for _, opt := range opts {
		opt(m)
	}

	if m.rebuildOnStart {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := m.queue.RebuildFromRedis(ctx); err != nil {
			return nil, fmt.Errorf("failed to rebuild queue from redis: %w", err)
		}
	}

	return m, nil
}

func (m *RateLimiterMiddleware) Close() {
	m.configManager.Close()
	m.queue.Close()
}

func (m *RateLimiterMiddleware) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		config, err := m.configManager.GetConfig(path)
		if err != nil || !config.Enabled {
			c.Next()
			return
		}

		key := m.buildLimitKey(c, config)

		allowed, retryAfter, err := m.checkLimit(c, key, config)
		if err != nil {
			c.Next()
			return
		}

		if allowed {
			c.Next()
			go m.processQueue(c.Request.Context(), key, config)
			return
		}

		queued, queueRetryAfter, queueErr := m.tryQueue(c, key, config, retryAfter)
		if queueErr != nil {
			m.returnTooManyRequests(c, retryAfter)
			return
		}

		if queued {
			return
		}

		m.returnTooManyRequests(c, queueRetryAfter)
	}
}

func (m *RateLimiterMiddleware) buildLimitKey(c *gin.Context, config *LimitConfig) string {
	path := c.Request.URL.Path
	dimension := config.Dimension

	var identifier string
	if dimension == DimensionUserID {
		userID := c.GetHeader(m.userIDHeader)
		if userID != "" {
			identifier = "user:" + userID
		}
	}

	if identifier == "" {
		ip := m.getClientIP(c)
		identifier = "ip:" + ip
	}

	return fmt.Sprintf("rate_limit:%s:%s", path, identifier)
}

func (m *RateLimiterMiddleware) getClientIP(c *gin.Context) string {
	xForwardedFor := c.GetHeader("X-Forwarded-For")
	if xForwardedFor != "" {
		parts := strings.Split(xForwardedFor, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	xRealIP := c.GetHeader("X-Real-IP")
	if xRealIP != "" {
		return xRealIP
	}

	return c.ClientIP()
}

func (m *RateLimiterMiddleware) checkLimit(c *gin.Context, key string, config *LimitConfig) (bool, time.Duration, error) {
	ctx := c.Request.Context()

	switch config.Algorithm {
	case AlgorithmTokenBucket:
		result, err := m.tokenBucket.Allow(ctx, key, config.Capacity, config.Rate, 1)
		if err != nil {
			return true, 0, err
		}
		return result.Allowed, result.RetryAfter, nil

	case AlgorithmSlidingWindow:
		result, err := m.slidingWindow.Allow(ctx, key, config.Limit, config.Window)
		if err != nil {
			return true, 0, err
		}
		return result.Allowed, result.RetryAfter, nil

	default:
		return true, 0, nil
	}
}

func (m *RateLimiterMiddleware) tryQueue(c *gin.Context, key string, config *LimitConfig, initialRetry time.Duration) (bool, time.Duration, error) {
	path := c.Request.URL.Path

	item, enqueued, err := m.queue.Enqueue(c.Request.Context(), key, path, config.QueueSize, config.QueueTimeout)
	if err != nil {
		return false, initialRetry, err
	}

	if !enqueued {
		return false, initialRetry, nil
	}

	maxWait := config.QueueTimeout
	if maxWait > 30*time.Second {
		maxWait = 30 * time.Second
	}

	allowed, waited, err := m.queue.Wait(c.Request.Context(), key, item, maxWait)
	if err != nil {
		return false, initialRetry, err
	}

	if allowed {
		c.Next()
		return true, 0, nil
	}

	return false, initialRetry + waited, nil
}

func (m *RateLimiterMiddleware) processQueue(ctx context.Context, key string, config *LimitConfig) {
	for {
		item, err := m.queue.Dequeue(ctx, key)
		if err != nil || item == nil {
			return
		}

		allowed, _, err := m.checkLimitWithKey(ctx, key, config)
		if err != nil {
			return
		}

		if allowed {
			continue
		}

		break
	}
}

func (m *RateLimiterMiddleware) checkLimitWithKey(ctx context.Context, key string, config *LimitConfig) (bool, time.Duration, error) {
	switch config.Algorithm {
	case AlgorithmTokenBucket:
		result, err := m.tokenBucket.Allow(ctx, key, config.Capacity, config.Rate, 1)
		if err != nil {
			return true, 0, err
		}
		return result.Allowed, result.RetryAfter, nil

	case AlgorithmSlidingWindow:
		result, err := m.slidingWindow.Allow(ctx, key, config.Limit, config.Window)
		if err != nil {
			return true, 0, err
		}
		return result.Allowed, result.RetryAfter, nil

	default:
		return true, 0, nil
	}
}

func (m *RateLimiterMiddleware) returnTooManyRequests(c *gin.Context, retryAfter time.Duration) {
	if retryAfter < time.Second {
		retryAfter = time.Second
	}

	retryAfterStr := fmt.Sprintf("%d", int(retryAfter.Seconds()))
	c.Header("Retry-After", retryAfterStr)
	c.Header("X-RateLimit-Retry-After", retryAfterStr)

	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
		"error":       "Too Many Requests",
		"retry_after": retryAfterStr,
		"message":     "Rate limit exceeded, please try again later",
	})
}

func (m *RateLimiterMiddleware) GetConfigManager() *ConfigManager {
	return m.configManager
}
