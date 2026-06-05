package config

import (
	"fmt"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server     ServerConfig     `mapstructure:"server"`
	Database   DatabaseConfig   `mapstructure:"database"`
	Log        LogConfig        `mapstructure:"log"`
	Datasource DatasourceConfig `mapstructure:"datasource"`
	Pipeline   PipelineConfig   `mapstructure:"pipeline"`
	Alert      AlertConfig      `mapstructure:"alert"`
	Monitor    MonitorConfig    `mapstructure:"monitor"`
}

type ServerConfig struct {
	Port int    `mapstructure:"port"`
	Mode string `mapstructure:"mode"`
}

type DatabaseConfig struct {
	Driver string `mapstructure:"driver"`
	DSN    string `mapstructure:"dsn"`
}

type LogConfig struct {
	Level    string `mapstructure:"level"`
	FilePath string `mapstructure:"filepath"`
}

type DatasourceConfig struct {
	WorkerPoolSize   int `mapstructure:"worker_pool_size"`
	ChannelBufferSize int `mapstructure:"channel_buffer_size"`
}

type PipelineConfig struct {
	WorkerPoolSize    int `mapstructure:"worker_pool_size"`
	ChannelBufferSize int `mapstructure:"channel_buffer_size"`
}

type AlertConfig struct {
	CheckInterval   time.Duration `mapstructure:"check_interval"`
	EmailSMTPHost   string        `mapstructure:"email_smtp_host"`
	EmailSMTPPort   int           `mapstructure:"email_smtp_port"`
	EmailUsername   string        `mapstructure:"email_username"`
	EmailPassword   string        `mapstructure:"email_password"`
	EmailFrom       string        `mapstructure:"email_from"`
}

type MonitorConfig struct {
	MetricInterval time.Duration `mapstructure:"metric_interval"`
	RetentionDays  int           `mapstructure:"retention_days"`
}

var AppConfig *Config

func Load() error {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("./configs")
	viper.AddConfigPath(".")

	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.mode", "debug")
	viper.SetDefault("database.driver", "sqlite")
	viper.SetDefault("database.dsn", "./log_pipeline.db")
	viper.SetDefault("log.level", "debug")
	viper.SetDefault("log.filepath", "./logs/app.log")
	viper.SetDefault("datasource.worker_pool_size", 10)
	viper.SetDefault("datasource.channel_buffer_size", 1000)
	viper.SetDefault("pipeline.worker_pool_size", 20)
	viper.SetDefault("pipeline.channel_buffer_size", 2000)
	viper.SetDefault("alert.check_interval", "10s")
	viper.SetDefault("monitor.metric_interval", "5s")
	viper.SetDefault("monitor.retention_days", 7)

	if err := viper.ReadInConfig(); err != nil {
		fmt.Printf("Warning: %v, using default config\n", err)
	}

	AppConfig = &Config{}
	if err := viper.Unmarshal(AppConfig); err != nil {
		return fmt.Errorf("unmarshal config: %w", err)
	}

	return nil
}
