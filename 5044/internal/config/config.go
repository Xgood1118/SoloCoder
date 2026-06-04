package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type DBConfig struct {
	Type         string `json:"type" yaml:"type"`
	DSN          string `json:"dsn" yaml:"dsn"`
	MaxOpenConns int    `json:"max_open_conns" yaml:"max_open_conns"`
	MaxIdleConns int    `json:"max_idle_conns" yaml:"max_idle_conns"`
}

type Duration time.Duration

type RetryConfig struct {
	MaxRetries     int        `json:"max_retries" yaml:"max_retries"`
	RetryIntervals []Duration `json:"retry_intervals" yaml:"retry_intervals"`
}

func (d *Duration) UnmarshalYAML(value *yaml.Node) error {
	var s string
	if err := value.Decode(&s); err == nil {
		parsed, err := parseDuration(s)
		if err != nil {
			return fmt.Errorf("invalid duration '%s': %w", s, err)
		}
		*d = Duration(parsed)
		return nil
	}

	var n int64
	if err := value.Decode(&n); err == nil {
		*d = Duration(n)
		return nil
	}

	var f float64
	if err := value.Decode(&f); err == nil {
		*d = Duration(int64(f))
		return nil
	}

	return fmt.Errorf("cannot unmarshal %s into Duration", value.Tag)
}

func (d Duration) Duration() time.Duration {
	return time.Duration(d)
}

func (d Duration) MarshalYAML() (interface{}, error) {
	return time.Duration(d).String(), nil
}

func parseDuration(s string) (time.Duration, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, nil
	}

	if d, err := time.ParseDuration(s); err == nil {
		return d, nil
	}

	n, err := strconv.ParseInt(s, 10, 64)
	if err == nil {
		return time.Duration(n), nil
	}

	f, err := strconv.ParseFloat(s, 64)
	if err == nil {
		return time.Duration(int64(f)), nil
	}

	return 0, fmt.Errorf("invalid duration format: %s", s)
}

func retryIntervalsToDurations(intervals []Duration) []time.Duration {
	result := make([]time.Duration, len(intervals))
	for i, d := range intervals {
		result[i] = d.Duration()
	}
	return result
}

type NodeConfig struct {
	NodeID   string `json:"node_id" yaml:"node_id"`
	NodeName string `json:"node_name" yaml:"node_name"`
}

type AlertConfig struct {
	Enabled   bool     `json:"enabled" yaml:"enabled"`
	Type      string   `json:"type" yaml:"type"`
	Webhook   string   `json:"webhook,omitempty" yaml:"webhook,omitempty"`
	Emails    []string `json:"emails,omitempty" yaml:"emails,omitempty"`
}

type Config struct {
	DB          DBConfig     `json:"db" yaml:"db"`
	WorkerCount int          `json:"worker_count" yaml:"worker_count"`
	QueueSize   int          `json:"queue_size" yaml:"queue_size"`
	Retry       RetryConfig  `json:"retry" yaml:"retry"`
	Node        NodeConfig   `json:"node" yaml:"node"`
	Alert       AlertConfig  `json:"alert" yaml:"alert"`
}

func DefaultConfig() *Config {
	return &Config{
		DB: DBConfig{
			Type:         "sqlite",
			DSN:          "scheduler.db",
			MaxOpenConns: 10,
			MaxIdleConns: 5,
		},
		WorkerCount: 5,
		QueueSize:   1000,
		Retry: RetryConfig{
			MaxRetries: 3,
			RetryIntervals: []Duration{
				Duration(1 * time.Minute),
				Duration(5 * time.Minute),
				Duration(30 * time.Minute),
			},
		},
		Node: NodeConfig{
			NodeID:   "node-1",
			NodeName: "default-node",
		},
		Alert: AlertConfig{
			Enabled: true,
			Type:    "webhook",
		},
	}
}

func (r *RetryConfig) GetRetryIntervals() []time.Duration {
	return retryIntervalsToDurations(r.RetryIntervals)
}

func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file failed: %w", err)
	}

	config := &Config{}

	if isJSON(path) {
		if err := json.Unmarshal(data, config); err != nil {
			return nil, fmt.Errorf("parse json config failed: %w", err)
		}
	} else if isYAML(path) {
		if err := yaml.Unmarshal(data, config); err != nil {
			return nil, fmt.Errorf("parse yaml config failed: %w", err)
		}
	} else {
		return nil, fmt.Errorf("unsupported config file format: %s", path)
	}

	return config, nil
}

func isJSON(path string) bool {
	return len(path) > 5 && (path[len(path)-5:] == ".json")
}

func isYAML(path string) bool {
	return len(path) > 5 && (path[len(path)-5:] == ".yaml" || path[len(path)-4:] == ".yml")
}

func (c *Config) Validate() error {
	if c.WorkerCount <= 0 {
		return fmt.Errorf("worker_count must be greater than 0")
	}
	if c.QueueSize <= 0 {
		return fmt.Errorf("queue_size must be greater than 0")
	}
	if c.Retry.MaxRetries < 0 {
		return fmt.Errorf("max_retries must be non-negative")
	}
	if c.DB.DSN == "" {
		return fmt.Errorf("db.dsn is required")
	}
	return nil
}
