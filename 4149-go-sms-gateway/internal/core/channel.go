package core

import (
	"context"
)

type Channel interface {
	Name() string
	Type() string
	Weight() int
	Group() string
	IsEnabled() bool
	IsHealthy() bool
	HealthCheck(ctx context.Context) error
	Send(ctx context.Context, req *SMSRequest) (*SMSResponse, error)
	BatchSend(ctx context.Context, req *BatchSMSRequest) ([]*SMSResponse, error)
	ParseDeliveryReport(body []byte) (*DeliveryReport, error)
	ParseMoMessage(body []byte) (*MoMessage, error)
	GetConfig() map[string]interface{}
}

type ChannelSelector interface {
	Select(group string) (Channel, error)
	SelectAll(group string) []Channel
	ReportSuccess(channelName string)
	ReportFailure(channelName string)
}

type ChannelRegistry interface {
	Register(channel Channel) error
	Unregister(name string) error
	Get(name string) (Channel, error)
	List() []Channel
	ListByGroup(group string) []Channel
}

type HealthChecker interface {
	Start()
	Stop()
	Check(channel Channel) error
}
