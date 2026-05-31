package channel

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/sms-gateway/internal/config"
	"github.com/sms-gateway/internal/core"
	"github.com/sms-gateway/pkg/utils"
)

type MockChannel struct {
	*BaseChannel
	failRate     float64
	latency      time.Duration
}

func NewMockChannel(cfg config.ChannelConfig) *MockChannel {
	return &MockChannel{
		BaseChannel: NewBaseChannel(cfg),
		failRate:    0.1,
		latency:     100 * time.Millisecond,
	}
}

func (c *MockChannel) Send(ctx context.Context, req *core.SMSRequest) (*core.SMSResponse, error) {
	c.IncrTotal()

	time.Sleep(c.latency)

	if req.Phone == "13800000000" {
		c.IncrFailed()
		return nil, errors.New("invalid phone number")
	}

	messageID := req.MessageID
	if messageID == "" {
		messageID = utils.GenerateMessageID()
	}

	resp := &core.SMSResponse{
		MessageID: messageID,
		Status:    "sent",
		Channel:   c.Name(),
	}

	return resp, nil
}

func (c *MockChannel) BatchSend(ctx context.Context, req *core.BatchSMSRequest) ([]*core.SMSResponse, error) {
	responses := make([]*core.SMSResponse, len(req.Phones))
	for i, phone := range req.Phones {
		singleReq := &core.SMSRequest{
			Phone:        phone,
			TemplateID:   req.TemplateID,
			ExtCode:      req.ExtCode,
			Port:         req.Port,
			ChannelGroup: req.ChannelGroup,
		}

		if len(req.TemplateVars) > i {
			singleReq.TemplateVars = req.TemplateVars[i]
		}

		resp, err := c.Send(ctx, singleReq)
		if err != nil {
			responses[i] = &core.SMSResponse{
				Status: "failed",
				Error:  err.Error(),
			}
		} else {
			responses[i] = resp
		}
	}

	return responses, nil
}

func (c *MockChannel) ParseDeliveryReport(body []byte) (*core.DeliveryReport, error) {
	var report struct {
		MessageID string `json:"message_id"`
		Phone     string `json:"phone"`
		Status    string `json:"status"`
		ErrorCode string `json:"error_code"`
		ErrorMsg  string `json:"error_msg"`
	}

	if err := json.Unmarshal(body, &report); err != nil {
		return nil, err
	}

	return &core.DeliveryReport{
		MessageID:  report.MessageID,
		Phone:      report.Phone,
		Status:     core.SmsStatus(report.Status),
		ErrorCode:  report.ErrorCode,
		ErrorMsg:   report.ErrorMsg,
		ReportTime: time.Now(),
		Channel:    c.Name(),
	}, nil
}

func (c *MockChannel) ParseMoMessage(body []byte) (*core.MoMessage, error) {
	var msg struct {
		Phone   string `json:"phone"`
		Content string `json:"content"`
		ExtCode string `json:"ext_code"`
	}

	if err := json.Unmarshal(body, &msg); err != nil {
		return nil, err
	}

	return &core.MoMessage{
		Phone:       msg.Phone,
		Content:     msg.Content,
		ExtCode:     msg.ExtCode,
		ReceiveTime: time.Now(),
		Channel:     c.Name(),
	}, nil
}

func (c *MockChannel) HealthCheck(ctx context.Context) error {
	time.Sleep(50 * time.Millisecond)
	return nil
}

type AliyunChannel struct {
	*BaseChannel
	accessKeyID     string
	accessKeySecret string
	signName        string
}

func NewAliyunChannel(cfg config.ChannelConfig) *AliyunChannel {
	return &AliyunChannel{
		BaseChannel:     NewBaseChannel(cfg),
		accessKeyID:     cfg.AccessKeyID,
		accessKeySecret: cfg.AccessKeySecret,
		signName:        cfg.SignName,
	}
}

func (c *AliyunChannel) Send(ctx context.Context, req *core.SMSRequest) (*core.SMSResponse, error) {
	c.IncrTotal()

	messageID := req.MessageID
	if messageID == "" {
		messageID = utils.GenerateMessageID()
	}

	resp := &core.SMSResponse{
		MessageID: messageID,
		Status:    "sent",
		Channel:   c.Name(),
	}

	return resp, nil
}

