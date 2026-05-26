package ratelimiter

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

type MockRedisClient struct {
	mu       sync.Mutex
	data     map[string]interface{}
	hashData map[string]map[string]string
	zsetData map[string][]mockZItem
	ttlData  map[string]time.Time
	scripts  map[string]string
}

type mockZItem struct {
	score  float64
	member string
}

func toFloat64(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		}
	}
	return 0
}

func toInt(v interface{}) int {
	switch val := v.(type) {
	case int:
		return val
	case int64:
		return int(val)
	case float64:
		return int(val)
	case string:
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return 0
}

func toInt64(v interface{}) int64 {
	switch val := v.(type) {
	case int64:
		return val
	case int:
		return int64(val)
	case float64:
		return int64(val)
	case string:
		if i, err := strconv.ParseInt(val, 10, 64); err == nil {
			return i
		}
	}
	return 0
}

func NewMockRedisClient() *MockRedisClient {
	return &MockRedisClient{
		data:     make(map[string]interface{}),
		hashData: make(map[string]map[string]string),
		zsetData: make(map[string][]mockZItem),
		ttlData:  make(map[string]time.Time),
		scripts:  make(map[string]string),
	}
}

func (m *MockRedisClient) Eval(ctx context.Context, script string, keys []string, args ...interface{}) *redis.Cmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := redis.NewCmd(ctx)

	if strings.Contains(script, "token_bucket_algorithm") {
		result := m.execTokenBucket(keys, args)
		cmd.SetVal(result)
		return cmd
	}

	if strings.Contains(script, "sliding_window_algorithm") {
		result := m.execSlidingWindow(keys, args)
		cmd.SetVal(result)
		return cmd
	}

	cmd.SetVal([]interface{}{int64(1), int64(0), float64(10)})
	return cmd
}

func (m *MockRedisClient) execTokenBucket(keys []string, args []interface{}) []interface{} {
	key := keys[0]
	capacity := toFloat64(args[0])
	rate := toFloat64(args[1])
	now := toFloat64(args[2])
	requested := toFloat64(args[3])

	hash, ok := m.hashData[key]
	if !ok {
		hash = make(map[string]string)
		m.hashData[key] = hash
	}

	tokens := capacity
	lastRefill := now

	if tokensStr, ok := hash["tokens"]; ok {
		if t, err := strconv.ParseFloat(tokensStr, 64); err == nil {
			tokens = t
		}
	}
	if lastRefillStr, ok := hash["last_refill"]; ok {
		if t, err := strconv.ParseFloat(lastRefillStr, 64); err == nil {
			lastRefill = t
		}
	}

	elapsed := now - lastRefill
	refill := elapsed * rate
	tokens = min(capacity, tokens+refill)

	var allowed int64 = 0
	var retryAfter int64 = 0

	if tokens >= requested {
		tokens -= requested
		allowed = 1
	} else {
		needed := requested - tokens
		retryAfter = int64(needed / rate)
		if retryAfter < 1 {
			retryAfter = 1
		}
	}

	hash["tokens"] = strconv.FormatFloat(tokens, 'f', -1, 64)
	hash["last_refill"] = strconv.FormatFloat(now, 'f', -1, 64)

	return []interface{}{allowed, retryAfter, tokens}
}

func (m *MockRedisClient) execSlidingWindow(keys []string, args []interface{}) []interface{} {
	key := keys[0]
	limit := toInt(args[0])
	windowSize := toInt64(args[1])
	now := toFloat64(args[2])
	requestID := args[3].(string)

	windowStart := now - float64(windowSize)

	items, ok := m.zsetData[key]
	if !ok {
		items = make([]mockZItem, 0)
	}

	validItems := make([]mockZItem, 0)
	for _, item := range items {
		if item.score >= windowStart {
			validItems = append(validItems, item)
		}
	}
	m.zsetData[key] = validItems

	count := len(validItems)

	var allowed int64 = 0
	var retryAfter int64 = 1
	var remaining int64 = 0

	if count < limit {
		m.zsetData[key] = append(m.zsetData[key], mockZItem{
			score:  now,
			member: requestID,
		})
		allowed = 1
		remaining = int64(limit - count - 1)
	} else {
		if len(validItems) > 0 {
			oldestTime := validItems[0].score
			retryAfter = int64((oldestTime + float64(windowSize) - now) / 1000)
			if retryAfter < 1 {
				retryAfter = 1
			}
		}
		remaining = 0
	}

	if remaining < 0 {
		remaining = 0
	}

	return []interface{}{allowed, retryAfter, remaining}
}

