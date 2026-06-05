package main

import (
	"log"

	"github.com/gin-gonic/gin"

	"solid-go-monitor/internal/api"
	"solid-go-monitor/internal/model"
	"solid-go-monitor/internal/scheduler"
	"solid-go-monitor/internal/store"
)

func main() {
	s := store.NewStore()
	sch := scheduler.NewScheduler(s)
	sch.Start()

	h := api.NewHandler(s, sch)

	seedData(s, sch)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	apiGroup := r.Group("/api")
	{
		apiGroup.GET("/overview", h.Overview)
		apiGroup.GET("/groups", h.GetGroups)

		apiGroup.GET("/probes", h.GetProbes)
		apiGroup.POST("/probes", h.CreateProbe)
		apiGroup.GET("/probes/:id", h.GetProbe)
		apiGroup.PUT("/probes/:id", h.UpdateProbe)
		apiGroup.PATCH("/probes/:id", h.PatchProbe)
		apiGroup.DELETE("/probes/:id", h.DeleteProbe)

		apiGroup.POST("/probes/:id/clone", h.CloneProbe)
		apiGroup.POST("/probes/:id/test", h.TestProbe)
		apiGroup.POST("/probes/import", h.ImportProbes)

		apiGroup.GET("/probes/:id/results", h.GetProbeResults)
		apiGroup.GET("/probes/:id/stats", h.GetProbeStats)
		apiGroup.GET("/probes/:id/failures", h.GetLastFailures)

		apiGroup.GET("/events", h.GetEvents)
		apiGroup.POST("/events/:id/ack", h.AckEvent)

		apiGroup.GET("/alerts", h.GetAlerts)
		apiGroup.GET("/alerts/history", h.GetAlertHistory)
		apiGroup.POST("/alerts/:id/ack", h.AckAlert)
		apiGroup.POST("/alerts/:id/silence", h.SilenceAlert)
		apiGroup.POST("/alerts/batch/ack", h.AckAlertsBatch)
		apiGroup.POST("/alerts/batch/silence", h.SilenceAlertsBatch)
	}

	log.Println("Server starting on :8110")
	if err := r.Run(":8110"); err != nil {
		log.Fatal(err)
	}
}

func seedData(s *store.Store, sch *scheduler.Scheduler) {
	probes := []*model.Probe{
		model.NewProbe("Baidu Homepage", model.ProbeTypeHTTP, "https://www.baidu.com", 30, 10, "网站监控"),
		model.NewProbe("Google", model.ProbeTypeHTTP, "https://www.google.com", 60, 10, "网站监控"),
		model.NewProbe("Local HTTP", model.ProbeTypeHTTP, "http://localhost:8110/api/overview", 15, 5, "本地服务"),
		model.NewProbe("SSH Port", model.ProbeTypeTCP, "localhost:22", 60, 5, "网络服务"),
		model.NewProbe("HTTP Port 8110", model.ProbeTypeTCP, "localhost:8110", 30, 5, "网络服务"),
		model.NewProbe("Explorer Process", model.ProbeTypeProcess, "explorer.exe", 60, 10, "系统进程"),
	}

	for _, p := range probes {
		s.AddProbe(p)
		sch.StartProbe(p.ID)
	}

	log.Println("Seeded", len(probes), "probes")
}
