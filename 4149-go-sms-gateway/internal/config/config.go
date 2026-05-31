package config

import (
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Log      LogConfig      `mapstructure:"log"`
	Redis    RedisConfig    `mapstructure:"redis"`
	Database DatabaseConfig `mapstructure:"database"`
	Channels []ChannelConfig `mapstructure:"channels"`
	Risk     RiskConfig     `mapstructure:"risk"`
	Queue    QueueConfig    `mapstructure:"queue"`
}

type ServerConfig struct {
	Port int    `mapstructure:"port"`
	Mode string `mapstructure:"mode"`
}

type LogConfig struct {
	Level          string `mapstructure:"level"`
	Path           string `mapstructure:"path"`
	AsyncBufferSize int   `mapstructure:"async_buffer_size"`
}

type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type DatabaseConfig struct {
	Driver string `mapstructure:"driver"`
	DSN    string `mapstructure:"dsn"`
}

type ChannelConfig struct {
	Name               string        `mapstructure:"name"`
	Type               string        `mapstructure:"type"`
	Enabled            bool          `mapstructure:"enabled"`
	Weight             int           `mapstructure:"weight"`
	Group              string        `mapstructure:"group"`
	Endpoint           string        `mapstructure:"endpoint"`
	AccessKeyID        string        `mapstructure:"access_key_id"`
	AccessKeySecret    string        `mapstructure:"access_key_secret"`
	SecretID           string        `mapstructure:"secret_id"`
	SecretKey          string        `mapstructure:"secret_key"`
	AppID              string        `mapstructure:"app_id"`
	SignName           string        `mapstructure:"sign_name"`
	Sign               string        `mapstructure:"sign"`
	Timeout            time.Duration `mapstructure:"timeout"`
	MaxRetries         int           `mapstructure:"max_retries"`
	RateLimit          int           `mapstructure:"rate_limit"`
	HealthCheckInterval time.Duration `mapstructure:"health_check_interval"`
	FailureThreshold   float64       `mapstructure:"failure_threshold"`
	FailureWindow      time.Duration `mapstructure:"failure_window"`
}

type RiskConfig struct {
	SensitiveWords []string          `mapstructure:"sensitive_words"`
	FrequencyLimit FrequencyLimitConfig `mapstructure:"frequency_limit"`
}

type FrequencyLimitConfig struct {
	PhoneDailyLimit  int `mapstructure:"phone_daily_limit"`
	PhoneHourlyLimit int `mapstructure:"phone_hourly_limit"`
	IPDailyLimit     int `mapstructure:"ip_daily_limit"`
}

type QueueConfig struct {
	MaxSize     int `mapstructure:"max_size"`
	WorkerCount int `mapstructure:"worker_count"`
}

var GlobalConfig *Config

func Load(path string) error {
	v := viper.New()
	v.SetConfigFile(path)
	v.SetConfigType("yaml")

	if err := v.ReadInConfig(); err != nil {
		return err
	}

	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return err
	}

	GlobalConfig = &config
	return nil
}
