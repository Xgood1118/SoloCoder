package middleware

import (
	"fmt"
	"time"

	"auth-service/internal/cache"
	"auth-service/internal/config"
	"auth-service/internal/util"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

type RateLimitConfig struct {
	Limit  int
	Window time.Duration
}

var rateLimitRules = map[string]RateLimitConfig{
	"POST:/api/v1/auth/login": {
		Limit:  10,
		Window: 60 * time.Second,
	},
	"POST:/api/v1/auth/register": {
		Limit:  5,
		Window: 60 * time.Second,
	},
	"POST:/api/v1/code/send": {
		Limit:  3,
		Window: 60 * time.Second,
	},
}

func RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !config.AppConfig.RateLimit.Enabled {
			c.Next()
			return
		}

		key := getRateLimitKey(c)
		config := getRateLimitConfig(c)

		allowed, remaining, err := checkRateLimit(c, key, config.Limit, config.Window)
		if err != nil {
			c.Next()
			return
		}

		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", config.Limit))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
		c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", time.Now().Add(config.Window).Unix()))

		if !allowed {
			util.RateLimitError(c, "too many requests")
			c.Abort()
			return
		}

		c.Next()
	}
}

func getRateLimitKey(c *gin.Context) string {
	ip := c.ClientIP()
	path := c.FullPath()
	method := c.Request.Method
	return fmt.Sprintf("ratelimit:%s:%s:%s", ip, method, path)
}

func getRateLimitConfig(c *gin.Context) RateLimitConfig {
	key := fmt.Sprintf("%s:%s", c.Request.Method, c.FullPath())
	if config, exists := rateLimitRules[key]; exists {
		return config
	}
	return RateLimitConfig{
		Limit:  config.AppConfig.RateLimit.DefaultLimit,
		Window: time.Duration(config.AppConfig.RateLimit.WindowSeconds) * time.Second,
	}
}

func checkRateLimit(c *gin.Context, key string, limit int, window time.Duration) (bool, int, error) {
	now := time.Now().UnixNano()
	windowStart := now - window.Nanoseconds()

	pipe := cache.Client.Pipeline()
	pipe.ZRemRangeByScore(c, key, "0", fmt.Sprintf("%d", windowStart))
	pipe.ZCard(c, key)
	pipe.ZAdd(c, key, redis.Z{Score: float64(now), Member: now})
	pipe.Expire(c, key, window)

	results, err := pipe.Exec(c)
	if err != nil {
		return true, limit, err
	}

	count := results[1].(*redis.IntCmd).Val()

	remaining := limit - int(count)
	if remaining < 0 {
		remaining = 0
	}

	return count <= int64(limit), remaining, nil
}
