package main

import (
	"fmt"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/purchase-workflow/internal/config"
	"github.com/purchase-workflow/internal/handler"
	"github.com/purchase-workflow/internal/middleware"
	"github.com/purchase-workflow/internal/repository"
	"github.com/purchase-workflow/internal/service"
	"github.com/robfig/cron/v3"
)

func main() {
	if err := config.LoadConfig("config/config.yaml"); err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	if err := repository.InitDB(); err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}

	authService := service.NewAuthService()
	if err := authService.InitDefaultUsers(); err != nil {
		log.Printf("初始化默认用户失败: %v", err)
	}

	workflowEngine := service.NewWorkflowEngine()
	if err := workflowEngine.InitDefaultWorkflow(1); err != nil {
		log.Printf("初始化默认工作流失败: %v", err)
	}

	c := cron.New()
	c.AddFunc("@every 5m", func() {
		log.Println("开始检查超时任务...")
		if err := workflowEngine.ProcessTimeouts(); err != nil {
			log.Printf("处理超时任务失败: %v", err)
		}
	})
	c.Start()
	defer c.Stop()

	if config.AppConfig.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	authHandler := handler.NewAuthHandler()
	appHandler := handler.NewApplicationHandler()
	workflowHandler := handler.NewWorkflowHandler()

	api := r.Group("/api")
	{
		api.POST("/auth/login", authHandler.Login)

		auth := api.Group("")
		auth.Use(middleware.AuthMiddleware())
		{
			auth.GET("/auth/me", authHandler.GetCurrentUser)

			applications := auth.Group("/applications")
			{
				applications.POST("", appHandler.Create)
				applications.GET("/my", appHandler.GetMyApplications)
				applications.GET("/:id", appHandler.GetDetail)
				applications.GET("/:id/history", appHandler.GetHistory)
				applications.POST("/approve", appHandler.Approve)
				applications.POST("/rollback", appHandler.Rollback)
				applications.GET("/:id/rollback-nodes", appHandler.GetRollbackNodes)
			}

			tasks := auth.Group("/tasks")
			{
				tasks.GET("/my", appHandler.GetMyTasks)
			}

			workflows := auth.Group("/workflows")
			{
				workflows.GET("", workflowHandler.List)
				workflows.GET("/:id", workflowHandler.GetDetail)
				workflows.POST("", workflowHandler.Create)
				workflows.PUT("/:id", workflowHandler.Update)
				workflows.DELETE("/:id", workflowHandler.Delete)
			}
		}
	}

	addr := fmt.Sprintf(":%d", config.AppConfig.Server.Port)
	log.Printf("服务器启动在 %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("启动服务器失败: %v", err)
	}
}
