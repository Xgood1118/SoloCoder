package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"api-rate-limiter/internal/ratelimiter"
)

func main() {
	redisClient := ratelimiter.NewRedisClient("localhost:6379", "", 0)

	middleware, err := ratelimiter.NewRateLimiterMiddleware(
		redisClient,
		ratelimiter.WithUserIDHeader("X-User-ID"),
		ratelimiter.WithRebuildOnStart(true),
	)
	if err != nil {
		log.Fatalf("Failed to create rate limiter middleware: %v", err)
	}
	defer middleware.Close()

	configManager := middleware.GetConfigManager()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	apiConfig := ratelimiter.NewDefaultConfig(
		ratelimiter.AlgorithmTokenBucket,
		ratelimiter.DimensionUserID,
		100,
		200,
	)
	apiConfig.QueueSize = 50
	apiConfig.QueueTimeout = 30 * time.Second
	err = configManager.SetConfig("/api/user", apiConfig)
	if err != nil {
		log.Printf("Failed to set config for /api/user: %v", err)
	}

	orderConfig := ratelimiter.NewDefaultConfig(
		ratelimiter.AlgorithmSlidingWindow,
		ratelimiter.DimensionIP,
		50,
		50,
	)
	orderConfig.Window = time.Second
	orderConfig.QueueSize = 30
	orderConfig.QueueTimeout = 30 * time.Second
	err = configManager.SetConfig("/api/order", orderConfig)
	if err != nil {
		log.Printf("Failed to set config for /api/order: %v", err)
	}

	_ = ctx

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	apiGroup := r.Group("/api")
	apiGroup.Use(middleware.Middleware())
	{
		apiGroup.GET("/user", func(c *gin.Context) {
			userID := c.GetHeader("X-User-ID")
			c.JSON(http.StatusOK, gin.H{
				"user_id": userID,
				"data":    "user info",
			})
		})

		apiGroup.POST("/order", func(c *gin.Context) {
			var order struct {
				ProductID string `json:"product_id"`
				Quantity  int    `json:"quantity"`
			}
			if err := c.ShouldBindJSON(&order); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"order_id": "ORD" + time.Now().Format("20060102150405"),
				"status":   "created",
			})
		})

		apiGroup.GET("/public", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"data": "public info"})
		})
	}

	adminGroup := r.Group("/admin")
	{
		adminGroup.POST("/config/:path", func(c *gin.Context) {
			path := c.Param("path")

			var configReq struct {
				Algorithm    string `json:"algorithm"`
				Dimension    string `json:"dimension"`
				QPS          float64 `json:"qps"`
				Burst        int    `json:"burst"`
				Capacity     float64 `json:"capacity"`
				Rate         float64 `json:"rate"`
				Limit        int    `json:"limit"`
				WindowMs     int64  `json:"window_ms"`
				QueueSize    int    `json:"queue_size"`
				QueueTimeout int64  `json:"queue_timeout_ms"`
				Enabled      *bool  `json:"enabled"`
			}

			if err := c.ShouldBindJSON(&configReq); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			config := &ratelimiter.LimitConfig{
				Path:      "/" + path,
				Algorithm: ratelimiter.AlgorithmType(configReq.Algorithm),
				Dimension: ratelimiter.LimitDimension(configReq.Dimension),
				QPS:       configReq.QPS,
				Burst:     configReq.Burst,
				Capacity:  configReq.Capacity,
				Rate:      configReq.Rate,
				Limit:     configReq.Limit,
				Window:    time.Duration(configReq.WindowMs) * time.Millisecond,
				QueueSize: configReq.QueueSize,
				QueueTimeout: time.Duration(configReq.QueueTimeout) * time.Millisecond,
				Enabled:   true,
			}

			if configReq.Enabled != nil {
				config.Enabled = *configReq.Enabled
			}

			if config.Algorithm == ratelimiter.AlgorithmTokenBucket {
				if config.Capacity == 0 {
					config.Capacity = float64(config.Burst)
					if config.Capacity == 0 {
						config.Capacity = config.QPS * 2
					}
				}
				if config.Rate == 0 {
					config.Rate = config.QPS
				}
			} else if config.Algorithm == ratelimiter.AlgorithmSlidingWindow {
				if config.Limit == 0 {
					config.Limit = config.Burst
					if config.Limit == 0 {
						config.Limit = int(config.QPS)
					}
				}
				if config.Window == 0 {
					config.Window = time.Second
				}
			}

			if config.QueueSize == 0 {
				config.QueueSize = 100
			}
			if config.QueueTimeout == 0 {
				config.QueueTimeout = 30 * time.Second
			}

			err := configManager.SetConfig("/"+path, config)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			configManager.InvalidateCache("/" + path)

			c.JSON(http.StatusOK, gin.H{
				"message": "Config updated successfully",
				"config":  config,
			})
		})

		adminGroup.GET("/config/:path", func(c *gin.Context) {
			path := c.Param("path")
			config, err := configManager.GetConfig("/" + path)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, config)
		})

		adminGroup.DELETE("/config/:path", func(c *gin.Context) {
			path := c.Param("path")
			err := configManager.DeleteConfig("/" + path)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"message": "Config deleted successfully"})
		})
	}

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
