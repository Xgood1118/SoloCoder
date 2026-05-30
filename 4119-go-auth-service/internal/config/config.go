package config

import (
	"fmt"

	"github.com/spf13/viper"
)

type Config struct {
	Server     ServerConfig     `mapstructure:"server"`
	Database   DatabaseConfig   `mapstructure:"database"`
	Redis      RedisConfig      `mapstructure:"redis"`
	JWT        JWTConfig        `mapstructure:"jwt"`
	Security   SecurityConfig   `mapstructure:"security"`
	SSO        SSOConfig        `mapstructure:"sso"`
	RateLimit  RateLimitConfig  `mapstructure:"rate_limit"`
	MultiDevice MultiDeviceConfig `mapstructure:"multi_device"`
	SMS        SMSConfig        `mapstructure:"sms"`
	Email      EmailConfig      `mapstructure:"email"`
}

type ServerConfig struct {
	Port int    `mapstructure:"port"`
	Mode string `mapstructure:"mode"`
}

type DatabaseConfig struct {
	Host         string `mapstructure:"host"`
	Port         int    `mapstructure:"port"`
	User         string `mapstructure:"user"`
	Password     string `mapstructure:"password"`
	Database     string `mapstructure:"database"`
	MaxIdleConns int    `mapstructure:"max_idle_conns"`
	MaxOpenConns int    `mapstructure:"max_open_conns"`
}

type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
	PoolSize int    `mapstructure:"pool_size"`
}

type JWTConfig struct {
	AccessTokenExpire  int    `mapstructure:"access_token_expire"`
	RefreshTokenExpire int `mapstructure:"refresh_token_expire"`
	Issuer string `mapstructure:"issuer"`
}

type SecurityConfig struct {
	BcryptCost      int `mapstructure:"bcrypt_cost"`
	MaxLoginAttempts int `mapstructure:"max_login_attempts"`
	LockDuration    int `mapstructure:"lock_duration"`
}

type SSOConfig struct {
	Enabled    bool   `mapstructure:"enabled"`
	Domain     string `mapstructure:"domain"`
	CookieName string `mapstructure:"cookie_name"`
}

type RateLimitConfig struct {
	Enabled       bool `mapstructure:"enabled"`
	DefaultLimit  int  `mapstructure:"default_limit"`
	WindowSeconds int  `mapstructure:"window_seconds"`
	LoginLimit    int  `mapstructure:"login_limit"`
	RegisterLimit int  `mapstructure:"register_limit"`
}

type MultiDeviceConfig struct {
	Enabled     bool `mapstructure:"enabled"`
	MaxSessions int `mapstructure:"max_sessions"`
}

type SMSConfig struct {
	Provider          string `mapstructure:"provider"`
	AccessKeyID       string `mapstructure:"access_key_id"`
	AccessKeySecret   string `mapstructure:"access_key_secret"`
	SignName          string `mapstructure:"sign_name"`
	TemplateCode      string `mapstructure:"template_code"`
}

type EmailConfig struct {
	SMTPHost string `mapstructure:"smtp_host"`
	SMTPPort int    `mapstructure:"smtp_port"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	From     string `mapstructure:"from"`
}

var AppConfig *Config

func Load() error {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("./config")
	viper.AddConfigPath(".")

	if err := viper.ReadInConfig(); err != nil {
		return fmt.Errorf("read config file failed: %w", err)
	}

	AppConfig = &Config{}
	if err := viper.Unmarshal(AppConfig); err != nil {
		return fmt.Errorf("unmarshal config failed: %w", err)
	}

	return nil
}

func (c *DatabaseConfig) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		c.User, c.Password, c.Host, c.Port, c.Database)
}

func (c *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}
