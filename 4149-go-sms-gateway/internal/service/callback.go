package service

import (
	"errors"
	"sync"
	"time"

	"github.com/sms-gateway/internal/channel"
	"github.com/sms-gateway/internal/core"
	"github.com/sms-gateway/pkg/utils"
)

type CallbackService struct {
	channelManager *channel.Manager
	logger         core.Logger
	metrics        core.Metrics

	processedReports map[string]time.Time
	processedMu      sync.RWMutex
	reportTTL        time.Duration

	moCallbacks     map[string]func(*core.MoMessage)
	moCallbacksMu   sync.RWMutex
}

func NewCallbackService(cm *channel.Manager, logger core.Logger, metrics core.Metrics) *CallbackService {
	cs := &CallbackService{
		channelManager:   cm,
		logger:           logger,
		metrics:          metrics,
		processedReports: make(map[string]time.Time),
		reportTTL:        24 * time.Hour,
		moCallbacks:      make(map[string]func(*core.MoMessage)),
	}

	go cs.cleanupProcessedReports()
	return cs
}

func (s *CallbackService) HandleDeliveryReport(channelName string, body []byte) error {
	ch, err := s.channelManager.Get(channelName)
	if err != nil {
		s.logger.Error("channel not found for delivery report", "channel", channelName)
		return err
	}

	report, err := ch.ParseDeliveryReport(body)
	if err != nil {
		s.logger.Error("failed to parse delivery report", "channel", channelName, "error", err)
		return err
	}

	if report == nil {
		return errors.New("empty delivery report")
	}

	if s.isReportProcessed(report.MessageID) {
		s.logger.Info("delivery report already processed", "message_id", report.MessageID)
		return nil
	}

	s.markReportProcessed(report.MessageID)

	s.logger.Info("processing delivery report", 
		"message_id", report.MessageID,
		"phone", utils.MaskPhone(report.Phone),
		"status", report.Status,
		"channel", channelName,
	)

	s.metrics.IncSendCount(channelName, string(report.Status))

	s.notifyBusinessSystem(report)

	return nil
}

func (s *CallbackService) HandleMoMessage(channelName string, body []byte) error {
	ch, err := s.channelManager.Get(channelName)
	if err != nil {
		s.logger.Error("channel not found for mo message", "channel", channelName)
		return err
	}

	moMsg, err := ch.ParseMoMessage(body)
	if err != nil {
		s.logger.Error("failed to parse mo message", "channel", channelName, "error", err)
		return err
	}

	if moMsg == nil {
		return errors.New("empty mo message")
	}

	moMsg.Channel = channelName

	s.logger.Info("received mo message",
		"phone", utils.MaskPhone(moMsg.Phone),
		"content", moMsg.Content,
		"channel", channelName,
	)

	s.invokeMoCallbacks(moMsg)

	return nil
}

func (s *CallbackService) isReportProcessed(messageID string) bool {
	s.processedMu.RLock()
	defer s.processedMu.RUnlock()

	_, exists := s.processedReports[messageID]
	return exists
}

func (s *CallbackService) markReportProcessed(messageID string) {
	s.processedMu.Lock()
	defer s.processedMu.Unlock()

	s.processedReports[messageID] = time.Now()
}

func (s *CallbackService) cleanupProcessedReports() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		s.processedMu.Lock()
		now := time.Now()
		for id, t := range s.processedReports {
			if now.Sub(t) > s.reportTTL {
				delete(s.processedReports, id)
			}
		}
		s.processedMu.Unlock()
	}
}

func (s *CallbackService) notifyBusinessSystem(report *core.DeliveryReport) {
	s.logger.Info("notifying business system",
		"message_id", report.MessageID,
		"status", report.Status,
		"phone", utils.MaskPhone(report.Phone),
	)
}

func (s *CallbackService) RegisterMoCallback(name string, callback func(*core.MoMessage)) {
	s.moCallbacksMu.Lock()
	defer s.moCallbacksMu.Unlock()

	s.moCallbacks[name] = callback
}

func (s *CallbackService) UnregisterMoCallback(name string) {
	s.moCallbacksMu.Lock()
	defer s.moCallbacksMu.Unlock()

	delete(s.moCallbacks, name)
}

func (s *CallbackService) invokeMoCallbacks(moMsg *core.MoMessage) {
	s.moCallbacksMu.RLock()
	defer s.moCallbacksMu.RUnlock()

	for _, callback := range s.moCallbacks {
		go func(cb func(*core.MoMessage)) {
			defer func() {
				if r := recover(); r != nil {
					s.logger.Error("mo callback panic", "error", r)
				}
			}()
			cb(moMsg)
		}(callback)
	}
}

type StatusCode string

const (
	StatusSuccess     StatusCode = "DELIVRD"
	StatusFailed      StatusCode = "FAILED"
	StatusExpired     StatusCode = "EXPIRED"
	StatusRejected    StatusCode = "REJECTED"
	StatusBlacklist   StatusCode = "BLACKLIST"
	StatusNoBalance   StatusCode = "NO_BALANCE"
	StatusInvalidNum  StatusCode = "INVALID_NUMBER"
	StatusUserAbsent  StatusCode = "USER_ABSENT"
)

func MapStatusCode(code string) core.SmsStatus {
	switch code {
	case string(StatusSuccess):
		return core.StatusDelivered
	case string(StatusFailed), string(StatusRejected), string(StatusBlacklist), string(StatusInvalidNum):
		return core.StatusFailed
	default:
		return core.StatusPending
	}
}

func GetErrorDescription(code string) string {
	switch code {
	case string(StatusSuccess):
		return "发送成功"
	case string(StatusFailed):
		return "发送失败"
	case string(StatusExpired):
		return "短信过期"
	case string(StatusRejected):
		return "短信被拒绝"
	case string(StatusBlacklist):
		return "号码在黑名单"
	case string(StatusNoBalance):
		return "账户余额不足"
	case string(StatusInvalidNum):
		return "无效号码"
	case string(StatusUserAbsent):
		return "用户关机或不在服务区"
	default:
		return "未知状态"
	}
}
