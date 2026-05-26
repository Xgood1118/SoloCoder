package ratelimiter

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"time"

	"github.com/go-redis/redis/v8"
)

type RedisClient interface {
	Eval(ctx context.Context, script string, keys []string, args ...interface{}) *redis.Cmd
	EvalSha(ctx context.Context, sha1 string, keys []string, args ...interface{}) *redis.Cmd
	ScriptExists(ctx context.Context, hashes ...string) *redis.BoolSliceCmd
	ScriptLoad(ctx context.Context, script string) *redis.StringCmd
	Get(ctx context.Context, key string) *redis.StringCmd
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.StatusCmd
	Del(ctx context.Context, keys ...string) *redis.IntCmd
	HGetAll(ctx context.Context, key string) *redis.StringStringMapCmd
	HSet(ctx context.Context, key string, values ...interface{}) *redis.IntCmd
	Expire(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd
	ZAdd(ctx context.Context, key string, members ...*redis.Z) *redis.IntCmd
	ZRangeByScore(ctx context.Context, key string, opt *redis.ZRangeBy) *redis.StringSliceCmd
	ZRemRangeByScore(ctx context.Context, key string, min, max string) *redis.IntCmd
	ZCount(ctx context.Context, key string, min, max string) *redis.IntCmd
	TTL(ctx context.Context, key string) *redis.DurationCmd
	Scan(ctx context.Context, cursor uint64, match string, count int64) *redis.ScanCmd
}

type redisClient struct {
	client *redis.Client
}

func NewRedisClient(addr, password string, db int) RedisClient {
	return &redisClient{
		client: redis.NewClient(&redis.Options{
			Addr:     addr,
			Password: password,
			DB:       db,
		}),
	}
}

func (r *redisClient) Eval(ctx context.Context, script string, keys []string, args ...interface{}) *redis.Cmd {
	return r.client.Eval(ctx, script, keys, args...)
}

func (r *redisClient) EvalSha(ctx context.Context, sha1 string, keys []string, args ...interface{}) *redis.Cmd {
	return r.client.EvalSha(ctx, sha1, keys, args...)
}

func (r *redisClient) ScriptExists(ctx context.Context, hashes ...string) *redis.BoolSliceCmd {
	return r.client.ScriptExists(ctx, hashes...)
}

func (r *redisClient) ScriptLoad(ctx context.Context, script string) *redis.StringCmd {
	return r.client.ScriptLoad(ctx, script)
}

func (r *redisClient) Get(ctx context.Context, key string) *redis.StringCmd {
	return r.client.Get(ctx, key)
}

func (r *redisClient) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.StatusCmd {
	return r.client.Set(ctx, key, value, expiration)
}

func (r *redisClient) Del(ctx context.Context, keys ...string) *redis.IntCmd {
	return r.client.Del(ctx, keys...)
}

func (r *redisClient) HGetAll(ctx context.Context, key string) *redis.StringStringMapCmd {
	return r.client.HGetAll(ctx, key)
}

func (r *redisClient) HSet(ctx context.Context, key string, values ...interface{}) *redis.IntCmd {
	return r.client.HSet(ctx, key, values...)
}

func (r *redisClient) Expire(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd {
	return r.client.Expire(ctx, key, expiration)
}

func (r *redisClient) ZAdd(ctx context.Context, key string, members ...*redis.Z) *redis.IntCmd {
	return r.client.ZAdd(ctx, key, members...)
}

func (r *redisClient) ZRangeByScore(ctx context.Context, key string, opt *redis.ZRangeBy) *redis.StringSliceCmd {
	return r.client.ZRangeByScore(ctx, key, opt)
}

func (r *redisClient) ZRemRangeByScore(ctx context.Context, key string, min, max string) *redis.IntCmd {
	return r.client.ZRemRangeByScore(ctx, key, min, max)
}

func (r *redisClient) ZCount(ctx context.Context, key string, min, max string) *redis.IntCmd {
	return r.client.ZCount(ctx, key, min, max)
}

func (r *redisClient) TTL(ctx context.Context, key string) *redis.DurationCmd {
	return r.client.TTL(ctx, key)
}

func (r *redisClient) Scan(ctx context.Context, cursor uint64, match string, count int64) *redis.ScanCmd {
	return r.client.Scan(ctx, cursor, match, count)
}

func ScriptSHA(script string) string {
	h := sha1.New()
	h.Write([]byte(script))
	return hex.EncodeToString(h.Sum(nil))
}
