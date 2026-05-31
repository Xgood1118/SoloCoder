package limiter

import (
	"context"
	"errors"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type Task interface {
	Process()
}

type TaskQueue struct {
	tasks     chan Task
	maxSize   int
	closed    bool
	closeChan chan struct{}
	mu        sync.RWMutex
}

func NewTaskQueue(maxSize int) *TaskQueue {
	return &TaskQueue{
		tasks:     make(chan Task, maxSize),
		maxSize:   maxSize,
		closeChan: make(chan struct{}),
	}
}

func (q *TaskQueue) Push(task interface{}) error {
	q.mu.RLock()
	defer q.mu.RUnlock()

	if q.closed {
		return errors.New("queue is closed")
	}

	t, ok := task.(Task)
	if !ok {
		return errors.New("invalid task type")
	}

	select {
	case q.tasks <- t:
		return nil
	default:
		return errors.New("queue is full")
	}
}

func (q *TaskQueue) Process(workerCount int) {
	for {
		select {
		case task := <-q.tasks:
			func() {
				defer func() {
					if r := recover(); r != nil {
					}
				}()
				task.Process()
			}()
		case <-q.closeChan:
			return
		}
	}
}

func (q *TaskQueue) Len() int {
	return len(q.tasks)
}

func (q *TaskQueue) Close() {
	q.mu.Lock()
	defer q.mu.Unlock()

	if !q.closed {
		q.closed = true
		close(q.closeChan)
		close(q.tasks)
	}
}

type RateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	defaultRate rate.Limit
	defaultBurst int
}

func NewRateLimiter(defaultRatePerSec float64, defaultBurst int) *RateLimiter {
	return &RateLimiter{
		limiters:     make(map[string]*rate.Limiter),
		defaultRate:  rate.Limit(defaultRatePerSec),
		defaultBurst: defaultBurst,
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.RLock()
	limiter, exists := rl.limiters[key]
	rl.mu.RUnlock()

	if !exists {
		rl.mu.Lock()
		limiter = rate.NewLimiter(rl.defaultRate, rl.defaultBurst)
		rl.limiters[key] = limiter
		rl.mu.Unlock()
	}

	return limiter.Allow()
}

func (rl *RateLimiter) AllowN(key string, n int) bool {
	rl.mu.RLock()
	limiter, exists := rl.limiters[key]
	rl.mu.RUnlock()

	if !exists {
		rl.mu.Lock()
		limiter = rate.NewLimiter(rl.defaultRate, rl.defaultBurst)
		rl.limiters[key] = limiter
		rl.mu.Unlock()
	}

	return limiter.AllowN(time.Now(), n)
}

func (rl *RateLimiter) SetLimit(key string, ratePerSec float64, burst int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	rl.limiters[key] = rate.NewLimiter(rate.Limit(ratePerSec), burst)
}

func (rl *RateLimiter) Wait(ctx context.Context, key string) error {
	rl.mu.RLock()
	limiter, exists := rl.limiters[key]
	rl.mu.RUnlock()

	if !exists {
		rl.mu.Lock()
		limiter = rate.NewLimiter(rl.defaultRate, rl.defaultBurst)
		rl.limiters[key] = limiter
		rl.mu.Unlock()
	}

	return limiter.Wait(ctx)
}

type TokenBucket struct {
	capacity  int64
	tokens    int64
	rate      time.Duration
	lastCheck time.Time
	mu        sync.Mutex
}

func NewTokenBucket(capacity int64, fillRate time.Duration) *TokenBucket {
	return &TokenBucket{
		capacity:  capacity,
		tokens:    capacity,
		rate:      fillRate,
		lastCheck: time.Now(),
	}
}

func (tb *TokenBucket) Take() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(tb.lastCheck)

	newTokens := int64(elapsed / tb.rate)
	if newTokens > 0 {
		tb.tokens += newTokens
		if tb.tokens > tb.capacity {
			tb.tokens = tb.capacity
		}
		tb.lastCheck = now
	}

	if tb.tokens > 0 {
		tb.tokens--
		return true
	}
	return false
}

func (tb *TokenBucket) TakeN(n int64) bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(tb.lastCheck)

	newTokens := int64(elapsed / tb.rate)
	if newTokens > 0 {
		tb.tokens += newTokens
		if tb.tokens > tb.capacity {
			tb.tokens = tb.capacity
		}
		tb.lastCheck = now
	}

	if tb.tokens >= n {
		tb.tokens -= n
		return true
	}
	return false
}

type MultiRateLimiter struct {
	globalLimiter *RateLimiter
	channelLimiters map[string]*RateLimiter
	ipLimiters    *RateLimiter
	phoneLimiters *RateLimiter
}

func NewMultiRateLimiter(globalRate float64, globalBurst int) *MultiRateLimiter {
	return &MultiRateLimiter{
		globalLimiter:   NewRateLimiter(globalRate, globalBurst),
		channelLimiters: make(map[string]*RateLimiter),
		ipLimiters:      NewRateLimiter(100, 200),
		phoneLimiters:   NewRateLimiter(1, 5),
	}
}

func (mrl *MultiRateLimiter) Allow(channel, ip, phone string) bool {
	if !mrl.globalLimiter.Allow("global") {
		return false
	}

	if channel != "" {
		if limiter, ok := mrl.channelLimiters[channel]; ok {
			if !limiter.Allow(channel) {
				return false
			}
		}
	}

	if ip != "" && !mrl.ipLimiters.Allow(ip) {
		return false
	}

	if phone != "" && !mrl.phoneLimiters.Allow(phone) {
		return false
	}

	return true
}

func (mrl *MultiRateLimiter) SetChannelLimit(channel string, rate float64, burst int) {
	mrl.channelLimiters[channel] = NewRateLimiter(rate, burst)
}
