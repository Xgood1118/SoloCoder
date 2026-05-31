package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/sms-gateway/internal/channel"
	"github.com/sms-gateway/internal/core"
	"github.com/sms-gateway/pkg/utils"
)

type SMSService struct {
	channelManager *channel.Manager
	logger         core.Logger
	metrics        core.Metrics
	riskControl    core.RiskControl
	taskQueue      core.Queue
}

func NewSMSService(cm *channel.Manager, logger core.Logger, metrics core.Metrics, rc core.RiskControl, queue core.Queue) *SMSService {
	return &SMSService{
		channelManager: cm,
		logger:         logger,
		metrics:        metrics,
		riskControl:    rc,
		taskQueue:      queue,
	}
}

func (s *SMSService) Send(ctx context.Context, req *core.SMSRequest) (*core.SMSResponse, error) {
	if req.MessageID == "" {
		req.MessageID = utils.GenerateMessageID()
	}

	group := req.ChannelGroup
	if group == "" {
		group = "default"
	}

	ch, err := s.channelManager.SelectChannel(group)
	if err != nil {
		s.logger.Error("failed to select channel", "error", err, "message_id", req.MessageID)
		return nil, err
	}

	startTime := time.Now()

	resp, err := s.sendWithRetry(ctx, ch, req)

	duration := time.Since(startTime)
	s.metrics.ObserveLatency(ch.Name(), float64(duration.Seconds()))

	s.logSend(req, resp, ch.Name(), startTime, err)

	if err != nil {
		s.metrics.IncSendCount(ch.Name(), "failed")
		s.channelManager.ReportFailure(ch.Name())
		return resp, err
	}

	s.metrics.IncSendCount(ch.Name(), "success")
	s.channelManager.ReportSuccess(ch.Name())

	return resp, nil
}

func (s *SMSService) sendWithRetry(ctx context.Context, ch core.Channel, req *core.SMSRequest) (*core.SMSResponse, error) {
	maxRetries := 3
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		resp, err := ch.Send(ctx, req)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		time.Sleep(time.Duration(i+1) * 100 * time.Millisecond)
	}

	return nil, lastErr
}

func (s *SMSService) SendAsync(ctx context.Context, req *core.SMSRequest) (string, error) {
	if req.MessageID == "" {
		req.MessageID = utils.GenerateMessageID()
	}

	task := &AsyncSendTask{
		Request: req,
		Service: s,
	}

	if err := s.taskQueue.Push(task); err != nil {
		return "", err
	}

	return req.MessageID, nil
}

func (s *SMSService) BatchSend(ctx context.Context, req *core.BatchSMSRequest) ([]*core.SMSResponse, error) {
	if len(req.Phones) == 0 {
		return nil, errors.New("no phones provided")
	}

	if len(req.TemplateVars) > 0 && len(req.TemplateVars) != len(req.Phones) {
		return nil, errors.New("template vars count mismatch")
	}

	responses := make([]*core.SMSResponse, len(req.Phones))
	var wg sync.WaitGroup
	var mu sync.Mutex

	errors := make([]error, 0)

	for i, phone := range req.Phones {
		wg.Add(1)
		go func(idx int, p string) {
			defer wg.Done()

			singleReq := &core.SMSRequest{
				Phone:        p,
				TemplateID:   req.TemplateID,
				ExtCode:      req.ExtCode,
				Port:         req.Port,
				CallbackURL:  req.CallbackURL,
				ChannelGroup: req.ChannelGroup,
			}

			if len(req.TemplateVars) > idx {
				singleReq.TemplateVars = req.TemplateVars[idx]
			}

			resp, err := s.Send(ctx, singleReq)
			mu.Lock()
			responses[idx] = resp
			if err != nil {
				errors = append(errors, err)
			}
			mu.Unlock()
		}(i, phone)
	}

	wg.Wait()

	if len(errors) > 0 {
		return responses, errors[0]
	}

	return responses, nil
}

func (s *SMSService) BatchSendAsync(ctx context.Context, req *core.BatchSMSRequest) ([]string, error) {
	if len(req.Phones) == 0 {
		return nil, errors.New("no phones provided")
	}

	messageIDs := make([]string, len(req.Phones))
	for i := range req.Phones {
		messageIDs[i] = utils.GenerateMessageID()
	}

	task := &AsyncBatchSendTask{
		Request:   req,
		MessageIDs: messageIDs,
		Service:    s,
	}

	if err := s.taskQueue.Push(task); err != nil {
		return nil, err
	}

	return messageIDs, nil
}

func (s *SMSService) logSend(req *core.SMSRequest, resp *core.SMSResponse, channelName string, startTime time.Time, err error) {
	status := "success"
	errMsg := ""
	if err != nil {
		status = "failed"
		errMsg = err.Error()
	}

	sendLog := &core.SendLog{
		MessageID:    req.MessageID,
		Phone:        utils.MaskPhone(req.Phone),
		TemplateID:   req.TemplateID,
		Channel:      channelName,
		Status:       status,
		RequestTime:  startTime,
		ResponseTime: time.Now(),
		Duration:     time.Since(startTime),
		Error:        errMsg,
		ExtCode:      req.ExtCode,
	}

	s.logger.LogSend(sendLog)
}

type AsyncSendTask struct {
	Request *core.SMSRequest
	Service *SMSService
}

func (t *AsyncSendTask) Process() {
	ctx := context.Background()
	resp, err := t.Service.Send(ctx, t.Request)
	
	if err != nil {
		t.Service.logger.Error("async send failed", "error", err, "message_id", t.Request.MessageID)
	}

	if t.Request.CallbackURL != "" {
		t.Service.sendCallback(t.Request.CallbackURL, resp, err)
	}
}

type AsyncBatchSendTask struct {
	Request    *core.BatchSMSRequest
	MessageIDs []string
	Service     *SMSService
}

func (t *AsyncBatchSendTask) Process() {
	ctx := context.Background()
	responses, err := t.Service.BatchSend(ctx, t.Request)
	
	if err != nil {
		t.Service.logger.Error("async batch send failed", "error", err)
	}

	if t.Request.CallbackURL != "" {
		for _, resp := range responses {
			t.Service.sendCallback(t.Request.CallbackURL, resp, err)
		}
	}
}

func (s *SMSService) sendCallback(url string, resp *core.SMSResponse, err error) {
	if url == "" {
		return
	}

	go func() {
		callbackData := map[string]interface{}{
			"message_id": resp.MessageID,
			"status":    resp.Status,
			"channel":   resp.Channel,
			"error":     resp.Error,
			"timestamp": time.Now().Unix(),
		}

		if err != nil {
			callbackData["error"] = err.Error()
		}

		body, _ := json.Marshal(callbackData)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		req, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{}
		_, httpErr := client.Do(req)
		if httpErr != nil {
			s.logger.Error("callback failed", "error", httpErr, "url", url)
		}
	}()
}

func StartWorkers(queue core.Queue, workerCount int) {
	for i := 0; i < workerCount; i++ {
		go func(workerID int) {
			queue.Process(1)
		}(i)
	}
}
