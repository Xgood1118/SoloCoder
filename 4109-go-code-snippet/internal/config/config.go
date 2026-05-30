package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port            int
	DBPath          string
	MaxCodeLength   int
	DefaultPageSize int
	MaxPageSize     int
}

func Load() *Config {
	return &Config{
		Port:            getEnvInt("PORT", 8080),
		DBPath:          getEnvString("DB_PATH", "snippets.db"),
		MaxCodeLength:   getEnvInt("MAX_CODE_LENGTH", 100000),
		DefaultPageSize: getEnvInt("DEFAULT_PAGE_SIZE", 20),
		MaxPageSize:     getEnvInt("MAX_PAGE_SIZE", 100),
	}
}

func getEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
