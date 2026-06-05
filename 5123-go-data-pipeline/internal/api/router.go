package api

import (
	"log-pipeline/internal/config"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(handler *Handler) *gin.Engine {
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
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api")
	{
		api.GET("/health", handler.HealthCheck)

		ds := api.Group("/datasources")
		{
			ds.GET("", handler.ListDatasources)
			ds.POST("", handler.CreateDatasource)
			ds.GET("/:id", handler.GetDatasource)
			ds.PUT("/:id", handler.UpdateDatasource)
			ds.DELETE("/:id", handler.DeleteDatasource)
			ds.POST("/:id/start", handler.StartDatasource)
			ds.POST("/:id/stop", handler.StopDatasource)
			ds.GET("/:id/metrics", handler.GetDatasourceMetrics)
			ds.POST("/:id/logs", handler.ReceiveLog)
		}

		pipes := api.Group("/pipelines")
		{
			pipes.GET("", handler.ListPipelines)
			pipes.POST("", handler.CreatePipeline)
			pipes.GET("/:id", handler.GetPipeline)
			pipes.PUT("/:id", handler.UpdatePipeline)
			pipes.DELETE("/:id", handler.DeletePipeline)
			pipes.POST("/:id/start", handler.StartPipeline)
			pipes.POST("/:id/stop", handler.StopPipeline)
			pipes.GET("/:id/metrics", handler.GetPipelineMetrics)
		}

		alerts := api.Group("/alerts")
		{
			alerts.GET("/rules", handler.ListAlertRules)
			alerts.POST("/rules", handler.CreateAlertRule)
			alerts.GET("/rules/:id", handler.GetAlertRule)
			alerts.PUT("/rules/:id", handler.UpdateAlertRule)
			alerts.DELETE("/rules/:id", handler.DeleteAlertRule)
			alerts.GET("/history", handler.ListAlertHistory)
		}

		agg := api.Group("/aggregations")
		{
			agg.GET("/rules", handler.ListAggregationRules)
			agg.POST("/rules", handler.CreateAggregationRule)
			agg.GET("/rules/:id", handler.GetAggregationRule)
			agg.PUT("/rules/:id", handler.UpdateAggregationRule)
			agg.DELETE("/rules/:id", handler.DeleteAggregationRule)
			agg.GET("/rules/:id/results", handler.GetAggregationResults)
		}

		monitor := api.Group("/monitor")
		{
			monitor.GET("/status", handler.GetMonitorStatus)
			monitor.GET("/overview", handler.GetMonitorOverview)
			monitor.GET("/alerts", handler.GetMonitorAlerts)
		}
	}

	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    404,
			"message": "Not Found",
		})
	})

	return r
}
