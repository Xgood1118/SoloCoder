package output

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/solocoder/taskscheduler/internal/models"
)

type OutputType string

const (
	OutputTypeCallback OutputType = "callback"
	OutputTypeQueue    OutputType = "queue"
)

type OutputConfig struct {
	Type         OutputType `json:"type"`
	CallbackURL  string     `json:"callback_url,omitempty"`
	QueueName    string     `json:"queue_name,omitempty"`
	Timeout      time.Duration `json:"timeout,omitempty"`
	RetryCount   int        `json:"retry_count,omitempty"`
}

type JobResult struct {
	JobID       string      `json:"job_id"`
	JobName     string      `json:"job_name"`
	Status      string      `json:"status"`
	Result      string      `json:"result,omitempty"`
	Error       string      `json:"error,omitempty"`
	StartTime   time.Time   `json:"start_time"`
	EndTime     time.Time   `json:"end_time"`
	Duration    int64       `json:"duration"`
	ExecuteTimes int       `json:"execute_times"`
}

type OutputSender interface {
	Send(ctx context.Context, result *JobResult, config *OutputConfig) error
}

type CallbackSender struct {
	client *http.Client
}

func NewCallbackSender() *CallbackSender {
	return &CallbackSender{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *CallbackSender) Send(ctx context.Context, result *JobResult, config *OutputConfig) error {
	if config.CallbackURL == "" {
		return fmt.Errorf("callback url is required")
	}

	timeout := config.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	client := &http.Client{Timeout: timeout}

	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("marshal result failed: %w", err)
	}

	retryCount := config.RetryCount
	if retryCount <= 0 {
		retryCount = 3
	}

	var lastErr error
	for i := 0; i < retryCount; i++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, config.CallbackURL, bytes.NewBuffer(data))
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(i+1) * time.Second)
			continue
		}
		resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return nil
		}
		lastErr = fmt.Errorf("callback returned status %d", resp.StatusCode)
		time.Sleep(time.Duration(i+1) * time.Second)
	}

	return lastErr
}

type QueueSender struct {
}

func NewQueueSender() *QueueSender {
	return &QueueSender{}
}

func (s *QueueSender) Send(ctx context.Context, result *JobResult, config *OutputConfig) error {
	if config.QueueName == "" {
		return fmt.Errorf("queue name is required")
	}
	return nil
}

type OutputManager interface {
	AddOutput(config *OutputConfig)
	SendResult(ctx context.Context, job *models.Job, execution *models.JobExecution) error
}

type outputManager struct {
	outputs        []*OutputConfig
	callbackSender *CallbackSender
	queueSender    *QueueSender
}

func NewOutputManager() OutputManager {
	return &outputManager{
		outputs:        make([]*OutputConfig, 0),
		callbackSender: NewCallbackSender(),
		queueSender:    NewQueueSender(),
	}
}

func (m *outputManager) AddOutput(config *OutputConfig) {
	if config != nil {
		m.outputs = append(m.outputs, config)
	}
}

func (m *outputManager) SendResult(ctx context.Context, job *models.Job, execution *models.JobExecution) error {
	if len(m.outputs) == 0 {
		return nil
	}

	result := &JobResult{
		JobID:        job.ID,
		JobName:      job.Name,
		Status:       string(execution.Status),
		Result:       execution.Result,
		Error:        execution.ErrorMessage,
		StartTime:    execution.StartTime,
		EndTime:      *execution.EndTime,
		Duration:     execution.Duration,
		ExecuteTimes: job.ExecuteTimes,
	}

	var lastErr error
	for _, output := range m.outputs {
		var err error
		switch output.Type {
		case OutputTypeCallback:
			err = m.callbackSender.Send(ctx, result, output)
		case OutputTypeQueue:
			err = m.queueSender.Send(ctx, result, output)
		default:
			err = fmt.Errorf("unsupported output type: %s", output.Type)
		}
		if err != nil {
			lastErr = err
		}
	}

	return lastErr
}
