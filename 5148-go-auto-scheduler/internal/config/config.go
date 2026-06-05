package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Database  DatabaseConfig  `yaml:"database"`
	Logger    LoggerConfig    `yaml:"logger"`
	Scheduler SchedulerConfig `yaml:"scheduler"`
	Security  SecurityConfig  `yaml:"security"`
}

type ServerConfig struct {
	Host         string        `yaml:"host"`
	Port         int           `yaml:"port"`
	ReadTimeout  time.Duration `yaml:"read_timeout"`
	WriteTimeout time.Duration `yaml:"write_timeout"`
}

type DatabaseConfig struct {
	DSN string `yaml:"dsn"`
}

type LoggerConfig struct {
	LogDir        string        `yaml:"log_dir"`
	MaxFileSize   int64         `yaml:"max_file_size"`
	BufferSize    int           `yaml:"buffer_size"`
	FlushInterval time.Duration `yaml:"flush_interval"`
}

type SchedulerConfig struct {
	HeartbeatTimeout time.Duration `yaml:"heartbeat_timeout"`
	DispatchInterval time.Duration `yaml:"dispatch_interval"`
	GracePeriod      time.Duration `yaml:"grace_period"`
}

type SecurityConfig struct {
	JWTSecret       string        `yaml:"jwt_secret"`
	TokenExpiration time.Duration `yaml:"token_expiration"`
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Host:         getEnv("SERVER_HOST", "0.0.0.0"),
			Port:         getEnvInt("SERVER_PORT", 8080),
			ReadTimeout:  getEnvDuration("SERVER_READ_TIMEOUT", 30*time.Second),
			WriteTimeout: getEnvDuration("SERVER_WRITE_TIMEOUT", 30*time.Second),
		},
		Database: DatabaseConfig{
			DSN: getEnv("DATABASE_DSN", "scheduler.db"),
		},
		Logger: LoggerConfig{
			LogDir:        getEnv("LOG_DIR", "./logs"),
			MaxFileSize:   getEnvInt64("LOG_MAX_FILE_SIZE", 10*1024*1024),
			BufferSize:    getEnvInt("LOG_BUFFER_SIZE", 1000),
			FlushInterval: getEnvDuration("LOG_FLUSH_INTERVAL", 5*time.Second),
		},
		Scheduler: SchedulerConfig{
			HeartbeatTimeout: getEnvDuration("HEARTBEAT_TIMEOUT", 60*time.Second),
			DispatchInterval: getEnvDuration("DISPATCH_INTERVAL", 100*time.Millisecond),
			GracePeriod:      getEnvDuration("GRACE_PERIOD", 10*time.Second),
		},
		Security: SecurityConfig{
			JWTSecret:       getEnv("JWT_SECRET", "scheduler-secret-key-change-in-production"),
			TokenExpiration: getEnvDuration("TOKEN_EXPIRATION", 24*time.Hour),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if v, err := strconv.Atoi(value); err == nil {
			return v
		}
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if v, err := strconv.ParseInt(value, 10, 64); err == nil {
			return v
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if v, err := time.ParseDuration(value); err == nil {
			return v
		}
	}
	return defaultValue
}

func (c *Config) GetServerAddr() string {
	return fmt.Sprintf("%s:%d", c.Server.Host, c.Server.Port)
}
