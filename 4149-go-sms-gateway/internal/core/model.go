package core

import (
	"time"
)

type SMSRequest struct {
	Phone        string            `json:"phone"`
	TemplateID   string            `json:"template_id"`
	TemplateVars map[string]string `json:"template_vars"`
	ExtCode      string            `json:"ext_code"`
	Port         string            `json:"port"`
	CallbackURL  string            `json:"callback_url"`
	MessageID    string            `json:"message_id"`
	ChannelGroup string            `json:"channel_group"`
}

type BatchSMSRequest struct {
	Phones       []string          `json:"phones"`
	TemplateID   string            `json:"template_id"`
	TemplateVars []map[string]string `json:"template_vars"`
	ExtCode      string            `json:"ext_code"`
	Port         string            `json:"port"`
	CallbackURL  string            `json:"callback_url"`
	ChannelGroup string            `json:"channel_group"`
}

type SMSResponse struct {
	MessageID string `json:"message_id"`
	Status    string `json:"status"`
	Channel   string `json:"channel"`
	Error     string `json:"error,omitempty"`
}

type ChannelStatus struct {
	Name           string
	Available      bool
	SuccessRate    float64
	TotalRequests  int64
	FailedRequests int64
	LastChecked    time.Time
}

type SmsStatus string

const (
	StatusPending   SmsStatus = "pending"
	StatusSent      SmsStatus = "sent"
	StatusDelivered SmsStatus = "delivered"
	StatusFailed    SmsStatus = "failed"
)

type DeliveryReport struct {
	MessageID  string    `json:"message_id"`
	Phone      string    `json:"phone"`
	Status     SmsStatus `json:"status"`
	ErrorCode  string    `json:"error_code"`
	ErrorMsg   string    `json:"error_msg"`
	ReportTime time.Time `json:"report_time"`
	Channel    string    `json:"channel"`
}

type MoMessage struct {
	Phone      string    `json:"phone"`
	Content    string    `json:"content"`
	ExtCode    string    `json:"ext_code"`
	ReceiveTime time.Time `json:"receive_time"`
	Channel    string    `json:"channel"`
}

type SendLog struct {
	MessageID    string
	Phone        string
	TemplateID   string
	Channel      string
	Status       string
	RequestTime  time.Time
	ResponseTime time.Time
	Duration     time.Duration
	Error        string
	ExtCode      string
}

type Template struct {
	ID         string
	Content    string
	Status     string
	Channel    string
	CreateTime time.Time
	UpdateTime time.Time
}
