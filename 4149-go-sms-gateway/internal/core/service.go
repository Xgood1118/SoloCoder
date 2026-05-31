package core

import (
	"context"
)

type SMSService interface {
	Send(ctx context.Context, req *SMSRequest) (*SMSResponse, error)
	SendAsync(ctx context.Context, req *SMSRequest) (string, error)
	BatchSend(ctx context.Context, req *BatchSMSRequest) ([]*SMSResponse, error)
	BatchSendAsync(ctx context.Context, req *BatchSMSRequest) ([]string, error)
}

type CallbackService interface {
	HandleDeliveryReport(channelName string, body []byte) error
	HandleMoMessage(channelName string, body []byte) error
}

type RiskControl interface {
	CheckSensitiveWords(content string) (bool, []string)
	CheckFrequency(phone string, ip string) bool
	CheckTemplate(templateID string) bool
}

type Logger interface {
	Info(msg string, fields ...interface{})
	Error(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
	Debug(msg string, fields ...interface{})
	LogSend(log *SendLog)
}

type Metrics interface {
	IncSendCount(channel string, status string)
	ObserveLatency(channel string, duration float64)
	SetChannelHealth(channel string, healthy bool)
	GetMetrics() map[string]interface{}
}

type Queue interface {
	Push(task interface{}) error
	Process(workerCount int)
	Len() int
}
