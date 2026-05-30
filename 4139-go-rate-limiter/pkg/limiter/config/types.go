package config

import (
	"time"

	"github.com/solo/ratelimiter/pkg/limiter/algorithm"
	"github.com/solo/ratelimiter/pkg/limiter/dimension"
)

type Rule struct {
	ID          string                      `json:"id" toml:"id"`
	Name        string                      `json:"name" toml:"name"`
	Description string                      `json:"description,omitempty" toml:"description,omitempty"`
	Priority    int                         `json:"priority" toml:"priority"`
	Enabled     bool                        `json:"enabled" toml:"enabled"`
	Matchers    []Matcher                   `json:"matchers" toml:"matchers"`
	Dimensions  []DimensionConfig           `json:"dimensions" toml:"dimensions"`
	Algorithm   algorithm.AlgorithmConfig   `json:"algorithm" toml:"algorithm"`
	Action      ActionType                  `json:"action" toml:"action"`
	Metadata    map[string]string           `json:"metadata,omitempty" toml:"metadata,omitempty"`
	CreatedAt   time.Time                   `json:"created_at" toml:"created_at"`
	UpdatedAt   time.Time                   `json:"updated_at" toml:"updated_at"`
}

type Matcher struct {
	Type     MatcherType `json:"type" toml:"type"`
	Pattern  string      `json:"pattern" toml:"pattern"`
	Value    string      `json:"value,omitempty" toml:"value,omitempty"`
	IgnoreCase bool      `json:"ignore_case,omitempty" toml:"ignore_case,omitempty"`
}

type MatcherType string

const (
	MatcherPath     MatcherType = "path"
	MatcherHeader   MatcherType = "header"
	MatcherQuery    MatcherType = "query"
	MatcherMethod   MatcherType = "method"
	MatcherHost     MatcherType = "host"
	MatcherService  MatcherType = "service"
	MatcherRegion   MatcherType = "region"
	MatcherIP       MatcherType = "ip"
	MatcherUserID   MatcherType = "user_id"
)

type DimensionConfig struct {
	Type     dimension.DimensionType `json:"type" toml:"type"`
	Name     string                  `json:"name,omitempty" toml:"name,omitempty"`
	Pattern  string                  `json:"pattern,omitempty" toml:"pattern,omitempty"`
	Required bool                    `json:"required,omitempty" toml:"required,omitempty"`
}

type ActionType string

const (
	ActionAllow   ActionType = "allow"
	ActionBlock   ActionType = "block"
	ActionLogOnly ActionType = "log_only"
)

type Config struct {
	Version    string            `json:"version" toml:"version"`
	Rules      []Rule            `json:"rules" toml:"rules"`
	Global     GlobalConfig      `json:"global" toml:"global"`
	Metadata   map[string]string `json:"metadata,omitempty" toml:"metadata,omitempty"`
	LoadedAt   time.Time         `json:"loaded_at" toml:"loaded_at"`
}

type GlobalConfig struct {
	DefaultAlgorithm algorithm.AlgorithmConfig `json:"default_algorithm" toml:"default_algorithm"`
	Enabled          bool                      `json:"enabled" toml:"enabled"`
	LogLevel         string                    `json:"log_level,omitempty" toml:"log_level,omitempty"`
	SamplingRate     float64                   `json:"sampling_rate,omitempty" toml:"sampling_rate,omitempty"`
}

type RuleMatchResult struct {
	Rule      *Rule
	Extractors []dimension.Extractor
	Key       string
	Score     int
}

func (c *Config) Validate() error {
	if c.Version == "" {
		return ErrInvalidConfig
	}

	for i := range c.Rules {
		if err := c.Rules[i].Validate(); err != nil {
			return err
		}
	}

	if err := algorithm.ValidateConfig(c.Global.DefaultAlgorithm); err != nil {
		return err
	}

	return nil
}

func (r *Rule) Validate() error {
	if r.ID == "" {
		return ErrInvalidRuleID
	}
	if !r.Enabled {
		return nil
	}
	if len(r.Matchers) == 0 {
		return ErrNoMatchers
	}
	if len(r.Dimensions) == 0 {
		return ErrNoDimensions
	}
	if err := algorithm.ValidateConfig(r.Algorithm); err != nil {
		return err
	}

	for _, m := range r.Matchers {
		if m.Pattern == "" {
			return ErrEmptyPattern
		}
	}

	return nil
}

func (r *Rule) GetDimensionConfigs() []DimensionConfig {
	return r.Dimensions
}
