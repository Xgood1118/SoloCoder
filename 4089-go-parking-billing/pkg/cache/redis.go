package cache

import (
	"context"

	"parking-billing/config"

	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

func Init(cfg config.RedisConfig) error {
	RDB = redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})
	return RDB.Ping(context.Background()).Err()
}
