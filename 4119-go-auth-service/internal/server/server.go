package server

import (
	"fmt"
	"log"

	"auth-service/internal/cache"
	"auth-service/internal/config"
	"auth-service/internal/database"
	"auth-service/internal/middleware"
	"auth-service/internal/service"
	"auth-service/internal/util"

	"github.com/gin-gonic/gin"
)

type Server struct {
	engine *gin.Engine
}

func New() *Server {
	gin.SetMode(config.AppConfig.Server.Mode)

	engine := gin.New()
	engine.Use(gin.Recovery())
	engine.Use(gin.Logger())
	engine.Use(middleware.RateLimit())

	engine.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	SetupRoutes(engine)

	return &Server{
		engine: engine,
	}
}

func (s *Server) Run() error {
	if err := util.InitJWTSecret(); err != nil {
		log.Printf("Warning: init JWT secret failed: %v", err)
	}

	if err := database.Init(); err != nil {
		log.Printf("Warning: database init failed: %v", err)
	}

	if err := cache.Init(); err != nil {
		log.Printf("Warning: redis init failed: %v", err)
	}

	cache.GetMemoryCache()

	go service.NewRBACService().StartPermissionChangeListener()
	go service.NewRBACService().StartCacheSyncJob()

	addr := fmt.Sprintf(":%d", config.AppConfig.Server.Port)
	log.Printf("Server starting on %s", addr)
	return s.engine.Run(addr)
}
