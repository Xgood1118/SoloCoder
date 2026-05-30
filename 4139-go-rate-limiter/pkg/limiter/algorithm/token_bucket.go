package algorithm

import (
	"context"
	"sync"
	"time"
)

type TokenBucket struct {
	mu          sync.Mutex
	rate        int64
	burst       int64
	window      time.Duration
	tokens      map[string]*bucketState
	nowFunc     func() time.Time
}

type bucketState struct {
	tokens     int64
	lastRefill time.Time
}

func NewTokenBucket(rate, burst int64, window time.Duration) (*TokenBucket, error) {
	if rate <= 0 {
		return nil, ErrInvalidRate
	}
	if burst < 0 {
		return nil, ErrInvalidBurst
	}
	if window <= 0 {
		return nil, ErrInvalidWindow
	}
	if burst == 0 {
		burst = rate
	}

	return &TokenBucket{
		rate:    rate,
		burst:   burst,
		window:  window,
		tokens:  make(map[string]*bucketState),
		nowFunc: time.Now,
	}, nil
}

func (tb *TokenBucket) Allow(ctx context.Context, key string, tokens int64) (LimitResult, error) {
	if tokens <= 0 {
		return LimitResult{}, ErrInvalidTokens
	}
	if key == "" {
		return LimitResult{}, ErrInvalidKey
	}


	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := tb.nowFunc()
	state, exists := tb.tokens[key]
	if !exists {
		state = &bucketState{
			tokens:     tb.burst,
			lastRefill: now,
		}
		tb.tokens[key] = state
	}

	elapsed := now.Sub(state.lastRefill)
	refillAmount := int64(float64(elapsed) / float64(tb.window) * float64(tb.rate))

	if refillAmount > 0 {
		state.tokens += refillAmount
		if state.tokens > tb.burst {
			state.tokens = tb.burst
		}
		state.lastRefill = state.lastRefill.Add(time.Duration(float64(refillAmount) / float64(tb.rate) * float64(tb.window)))
	}

	result := LimitResult{
		Algorithm: TokenBucketType,
		Key:       key,
		Limit:     tb.burst,
		Consumed:  tokens,
	}


	if state.tokens >= tokens {
		state.tokens -= tokens
		result.Allowed = true
		result.Remaining = state.tokens
		result.ResetTime = now.Add(tb.window)
	} else {
		result.Allowed = false
		result.Remaining = state.tokens
		deficit := tokens - state.tokens
		result.RetryAfter = time.Duration(float64(deficit) * float64(tb.window) / float64(tb.rate))
		if result.RetryAfter <= 0 {
			result.RetryAfter = time.Millisecond
		}
		result.ResetTime = now.Add(result.RetryAfter)
	}


	return result, nil
}

func (tb *TokenBucket) SetRate(rate, burst int64, window time.Duration) {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	if rate > 0 {
		tb.rate = rate
	}
	if burst >= 0 {
		tb.burst = burst
		if tb.burst == 0 {
			tb.burst = rate
		}
	}
	if window > 0 {
		tb.window = window
	}
}

func (tb *TokenBucket) GetType() AlgorithmType {
	return TokenBucketType
}


func (tb *TokenBucket) Cleanup(ttl time.Duration) {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := tb.nowFunc()
	for key, state := range tb.tokens {
		if now.Sub(state.lastRefill) > ttl {
			delete(tb.tokens, key)
		}
	}
}


func (tb *TokenBucket) Reset(key string) {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	delete(tb.tokens, key)
}

func (tb *TokenBucket) GetTokens(key string) int64 {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	state, exists := tb.tokens[key]
	if !exists {
		return tb.burst
	}
	return state.tokens
}

func (tb *TokenBucket) StartCleanupLoop(ctx context.Context, interval, ttl time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				tb.Cleanup(ttl)
			case <-ctx.Done():
				return
			}
		}
	}()
}
