package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/sms-gateway/internal/channel"
	"github.com/sms-gateway/internal/config"
	"github.com/sms-gateway/internal/core"
	"github.com/sms-gateway/internal/limiter"
	"github.com/sms-gateway/internal/logger"
	"github.com/sms-gateway/internal/risk"
	"github.com/sms-gateway/internal/server"
	"github.com/sms-gateway/internal/service"
	"github.com/sms-gateway/pkg/utils"
)

func main() {
	if err := config.Load("./configs/config.yaml"); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	cfg := config.GlobalConfig

	asyncLogger := logger.NewAsyncLogger(cfg.Log.Level, cfg.Log.Path, cfg.Log.AsyncBufferSize)
	defer asyncLogger.Stop()

	metrics := logger.NewMetrics()

	channelManager := channel.NewManager()
	for _, channelCfg := range cfg.Channels {
		ch, err := channel.NewChannelByType(channelCfg)
		if err != nil {
			asyncLogger.Error("failed to create channel", "name", channelCfg.Name, "error", err)
			continue
		}
		if err := channelManager.Register(ch); err != nil {
			asyncLogger.Error("failed to register channel", "name", channelCfg.Name, "error", err)
			continue
		}
		asyncLogger.Info("channel registered", "name", channelCfg.Name, "type", channelCfg.Type)
	}

	channelManager.StartHealthCheck()
	defer channelManager.StopHealthCheck()

	riskControl := risk.NewRiskControl(
		cfg.Risk.SensitiveWords,
		cfg.Risk.FrequencyLimit.PhoneDailyLimit,
		cfg.Risk.FrequencyLimit.PhoneHourlyLimit,
		cfg.Risk.FrequencyLimit.IPDailyLimit,
	)

	taskQueue := limiter.NewTaskQueue(cfg.Queue.MaxSize)
	defer taskQueue.Close()

	smsService := service.NewSMSService(channelManager, asyncLogger, metrics, riskControl, taskQueue)
	callbackService := service.NewCallbackService(channelManager, asyncLogger, metrics)

	go service.StartWorkers(taskQueue, cfg.Queue.WorkerCount)

	httpServer := server.NewServer(cfg.Server.Port, smsService, callbackService,
		channelManager, asyncLogger, metrics, riskControl, taskQueue)

	go func() {
		if err := httpServer.Start(); err != nil {
			asyncLogger.Error("http server failed", "error", err)
		}
	}()

	asyncLogger.Info("sms gateway started", "port", cfg.Server.Port)

	exampleSend(smsService, asyncLogger)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	asyncLogger.Info("sms gateway shutting down")
	httpServer.Stop()
}

func exampleSend(smsService *service.SMSService, logger *logger.AsyncLogger) {
	req := &core.SMSRequest{
		Phone:        "13900000001",
		TemplateID:   "SMS_123456",
		TemplateVars: map[string]string{"code": "123456"},
		ExtCode:      "001",
		ChannelGroup: "default",
	}

	resp, err := smsService.Send(context.Background(), req)
	if err != nil {
		logger.Error("failed to send sms", "error", err)
		return
	}

	logger.Info("sms sent successfully", 
		"message_id", resp.MessageID, 
		"channel", resp.Channel,
		"phone", utils.MaskPhone(req.Phone),
	)
}