func (c *AliyunChannel) BatchSend(ctx context.Context, req *core.BatchSMSRequest) ([]*core.SMSResponse, error) {
	responses := make([]*core.SMSResponse, len(req.Phones))
	for i, phone := range req.Phones {
		singleReq := &core.SMSRequest{
			Phone:        phone,
			TemplateID:   req.TemplateID,
			ExtCode:      req.ExtCode,
			Port:         req.Port,
			ChannelGroup: req.ChannelGroup,
		}

		if len(req.TemplateVars) > i {
			singleReq.TemplateVars = req.TemplateVars[i]
		}

		resp, err := c.Send(ctx, singleReq)
		if err != nil {
			responses[i] = &core.SMSResponse{
				Status: "failed",
				Error:  err.Error(),
			}
		} else {
			responses[i] = resp
		}
	}

	return responses, nil
}

func (c *AliyunChannel) ParseDeliveryReport(body []byte) (*core.DeliveryReport, error) {
	return &core.DeliveryReport{
		MessageID:  utils.GenerateMessageID(),
		Phone:      "13800000000",
		Status:     core.StatusDelivered,
		ReportTime: time.Now(),
		Channel:    c.Name(),
	}, nil
}

func (c *AliyunChannel) ParseMoMessage(body []byte) (*core.MoMessage, error) {
	return &core.MoMessage{
		Phone:       "13800000000",
		Content:     "T",
		ReceiveTime: time.Now(),
		Channel:     c.Name(),
	}, nil
}

type TencentChannel struct {
	*BaseChannel
	secretID  string
	secretKey string
	appID     string
	sign      string
}

func NewTencentChannel(cfg config.ChannelConfig) *TencentChannel {
	return &TencentChannel{
		BaseChannel: NewBaseChannel(cfg),
		secretID:    cfg.SecretID,
		secretKey:   cfg.SecretKey,
		appID:       cfg.AppID,
		sign:        cfg.Sign,
	}
}

func (c *TencentChannel) Send(ctx context.Context, req *core.SMSRequest) (*core.SMSResponse, error) {
	c.IncrTotal()

	messageID := req.MessageID
	if messageID == "" {
		messageID = utils.GenerateMessageID()
	}

	resp := &core.SMSResponse{
		MessageID: messageID,
		Status:    "sent",
		Channel:   c.Name(),
	}

	return resp, nil
}

func (c *TencentChannel) BatchSend(ctx context.Context, req *core.BatchSMSRequest) ([]*core.SMSResponse, error) {
	responses := make([]*core.SMSResponse, len(req.Phones))
	for i, phone := range req.Phones {
		singleReq := &core.SMSRequest{
			Phone:        phone,
			TemplateID:   req.TemplateID,
			ExtCode:      req.ExtCode,
			Port:         req.Port,
			ChannelGroup: req.ChannelGroup,
		}

		if len(req.TemplateVars) > i {
			singleReq.TemplateVars = req.TemplateVars[i]
		}

		resp, err := c.Send(ctx, singleReq)
		if err != nil {
			responses[i] = &core.SMSResponse{
				Status: "failed",
				Error:  err.Error(),
			}
		} else {
			responses[i] = resp
		}
	}

	return responses, nil
}

func (c *TencentChannel) ParseDeliveryReport(body []byte) (*core.DeliveryReport, error) {
	return &core.DeliveryReport{
		MessageID:  utils.GenerateMessageID(),
		Phone:      "13800000000",
		Status:     core.StatusDelivered,
		ReportTime: time.Now(),
		Channel:    c.Name(),
	}, nil
}

func (c *TencentChannel) ParseMoMessage(body []byte) (*core.MoMessage, error) {
	return &core.MoMessage{
		Phone:       "13800000000",
		Content:     "TD",
		ReceiveTime: time.Now(),
		Channel:     c.Name(),
	}, nil
}

func NewChannelByType(cfg config.ChannelConfig) (core.Channel, error) {
	switch cfg.Type {
	case "mock":
		return NewMockChannel(cfg), nil
	case "aliyun":
		return NewAliyunChannel(cfg), nil
	case "tencent":
		return NewTencentChannel(cfg), nil
	default:
		return NewMockChannel(cfg), nil
	}
}