func (m *MockRedisClient) EvalSha(ctx context.Context, sha1 string, keys []string, args ...interface{}) *redis.Cmd {
	m.mu.Lock()
	script, ok := m.scripts[sha1]
	m.mu.Unlock()

	if ok {
		return m.Eval(ctx, script, keys, args...)
	}

	cmd := redis.NewCmd(ctx)
	cmd.SetErr(redis.Nil)
	return cmd
}

func (m *MockRedisClient) ScriptExists(ctx context.Context, hashes ...string) *redis.BoolSliceCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	result := make([]bool, len(hashes))
	for i, hash := range hashes {
		_, ok := m.scripts[hash]
		result[i] = ok
	}

	cmd := redis.NewBoolSliceCmd(ctx)
	cmd.SetVal(result)
	return cmd
}

func (m *MockRedisClient) ScriptLoad(ctx context.Context, script string) *redis.StringCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	sha := ScriptSHA(script)
	m.scripts[sha] = script

	cmd := redis.NewStringCmd(ctx)
	cmd.SetVal(sha)
	return cmd
}

func (m *MockRedisClient) Get(ctx context.Context, key string) *redis.StringCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := redis.NewStringCmd(ctx)
	if val, ok := m.data[key]; ok {
		cmd.SetVal(val.(string))
	} else {
		cmd.SetErr(redis.Nil)
	}
	return cmd
}

func (m *MockRedisClient) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.StatusCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.data[key] = value
	if expiration > 0 {
		m.ttlData[key] = time.Now().Add(expiration)
	}

	cmd := redis.NewStatusCmd(ctx)
	cmd.SetVal("OK")
	return cmd
}

func (m *MockRedisClient) Del(ctx context.Context, keys ...string) *redis.IntCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	count := int64(0)
	for _, key := range keys {
		if _, ok := m.data[key]; ok {
			delete(m.data, key)
			count++
		}
		if _, ok := m.hashData[key]; ok {
			delete(m.hashData, key)
			count++
		}
		if _, ok := m.zsetData[key]; ok {
			delete(m.zsetData, key)
			count++
		}
		delete(m.ttlData, key)
	}

	cmd := redis.NewIntCmd(ctx)
	cmd.SetVal(count)
	return cmd
}

func (m *MockRedisClient) HGetAll(ctx context.Context, key string) *redis.StringStringMapCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := redis.NewStringStringMapCmd(ctx)
	if hash, ok := m.hashData[key]; ok {
		cmd.SetVal(hash)
	} else {
		cmd.SetVal(make(map[string]string))
	}
	return cmd
}

func (m *MockRedisClient) HSet(ctx context.Context, key string, values ...interface{}) *redis.IntCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.hashData[key]; !ok {
		m.hashData[key] = make(map[string]string)
	}

	count := int64(0)

	if len(values) == 1 {
		if hashMap, ok := values[0].(map[string]interface{}); ok {
			for field, v := range hashMap {
				var value string
				switch val := v.(type) {
				case string:
					value = val
				case int:
					value = strconv.Itoa(val)
				case int64:
					value = strconv.FormatInt(val, 10)
				case float64:
					value = strconv.FormatFloat(val, 'f', -1, 64)
				case bool:
					value = strconv.FormatBool(val)
				default:
					value = ""
				}
				m.hashData[key][field] = value
				count++
			}

			cmd := redis.NewIntCmd(ctx)
			cmd.SetVal(count)
			return cmd
		}
	}

	for i := 0; i < len(values); i += 2 {
		field := values[i].(string)
		var value string
		switch v := values[i+1].(type) {
		case string:
			value = v
		case int:
			value = strconv.Itoa(v)
		case int64:
			value = strconv.FormatInt(v, 10)
		case float64:
			value = strconv.FormatFloat(v, 'f', -1, 64)
		case bool:
			value = strconv.FormatBool(v)
		default:
			value = ""
		}
		m.hashData[key][field] = value
		count++
	}

	cmd := redis.NewIntCmd(ctx)
	cmd.SetVal(count)
	return cmd
}

