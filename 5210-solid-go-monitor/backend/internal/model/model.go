package model

import (
	"time"

	"github.com/google/uuid"
)

type ProbeType string

const (
	ProbeTypeHTTP    ProbeType = "http"
	ProbeTypeTCP     ProbeType = "tcp"
	ProbeTypeProcess ProbeType = "process"
)

type ProbeStatus string

const (
	ProbeStatusUp       ProbeStatus = "up"
	ProbeStatusDown     ProbeStatus = "down"
	ProbeStatusUnknown  ProbeStatus = "unknown"
	ProbeStatusDisabled ProbeStatus = "disabled"
)

type AlertLevel string

const (
	AlertLevelWarning AlertLevel = "warning"
	AlertLevelError   AlertLevel = "error"
	AlertLevelCritical AlertLevel = "critical"
)

type Probe struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	Type           ProbeType     `json:"type"`
	Target         string        `json:"target"`
	Interval       int           `json:"interval"`
	Timeout        int           `json:"timeout"`
	Group          string        `json:"group"`
	Enabled        bool          `json:"enabled"`
	FailureThreshold int         `json:"failureThreshold"`
	WebhookURL     string        `json:"webhookUrl,omitempty"`
	CreateTime     time.Time     `json:"createTime"`
	UpdateTime     time.Time     `json:"updateTime"`
}

type ProbeResult struct {
	ID           string    `json:"id"`
	ProbeID      string    `json:"probeId"`
	Timestamp    time.Time `json:"timestamp"`
	Status       ProbeStatus `json:"status"`
	ResponseTime int64     `json:"responseTime"`
	ErrorMessage string    `json:"errorMessage,omitempty"`
	HTTPStatus   int       `json:"httpStatus,omitempty"`
	CPUPercent   float64   `json:"cpuPercent,omitempty"`
	MemoryPercent float64  `json:"memoryPercent,omitempty"`
}

type ProbeStats struct {
	SuccessRate float64 `json:"successRate"`
	P50         int64   `json:"p50"`
	P95         int64   `json:"p95"`
	P99         int64   `json:"p99"`
	TotalCount  int     `json:"totalCount"`
	UpCount     int     `json:"upCount"`
	DownCount   int     `json:"downCount"`
}

type Event struct {
	ID          string      `json:"id"`
	ProbeID     string      `json:"probeId"`
	ProbeName   string      `json:"probeName"`
	Timestamp   time.Time   `json:"timestamp"`
	PrevStatus  ProbeStatus `json:"prevStatus"`
	CurrStatus  ProbeStatus `json:"currStatus"`
	Message     string      `json:"message"`
	Acknowledged bool        `json:"acknowledged"`
	AckBy       string      `json:"ackBy,omitempty"`
	AckTime     time.Time   `json:"ackTime,omitempty"`
}

type Alert struct {
	ID             string      `json:"id"`
	ProbeID        string      `json:"probeId"`
	ProbeName      string      `json:"probeName"`
	ProbeGroup     string      `json:"probeGroup"`
	Status         ProbeStatus `json:"status"`
	Level          AlertLevel  `json:"level"`
	Message        string      `json:"message"`
	StartTime      time.Time   `json:"startTime"`
	EndTime        time.Time   `json:"endTime,omitempty"`
	Resolved       bool        `json:"resolved"`
	Acknowledged   bool        `json:"acknowledged"`
	AckBy          string      `json:"ackBy,omitempty"`
	AckTime        time.Time   `json:"ackTime,omitempty"`
	Silenced       bool        `json:"silenced"`
	SilencedUntil  time.Time   `json:"silencedUntil,omitempty"`
	Escalated      bool        `json:"escalated"`
	EscalationTime time.Time   `json:"escalationTime,omitempty"`
	Duration       string      `json:"duration,omitempty"`
}

type WebhookPayload struct {
	ProbeID   string    `json:"probeId"`
	ProbeName string    `json:"probeName"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level,omitempty"`
}

func NewProbe(name string, probeType ProbeType, target string, interval, timeout int, group string) *Probe {
	return &Probe{
		ID:              uuid.NewString(),
		Name:            name,
		Type:            probeType,
		Target:          target,
		Interval:        max(interval, 5),
		Timeout:         max(timeout, 1),
		Group:           group,
		Enabled:         true,
		FailureThreshold: 3,
		CreateTime:      time.Now(),
		UpdateTime:      time.Now(),
	}
}

func NewProbeResult(probeID string, status ProbeStatus, responseTime int64, errMsg string) *ProbeResult {
	return &ProbeResult{
		ID:           uuid.NewString(),
		ProbeID:      probeID,
		Timestamp:    time.Now(),
		Status:       status,
		ResponseTime: responseTime,
		ErrorMessage: errMsg,
	}
}

func NewEvent(probeID, probeName string, prevStatus, currStatus ProbeStatus, message string) *Event {
	return &Event{
		ID:           uuid.NewString(),
		ProbeID:      probeID,
		ProbeName:    probeName,
		Timestamp:    time.Now(),
		PrevStatus:   prevStatus,
		CurrStatus:   currStatus,
		Message:      message,
		Acknowledged: false,
	}
}

func NewAlert(probe *Probe, message string) *Alert {
	return &Alert{
		ID:           uuid.NewString(),
		ProbeID:      probe.ID,
		ProbeName:    probe.Name,
		ProbeGroup:   probe.Group,
		Status:       ProbeStatusDown,
		Level:        AlertLevelError,
		Message:      message,
		StartTime:    time.Now(),
		Resolved:     false,
		Acknowledged: false,
		Silenced:     false,
		Escalated:    false,
	}
}
