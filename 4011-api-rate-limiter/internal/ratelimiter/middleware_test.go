package ratelimiter

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestMiddlewareTokenBucket(t *testing.T) {
	mockRedis := NewMockRedisClient()
	middleware, err := NewRateLimiterMiddleware(mockRedis)
	assert.NoError(t, err)
	defer middleware.Close()

	configManager := middleware.GetConfigManager()
	path := "/api/test"
	config := NewDefaultConfig(AlgorithmTokenBucket, DimensionIP, 5, 5)
	config.QueueSize = 0
	config.QueueTimeout = 0
	err = configManager.SetConfig(path, config)
	assert.NoError(t, err)

	r := gin.New()
	r.Use(middleware.Middleware())
	r.GET(path, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", path, nil)
		req.RemoteAddr = "127.0.0.1:12345"
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", path, nil)
	req.RemoteAddr = "127.0.0.1:12345"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.NotEmpty(t, w.Header().Get("Retry-After"))
}

func TestMiddlewareSlidingWindow(t *testing.T) {
	mockRedis := NewMockRedisClient()
	middleware, err := NewRateLimiterMiddleware(mockRedis)
	assert.NoError(t, err)
	defer middleware.Close()

	configManager := middleware.GetConfigManager()
	path := "/api/test2"
	config := NewDefaultConfig(AlgorithmSlidingWindow, DimensionIP, 3, 3)
	config.Window = 1 * time.Second
	config.QueueSize = 0
	config.QueueTimeout = 0
	err = configManager.SetConfig(path, config)
	assert.NoError(t, err)

	r := gin.New()
	r.Use(middleware.Middleware())
	r.GET(path, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", path, nil)
		req.RemoteAddr = "127.0.0.1:12345"
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", path, nil)
	req.RemoteAddr = "127.0.0.1:12345"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.NotEmpty(t, w.Header().Get("Retry-After"))
}

func TestMiddlewareUserIDPriority(t *testing.T) {
	mockRedis := NewMockRedisClient()
	middleware, err := NewRateLimiterMiddleware(mockRedis, WithUserIDHeader("X-User-ID"))
	assert.NoError(t, err)
	defer middleware.Close()

	configManager := middleware.GetConfigManager()
	path := "/api/user"
	config := NewDefaultConfig(AlgorithmTokenBucket, DimensionUserID, 2, 2)
	config.QueueSize = 0
	config.QueueTimeout = 0
	err = configManager.SetConfig(path, config)
	assert.NoError(t, err)

	r := gin.New()
	r.Use(middleware.Middleware())
	r.GET(path, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", path, nil)
		req.Header.Set("X-User-ID", "user1")
		req.RemoteAddr = "127.0.0.1:11111"
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", path, nil)
	req.Header.Set("X-User-ID", "user1")
	req.RemoteAddr = "127.0.0.1:11111"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", path, nil)
		req.Header.Set("X-User-ID", "user2")
		req.RemoteAddr = "127.0.0.1:22222"
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}
}

func TestMiddlewareUserIDFallbackToIP(t *testing.T) {
	mockRedis := NewMockRedisClient()
	middleware, err := NewRateLimiterMiddleware(mockRedis, WithUserIDHeader("X-User-ID"))
	assert.NoError(t, err)
	defer middleware.Close()

	configManager := middleware.GetConfigManager()
	path := "/api/fallback"
	config := NewDefaultConfig(AlgorithmTokenBucket, DimensionUserID, 2, 2)
	config.QueueSize = 0
	config.QueueTimeout = 0
	err = configManager.SetConfig(path, config)
	assert.NoError(t, err)

	r := gin.New()
	r.Use(middleware.Middleware())
	r.GET(path, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", path, nil)
		req.RemoteAddr = "127.0.0.1:12345"
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", path, nil)
	req.RemoteAddr = "127.0.0.1:12345"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
}

func TestMiddlewareDisabledConfig(t *testing.T) {
	mockRedis := NewMockRedisClient()
	middleware, err := NewRateLimiterMiddleware(mockRedis)
	assert.NoError(t, err)
	defer middleware.Close()

	configManager := middleware.GetConfigManager()
	path := "/api/disabled"
	config := NewDefaultConfig(AlgorithmTokenBucket, DimensionIP, 1, 1)
	config.Enabled = false
	err = configManager.SetConfig(path, config)
	assert.NoError(t, err)

	r := gin.New()
	r.Use(middleware.Middleware())
	r.GET(path, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	for i := 0; i < 10; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", path, nil)
		req.RemoteAddr = "127.0.0.1:12345"
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}
}

func TestMiddlewareGetClientIP(t *testing.T) {
	mockRedis := NewMockRedisClient()
	middleware, err := NewRateLimiterMiddleware(mockRedis)
	assert.NoError(t, err)
	defer middleware.Close()

	tests := []struct {
		name           string
		headers        map[string]string
		remoteAddr     string
		expectedIP     string
	}{
		{
			name: "X-Forwarded-For",
			headers: map[string]string{
				"X-Forwarded-For": "203.0.113.195, 2001:db8:85a3::8a2e:370:7334",
			},
			remoteAddr: "192.168.1.1:12345",
			expectedIP: "203.0.113.195",
		},
		{
			name: "X-Real-IP",
			headers: map[string]string{
				"X-Real-IP": "198.51.100.1",
			},
			remoteAddr: "192.168.1.1:12345",
			expectedIP: "198.51.100.1",
		},
		{
			name:       "RemoteAddr",
			headers:    map[string]string{},
			remoteAddr: "192.168.1.100:54321",
			expectedIP: "192.168.1.100",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request, _ = http.NewRequest("GET", "/test", nil)
			for k, v := range tt.headers {
				c.Request.Header.Set(k, v)
			}
			c.Request.RemoteAddr = tt.remoteAddr

			ip := middleware.getClientIP(c)
			assert.Equal(t, tt.expectedIP, ip)
		})
	}
}

func TestMiddleware429ResponseBody(t *testing.T) {
	mockRedis := NewMockRedisClient()
	middleware, err := NewRateLimiterMiddleware(mockRedis)
	assert.NoError(t, err)
	defer middleware.Close()

	configManager := middleware.GetConfigManager()
	path := "/api/test-body"
	config := NewDefaultConfig(AlgorithmTokenBucket, DimensionIP, 1, 1)
	config.QueueSize = 0
	config.QueueTimeout = 0
	err = configManager.SetConfig(path, config)
	assert.NoError(t, err)

	r := gin.New()
	r.Use(middleware.Middleware())
	r.GET(path, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", path, nil)
	req.RemoteAddr = "127.0.0.1:12345"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", path, nil)
	req.RemoteAddr = "127.0.0.1:12345"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "Too Many Requests", response["error"])
	assert.NotNil(t, response["retry_after"])
	assert.NotNil(t, response["message"])
}

func TestMiddlewarePerPathConfig(t *testing.T) {
	mockRedis := NewMockRedisClient()
	middleware, err := NewRateLimiterMiddleware(mockRedis)
	assert.NoError(t, err)
	defer middleware.Close()

	configManager := middleware.GetConfigManager()

	path1 := "/api/path1"
	config1 := NewDefaultConfig(AlgorithmTokenBucket, DimensionIP, 2, 2)
	config1.QueueSize = 0
	config1.QueueTimeout = 0
	err = configManager.SetConfig(path1, config1)
	assert.NoError(t, err)

	path2 := "/api/path2"
	config2 := NewDefaultConfig(AlgorithmTokenBucket, DimensionIP, 5, 5)
	config2.QueueSize = 0
	config2.QueueTimeout = 0
	err = configManager.SetConfig(path2, config2)
	assert.NoError(t, err)

	r := gin.New()
	r.Use(middleware.Middleware())
	r.GET(path1, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"path": 1})
	})
	r.GET(path2, func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"path": 2})
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", path1, nil)
		req.RemoteAddr = "127.0.0.1:12345"
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", path1, nil)
	req.RemoteAddr = "127.0.0.1:12345"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)

	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", path2, nil)
		req.RemoteAddr = "127.0.0.1:12345"
		r.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", path2, nil)
	req.RemoteAddr = "127.0.0.1:12345"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
}