func (m *MockRedisClient) Expire(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.ttlData[key] = time.Now().Add(expiration)

	cmd := redis.NewBoolCmd(ctx)
	cmd.SetVal(true)
	return cmd
}

func (m *MockRedisClient) ZAdd(ctx context.Context, key string, members ...*redis.Z) *redis.IntCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.zsetData[key]; !ok {
		m.zsetData[key] = make([]mockZItem, 0)
	}

	count := int64(0)
	for _, member := range members {
		z := mockZItem{
			score:  member.Score,
			member: member.Member.(string),
		}
		m.zsetData[key] = append(m.zsetData[key], z)
		count++
	}

	cmd := redis.NewIntCmd(ctx)
	cmd.SetVal(count)
	return cmd
}

func (m *MockRedisClient) ZRangeByScore(ctx context.Context, key string, opt *redis.ZRangeBy) *redis.StringSliceCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := redis.NewStringSliceCmd(ctx)

	items, ok := m.zsetData[key]
	if !ok {
		cmd.SetVal([]string{})
		return cmd
	}

	min, _ := strconv.ParseFloat(opt.Min, 64)
	max, _ := strconv.ParseFloat(opt.Max, 64)

	result := make([]string, 0)
	for _, item := range items {
		if item.score >= min && item.score <= max {
			result = append(result, item.member)
		}
	}

	cmd.SetVal(result)
	return cmd
}

func (m *MockRedisClient) ZRemRangeByScore(ctx context.Context, key string, min, max string) *redis.IntCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := redis.NewIntCmd(ctx)

	items, ok := m.zsetData[key]
	if !ok {
		cmd.SetVal(0)
		return cmd
	}

	minF, _ := strconv.ParseFloat(min, 64)
	maxF, _ := strconv.ParseFloat(max, 64)

	remaining := make([]mockZItem, 0)
	removed := int64(0)
	for _, item := range items {
		if item.score < minF || item.score > maxF {
			remaining = append(remaining, item)
		} else {
			removed++
		}
	}

	m.zsetData[key] = remaining
	cmd.SetVal(removed)
	return cmd
}

func (m *MockRedisClient) ZCount(ctx context.Context, key string, min, max string) *redis.IntCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := redis.NewIntCmd(ctx)

	items, ok := m.zsetData[key]
	if !ok {
		cmd.SetVal(0)
		return cmd
	}

	minF, _ := strconv.ParseFloat(min, 64)
	maxF, _ := strconv.ParseFloat(max, 64)

	count := int64(0)
	for _, item := range items {
		if item.score >= minF && item.score <= maxF {
			count++
		}
	}

	cmd.SetVal(count)
	return cmd
}

func (m *MockRedisClient) TTL(ctx context.Context, key string) *redis.DurationCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := redis.NewDurationCmd(ctx, 0)

	if ttl, ok := m.ttlData[key]; ok {
		cmd.SetVal(time.Until(ttl))
	} else {
		cmd.SetVal(-1 * time.Second)
	}

	return cmd
}

func (m *MockRedisClient) Scan(ctx context.Context, cursor uint64, match string, count int64) *redis.ScanCmd {
	m.mu.Lock()
	defer m.mu.Unlock()

	cmd := redis.NewScanCmd(ctx, nil, 0)

	var allKeys []string
	for k := range m.data {
		allKeys = append(allKeys, k)
	}
	for k := range m.hashData {
		allKeys = append(allKeys, k)
	}
	for k := range m.zsetData {
		allKeys = append(allKeys, k)
	}

	matched := make([]string, 0)
	for _, k := range allKeys {
		if match == "*" || strings.Contains(k, strings.Trim(match, "*")) {
			matched = append(matched, k)
		}
	}

	cmd.SetVal(matched, 0)
	return cmd
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
