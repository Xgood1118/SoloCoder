package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"gopkg.in/yaml.v3"
)

type MQTTConfig struct {
	Broker   string `yaml:"broker" json:"broker"`
	ClientID string `yaml:"client_id" json:"client_id"`
	Username string `yaml:"username" json:"username"`
	Password string `yaml:"password" json:"password"`
}

type Subscription struct {
	Topic       string `yaml:"topic" json:"topic"`
	QoS         byte   `yaml:"qos" json:"qos"`
	RegexFilter string `yaml:"regex_filter" json:"regex_filter"`
}

type WebhookConfig struct {
	URL            string            `yaml:"url" json:"url"`
	Method         string            `yaml:"method" json:"method"`
	Headers        map[string]string `yaml:"headers" json:"headers"`
	TimeoutSeconds int               `yaml:"timeout_seconds" json:"timeout_seconds"`
	MaxRetries     int               `yaml:"max_retries" json:"max_retries"`
	BaseBackoffSec int               `yaml:"base_backoff_seconds" json:"base_backoff_seconds"`
	MaxBackoffSec  int               `yaml:"max_backoff_seconds" json:"max_backoff_seconds"`
}

type ConverterConfig struct {
	Template string `yaml:"template" json:"template"`
}

type DeduplicatorConfig struct {
	WindowSeconds int `yaml:"window_seconds" json:"window_seconds"`
}

type Config struct {
	MQTT         MQTTConfig         `yaml:"mqtt" json:"mqtt"`
	Subscriptions []Subscription     `yaml:"subscriptions" json:"subscriptions"`
	Webhook      WebhookConfig      `yaml:"webhook" json:"webhook"`
	Converter    ConverterConfig    `yaml:"converter" json:"converter"`
	Deduplicator DeduplicatorConfig `yaml:"deduplicator" json:"deduplicator"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}
	ext := filepath.Ext(path)
	var cfg Config
	switch ext {
	case ".yaml", ".yml":
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return nil, fmt.Errorf("parse yaml: %w", err)
		}
	case ".json":
		if err := json.Unmarshal(data, &cfg); err != nil {
			return nil, fmt.Errorf("parse json: %w", err)
		}
	default:
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			if err := json.Unmarshal(data, &cfg); err != nil {
				return nil, fmt.Errorf("parse config failed (tried yaml and json): %w", err)
			}
		}
	}
	cfg.applyDefaults()
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (c *Config) applyDefaults() {
	if c.Webhook.Method == "" {
		c.Webhook.Method = "POST"
	}
	if c.Webhook.TimeoutSeconds == 0 {
		c.Webhook.TimeoutSeconds = 10
	}
	if c.Webhook.MaxRetries == 0 {
		c.Webhook.MaxRetries = 5
	}
	if c.Webhook.BaseBackoffSec == 0 {
		c.Webhook.BaseBackoffSec = 1
	}
	if c.Webhook.MaxBackoffSec == 0 {
		c.Webhook.MaxBackoffSec = 60
	}
	if c.Deduplicator.WindowSeconds == 0 {
		c.Deduplicator.WindowSeconds = 5
	}
	if c.MQTT.ClientID == "" {
		hostname, _ := os.Hostname()
		c.MQTT.ClientID = "mqtt-bridge-" + hostname
	}
}

func (c *Config) validate() error {
	if c.MQTT.Broker == "" {
		return fmt.Errorf("mqtt.broker is required")
	}
	if c.Webhook.URL == "" {
		return fmt.Errorf("webhook.url is required")
	}
	for _, s := range c.Subscriptions {
		if s.Topic == "" {
			return fmt.Errorf("subscription topic is required")
		}
		if s.QoS > 2 {
			return fmt.Errorf("subscription qos must be 0, 1 or 2, got %d", s.QoS)
		}
		if s.RegexFilter != "" {
			if _, err := regexp.Compile(s.RegexFilter); err != nil {
				return fmt.Errorf("invalid regex_filter %q: %w", s.RegexFilter, err)
			}
		}
	}
	return nil
}
