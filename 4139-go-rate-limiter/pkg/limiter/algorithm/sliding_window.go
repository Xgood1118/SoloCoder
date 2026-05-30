package algorithm

import (
	"context"
	"sync"
	"time"
)

type SlidingWindow struct {
	mu         sync.Mutex
	rate       int64
	burst      int64
	window     time.Duration
	bucketSize time.Duration
	buckets    map[string]*windowState
	nowFunc    func() time.Time
}

type windowState struct {
	buckets    map[int64]int64
	lastAccess time.Time
}


func NewSlidingWindow(rate, burst int64, window, bucketSize time.Duration) (*SlidingWindow, error) {
	if rate <= 0 {
		return nil, ErrInvalidRate
	}
	if burst < 0 {
		return nil, ErrInvalidBurst
	}
	if window <= 0 {
		return nil, ErrInvalidWindow
	}
	if bucketSize <= 0 || bucketSize >= window {
		return nil, ErrInvalidBucketSize
	}
	if burst == 0 {
		burst = rate
	}

	return &SlidingWindow{
		rate:       rate,
		burst:      burst,
		window:     window,
		bucketSize: bucketSize,
		buckets:    make(map[string]*windowState),
		nowFunc:    time.Now,
	}, nil
}

func (sw *SlidingWindow) Allow(ctx context.Context, key string, tokens int64) (LimitResult, error) {
	if tokens <= 0 {
		return LimitResult{}, ErrInvalidTokens
	}
	if key == "" {
		return LimitResult{}, ErrInvalidKey
	}

	sw.mu.Lock()
	defer sw.mu.Unlock()

	now := sw.nowFunc()
	state, exists := sw.buckets[key]

	if !exists {
		state = &windowState{
			buckets:    make(map[int64]int64),
			lastAccess: now,
		}
		sw.buckets[key] = state
	}

	state.lastAccess = now
	currentBucketStart := now.Truncate(sw.bucketSize).UnixNano()
	windowStart := now.Add(-sw.window).UnixNano()

	for bucketStart := range state.buckets {
		if bucketStart <= windowStart {
			delete(state.buckets, bucketStart)
		}
	}



	var total int64
	var oldestBucketStart int64 = currentBucketStart
	for bucketStart, count := range state.buckets {
		total += count
		if bucketStart < oldestBucketStart {
			oldestBucketStart = bucketStart
		}
	}

	result := LimitResult{
		Algorithm: SlidingWindowType,
		Key:       key,
		Limit:     sw.burst,
		Consumed:  tokens,
	}

	if total+tokens <= sw.burst {
		state.buckets[currentBucketStart] += tokens
		result.Allowed = true
		result.Remaining = sw.burst - total - tokens
		result.ResetTime = now.Add(sw.window)
	} else {
		result.Allowed = false
		result.Remaining = sw.burst - total
		if result.Remaining < 0 {
			result.Remaining = 0
		}

		oldestBucketTime := time.Unix(0, oldestBucketStart)
		result.RetryAfter = oldestBucketTime.Add(sw.window).Sub(now)
		if result.RetryAfter < 0 {
			result.RetryAfter = 0
		}
		if result.RetryAfter == 0 && total > 0 {
			result.RetryAfter = time.Millisecond
		}
		result.ResetTime = now.Add(result.RetryAfter)
	}

	return result, nil
}


func (sw *SlidingWindow) SetRate(rate, burst int64, window time.Duration) {
	sw.mu.Lock()
	defer sw.mu.Unlock()

	if rate > 0 {
		sw.rate = rate
	}
	if burst >= 0 {
		sw.burst = burst
		if sw.burst == 0 {
			sw.burst = rate
		}
	}
	if window > 0 {
		sw.window = window
		sw.bucketSize = window / 10
		if sw.bucketSize == 0 {
			sw.bucketSize = time.Millisecond
		}
	}
}

func (sw *SlidingWindow) GetType() AlgorithmType {
	return SlidingWindowType
}


func (sw *SlidingWindow) Cleanup(ttl time.Duration) {
	sw.mu.Lock()
	defer sw.mu.Unlock()

	now := sw.nowFunc()
	for key, state := range sw.buckets {
		if now.Sub(state.lastAccess) > ttl {
			delete(sw.buckets, key)
		}
	}
}

func (sw *SlidingWindow) Reset(key string) {
	sw.mu.Lock()
	defer sw.mu.Unlock()
	delete(sw.buckets, key)
}

func (sw *SlidingWindow) GetCount(key string) int64 {
	sw.mu.Lock()
	defer sw.mu.Unlock()

	state, exists := sw.buckets[key]
	if !exists {
		return 0
	}

	now := sw.nowFunc()
	windowStart := now.Add(-sw.window).UnixNano()
	var total int64
	for bucketStart, count := range state.buckets {
		if bucketStart > windowStart {
			total += count
		}
	}
	return total
}




func (sw *SlidingWindow) StartCleanupLoop(ctx context.Context, interval, ttl time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				sw.Cleanup(ttl)
			case <-ctx.Done():
				return
			}
		}
	}()
}
