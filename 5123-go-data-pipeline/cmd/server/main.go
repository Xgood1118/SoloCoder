package main

import (
	"context"
	"fmt"
	"net/http"
	"log-pipeline/internal/aggregation"
	"log-pipeline/internal/alert"
	"log-pipeline/internal/api"
	"log-pipeline/internal/config"
	"log-pipeline/internal/datasource"
	"log-pipeline/internal/monitor"
	"log-pipeline/internal/pipeline"
	"log-pipeline/internal/models"
	"log-pipeline/pkg/utils"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	if err := config.Load(); err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	if err := utils.InitLogger(); err != nil {
		fmt.Printf("Failed to init logger: %v\n", err)
		os.Exit(1)
	}
	defer utils.Logger.Sync()

	if err := utils.InitDB(); err != nil {
		utils.Sugar.Fatalf("Failed to init database: %v", err)
	}

	utils.Sugar.Info("Starting log pipeline server...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	dsManager := datasource.NewManager()
	pipeManager := pipeline.NewManager(dsManager)
	aggEngine := aggregation.NewEngine()
	alertEngine := alert.NewEngine(aggEngine)
	mon := monitor.NewMonitor(dsManager, pipeManager)

	handler := api.NewHandler(dsManager, pipeManager, alertEngine, aggEngine, mon)
	r := api.SetupRouter(handler)

	if err := dsManager.Start(); err != nil {
		utils.Sugar.Fatalf("Failed to start datasource manager: %v", err)
	}

	if err := pipeManager.Start(); err != nil {
		utils.Sugar.Fatalf("Failed to start pipeline manager: %v", err)
	}

	if err := aggEngine.Start(ctx); err != nil {
		utils.Sugar.Fatalf("Failed to start aggregation engine: %v", err)
	}

	if err := alertEngine.Start(ctx); err != nil {
		utils.Sugar.Fatalf("Failed to start alert engine: %v", err)
	}

	mon.Start(ctx)

	go dataFlow(ctx, dsManager, pipeManager, aggEngine)
	go pipelineOutputFlow(ctx, pipeManager, aggEngine)

	go initDemoData()

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", config.AppConfig.Server.Port),
		Handler: r,
	}

	go func() {
		utils.Sugar.Infof("Server starting on port %d", config.AppConfig.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			utils.Sugar.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	utils.Sugar.Info("Shutting down server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		utils.Sugar.Errorf("Server shutdown error: %v", err)
	}

	mon.Stop()
	alertEngine.Stop()
	aggEngine.Stop()
	pipeManager.Stop()
	dsManager.Stop()

	utils.Sugar.Info("Server stopped gracefully")
}

func dataFlow(ctx context.Context, dsManager *datasource.Manager, pipeManager *pipeline.Manager, aggEngine *aggregation.Engine) {
	utils.Sugar.Info("Data flow started")

	for {
		select {
		case <-ctx.Done():
			utils.Sugar.Info("Data flow stopped")
			return
		case entry, ok := <-dsManager.OutputChannel():
			if !ok {
				return
			}
			pipeManager.RouteEntry(entry)
		}
	}
}

func pipelineOutputFlow(ctx context.Context, pipeManager *pipeline.Manager, aggEngine *aggregation.Engine) {
	for {
		select {
		case <-ctx.Done():
			return
		case entry, ok := <-pipeManager.OutputChannel():
			if !ok {
				return
			}
			aggEngine.Process(entry)
		}
	}
}

func initDemoData() {
	pipelineConfig := models.PipelineConfigData{
		Parsers: []models.ProcessorConfig{
			{
				Type: "json_parser",
				Config: map[string]interface{}{},
			},
		},
		Filters: []models.ProcessorConfig{
			{
				Type: "filter",
				Config: map[string]interface{}{
					"expression": "",
				},
			},
		},
		Transforms: []models.ProcessorConfig{},
		Enhancers: []models.ProcessorConfig{
			{
				Type: "enhancer",
				Config: map[string]interface{}{
					"tags": map[string]interface{}{
						"env": "production",
					},
				},
			},
		},
	}

	demoPipeline := &models.Pipeline{
		Name:        "Demo Pipeline",
		Description: "Demo data processing pipeline",
		Config:      utils.ToJSON(pipelineConfig),
		Status:      models.PipelineStatusRunning,
	}

	if err := utils.DB.Create(demoPipeline).Error; err != nil {
		utils.Sugar.Debugf("Demo pipeline may already exist: %v", err)
	} else {
		utils.Sugar.Infof("Created demo pipeline: %s", demoPipeline.ID)

		fileConfig := models.FileConfig{
			Path:         "./demo.log",
			StartFromEnd: true,
		}
		demoDS := &models.Datasource{
			Name:       "Demo File Source",
			Type:       models.DatasourceTypeFile,
			Config:     utils.ToJSON(fileConfig),
			PipelineID: demoPipeline.ID,
			Status:     models.DatasourceStatusRunning,
		}
		if err := utils.DB.Create(demoDS).Error; err != nil {
			utils.Sugar.Debugf("Demo datasource may already exist: %v", err)
		}

		aggRule := &models.AggregationRule{
			Name:          "Error Count",
			PipelineID:    demoPipeline.ID,
			MetricName:    "error_count",
			Type:          models.AggregationCount,
			Filter:        "level == 'ERROR'",
			Windows:       "minute,hour,day",
			GroupBy:       "level",
		}
		if err := utils.DB.Create(aggRule).Error; err != nil {
			utils.Sugar.Debugf("Demo aggregation rule may already exist: %v", err)
		}

		alertActions := []models.AlertAction{
			{
				Type: "webhook",
				Config: map[string]interface{}{
					"url": "http://localhost:8123/api/monitor/alerts",
				},
			},
		}
		alertRule := &models.AlertRule{
			Name:        "High Error Rate",
			Description: "Trigger when error logs exceed 100 per minute",
			PipelineID:  demoPipeline.ID,
			Expression:  "> 100",
			Threshold:   100,
			Window:      "minute",
			Severity:    models.AlertSeverityWarning,
			Actions:     utils.ToJSON(alertActions),
			Status:      models.AlertStatusActive,
		}
		if err := utils.DB.Create(alertRule).Error; err != nil {
			utils.Sugar.Debugf("Demo alert rule may already exist: %v", err)
		}
	}
}
