package cache

import (
	"context"
	"time"

	"auth-service/internal/config"

	"github.com/redis/go-redis/v9"
)

var (
	Client *redis.Client
	ctx    = context.Background()
)

func Init() error {
	Client = redis.NewClient(&redis.Options{
		Addr:     config.AppConfig.Redis.Addr(),
		Password: config.AppConfig.Redis.Password,
		DB:       config.AppConfig.Redis.DB,
		PoolSize: config.AppConfig.Redis.PoolSize,
	})

	return Client.Ping(ctx).Err()
}

func Get(ctx context.Context, key string) (string, error) {
	return Client.Get(ctx, key).Result()
}

func Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return Client.Set(ctx, key, value, expiration).Err()
}

func Del(ctx context.Context, keys ...string) error {
	return Client.Del(ctx, keys...).Err()
}

func Exists(ctx context.Context, key string) (bool, error) {
	result, err := Client.Exists(ctx, key).Result()
	return result > 0, err
}

func Incr(ctx context.Context, key string) (int64, error) {
	return Client.Incr(ctx, key).Result()
}

func Expire(ctx context.Context, key string, expiration time.Duration) (bool, error) {
	return Client.Expire(ctx, key, expiration).Result()
}

func HGet(ctx context.Context, key, field string) (string, error) {
	return Client.HGet(ctx, key, field).Result()
}

func HSet(ctx context.Context, key string, values ...interface{}) error {
	return Client.HSet(ctx, key, values...).Err()
}

func HDel(ctx context.Context, key string, fields ...string) error {
	return Client.HDel(ctx, key, fields...).Err()
}

func Publish(ctx context.Context, channel string, message interface{}) error {
	return Client.Publish(ctx, channel, message).Err()
}

func Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return Client.Subscribe(ctx, channels...)
}

func RateLimitSlidingWindow(ctx context.Context, key string, limit int, window time.Duration) (bool, int, error) {
	now := time.Now().UnixNano()
	windowStart := now - window.Nanoseconds()

	pipe := Client.Pipeline()
	pipe.ZRemRangeByScore(ctx, key, "0", string(rune(windowStart)))
	pipe.ZCard(ctx, key)
	pipe.ZAdd(ctx, key, redis.Z{Score: float64(now), Member: now})
	pipe.Expire(ctx, key, window)

	results, err := pipe.Exec(ctx)
	if err != nil {
		return false, 0, err
	}

	count := results[1].(*redis.IntCmd).Val()
	remaining := limit - int(count)
	if remaining < 0 {
		remaining = 0
	}

	return count <= int64(limit), remaining, nil
}

func Lock(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	return Client.SetNX(ctx, key, value, expiration).Result()
}

func Unlock(ctx context.Context, key string) error {
	return Del(ctx, key)
}
