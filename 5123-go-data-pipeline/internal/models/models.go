package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LogEntry struct {
	ID          string                 `json:"id"`
	Timestamp   time.Time              `json:"timestamp"`
	DatasourceID string                `json:"datasource_id"`
	Level       string                 `json:"level"`
	Message     string                 `json:"message"`
	Tags        map[string]string      `json:"tags"`
	Fields      map[string]interface{} `json:"fields"`
	Raw         string                 `json:"raw,omitempty"`
}

func NewLogEntry() *LogEntry {
	return &LogEntry{
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Tags:      make(map[string]string),
		Fields:    make(map[string]interface{}),
	}
}

type DatasourceType string

const (
	DatasourceTypeFile       DatasourceType = "file"
	DatasourceTypeKafka      DatasourceType = "kafka"
	DatasourceTypeElasticsearch DatasourceType = "elasticsearch"
	DatasourceTypeHTTP       DatasourceType = "http"
)

type DatasourceStatus string

const (
	DatasourceStatusRunning DatasourceStatus = "running"
	DatasourceStatusPaused  DatasourceStatus = "paused"
	DatasourceStatusError   DatasourceStatus = "error"
)

type Datasource struct {
	ID          string            `gorm:"primaryKey" json:"id"`
	Name        string            `gorm:"not null" json:"name"`
	Type        DatasourceType    `gorm:"not null" json:"type"`
	Config      string            `gorm:"type:text" json:"config"`
	Status      DatasourceStatus  `gorm:"default:running" json:"status"`
	PipelineID  string            `json:"pipeline_id"`
	Version     int               `gorm:"default:1" json:"version"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	DeletedAt   gorm.DeletedAt    `gorm:"index" json:"-"`
}

type FileConfig struct {
	Path       string `json:"path"`
	Pattern    string `json:"pattern"`
	Encoding   string `json:"encoding"`
	StartFromEnd bool  `json:"start_from_end"`
}

type KafkaConfig struct {
	Brokers []string `json:"brokers"`
	Topic   string   `json:"topic"`
	GroupID string   `json:"group_id"`
}

type ESConfig struct {
	Addresses []string `json:"addresses"`
	Index     string   `json:"index"`
	Query     string   `json:"query"`
	Interval  int      `json:"interval"`
}

type HTTPConfig struct {
	Path   string `json:"path"`
	APIKey string `json:"api_key"`
}

type PipelineStatus string

const (
	PipelineStatusRunning PipelineStatus = "running"
	PipelineStatusPaused  PipelineStatus = "paused"
	PipelineStatusError   PipelineStatus = "error"
)

type Pipeline struct {
	ID           string         `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"not null" json:"name"`
	Description  string         `json:"description"`
	Config       string         `gorm:"type:text" json:"config"`
	Status       PipelineStatus `gorm:"default:running" json:"status"`
	Version      int            `gorm:"default:1" json:"version"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type PipelineConfigData struct {
	Parsers    []ProcessorConfig `json:"parsers"`
	Filters    []ProcessorConfig `json:"filters"`
	Transforms []ProcessorConfig `json:"transforms"`
	Enhancers  []ProcessorConfig `json:"enhancers"`
}

type ProcessorConfig struct {
	Type   string                 `json:"type"`
	Config map[string]interface{} `json:"config"`
}

type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical"
	AlertSeverityWarning  AlertSeverity = "warning"
	AlertSeverityInfo     AlertSeverity = "info"
)

type AlertStatus string

const (
	AlertStatusActive   AlertStatus = "active"
	AlertStatusInactive AlertStatus = "inactive"
)

type AlertRule struct {
	ID          string            `gorm:"primaryKey" json:"id"`
	Name        string            `gorm:"not null" json:"name"`
	Description string            `json:"description"`
	PipelineID  string            `json:"pipeline_id"`
	Expression  string            `gorm:"type:text;not null" json:"expression"`
	Threshold   float64           `json:"threshold"`
	Window      string            `json:"window"`
	Severity    AlertSeverity     `gorm:"default:warning" json:"severity"`
	Actions     string            `gorm:"type:text" json:"actions"`
	Status      AlertStatus       `gorm:"default:active" json:"status"`
	Version     int               `gorm:"default:1" json:"version"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	DeletedAt   gorm.DeletedAt    `gorm:"index" json:"-"`
}

type AlertAction struct {
	Type     string                 `json:"type"`
	Config   map[string]interface{} `json:"config"`
}

type AlertHistory struct {
	ID         string         `gorm:"primaryKey" json:"id"`
	RuleID     string         `gorm:"index" json:"rule_id"`
	RuleName   string         `json:"rule_name"`
	Severity   AlertSeverity  `json:"severity"`
	Message    string         `gorm:"type:text" json:"message"`
	Value      float64        `json:"value"`
	Threshold  float64        `json:"threshold"`
	TriggeredAt time.Time     `json:"triggered_at"`
	Resolved   bool           `gorm:"default:false" json:"resolved"`
	ResolvedAt *time.Time     `json:"resolved_at"`
}

type AggregationType string

const (
	AggregationCount    AggregationType = "count"
	AggregationSum      AggregationType = "sum"
	AggregationAvg      AggregationType = "avg"
	AggregationMin      AggregationType = "min"
	AggregationMax      AggregationType = "max"
	AggregationPercentile AggregationType = "percentile"
)

type AggregationRule struct {
	ID            string            `gorm:"primaryKey" json:"id"`
	Name          string            `gorm:"not null" json:"name"`
	PipelineID    string            `json:"pipeline_id"`
	MetricName    string            `json:"metric_name"`
	Type          AggregationType   `gorm:"not null" json:"type"`
	Field         string            `json:"field"`
	Filter        string            `json:"filter"`
	Windows       string            `json:"windows"`
	GroupBy       string            `json:"group_by"`
	PercentileVal float64           `json:"percentile_val"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
}

type AggregationResult struct {
	ID         string                 `json:"id"`
	MetricName string                 `json:"metric_name"`
	Tags       map[string]string      `json:"tags"`
	Value      float64                `json:"value"`
	Timestamp  time.Time              `json:"timestamp"`
	Window     string                 `json:"window"`
}

type PipelineMetrics struct {
	PipelineID     string  `json:"pipeline_id"`
	InputCount     int64   `json:"input_count"`
	OutputCount    int64   `json:"output_count"`
	ErrorCount     int64   `json:"error_count"`
	AvgLatencyMs   float64 `json:"avg_latency_ms"`
	P95LatencyMs   float64 `json:"p95_latency_ms"`
	Status         string  `json:"status"`
	Timestamp      time.Time `json:"timestamp"`
}

type DatasourceMetrics struct {
	DatasourceID string `json:"datasource_id"`
	RecordCount  int64  `json:"record_count"`
	ErrorCount   int64  `json:"error_count"`
	Status       string `json:"status"`
	Timestamp    time.Time `json:"timestamp"`
}
