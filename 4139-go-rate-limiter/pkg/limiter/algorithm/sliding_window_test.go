package algorithm

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewSlidingWindow(t *testing.T) {
	tests := []struct {
		name       string
		rate       int64
		burst      int64
		window     time.Duration
		bucketSize time.Duration
		wantErr    bool
	}{
		{"valid config", 10, 100, time.Second, 100 * time.Millisecond, false},
		{"zero rate", 0, 100, time.Second, 100 * time.Millisecond, true},
		{"negative burst", 10, -1, time.Second, 100 * time.Millisecond, true},
		{"zero window", 10, 100, 0, 100 * time.Millisecond, true},
		{"zero bucket size", 10, 100, time.Second, 0, true},
		{"bucket size >= window", 10, 100, time.Second, time.Second, true},
		{"zero burst defaults to rate", 10, 0, time.Second, 100 * time.Millisecond, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sw, err := NewSlidingWindow(tt.rate, tt.burst, tt.window, tt.bucketSize)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if sw == nil {
				t.Errorf("expected sliding window, got nil")
			}
			if tt.burst == 0 && sw.burst != tt.rate {
				t.Errorf("expected burst to default to rate %d, got %d", tt.rate, sw.burst)
			}
		})
	}
}

func TestSlidingWindow_Allow(t *testing.T) {
	sw, err := NewSlidingWindow(10, 10, time.Second, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	sw.nowFunc = func() time.Time { return now }

	for i := 0; i < 10; i++ {
		result, err := sw.Allow(context.Background(), "test", 1)
		if err != nil {
			t.Fatal(err)
		}
		if !result.Allowed {
			t.Errorf("request %d should be allowed", i+1)
		}
	}

	result, err := sw.Allow(context.Background(), "test", 1)
	if err != nil {
		t.Fatal(err)
	}
	if result.Allowed {
		t.Error("11th request should be blocked")
	}
	if result.Remaining != 0 {
		t.Errorf("expected remaining 0, got %d", result.Remaining)
	}
}

func TestSlidingWindow_WindowSlide(t *testing.T) {
	sw, err := NewSlidingWindow(10, 10, time.Second, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	baseTime := now
	sw.nowFunc = func() time.Time { return now }

	for i := 0; i < 10; i++ {
		_, _ = sw.Allow(context.Background(), "test", 1)
	}

	result, _ := sw.Allow(context.Background(), "test", 1)
	if result.Allowed {
		t.Fatal("expected to be blocked after 10 requests")
	}

	now = baseTime.Add(500 * time.Millisecond)
	result, _ = sw.Allow(context.Background(), "test", 1)
	if result.Allowed {
		t.Fatal("expected to be blocked within window")
	}

	now = baseTime.Add(time.Second + time.Millisecond)
	result, err = sw.Allow(context.Background(), "test", 1)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Allowed {
		t.Error("expected to be allowed after window expired")
	}
}



func TestSlidingWindow_Concurrent(t *testing.T) {
	sw, err := NewSlidingWindow(100, 100, time.Second, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	var allowed int64
	var blocked int64
	concurrency := 50
	requestsPerGoroutine := 10

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < requestsPerGoroutine; j++ {
				result, err := sw.Allow(context.Background(), "concurrent", 1)
				if err != nil {
					continue
				}
				if result.Allowed {
					atomic.AddInt64(&allowed, 1)
				} else {
					atomic.AddInt64(&blocked, 1)
				}
			}
		}()
	}

	wg.Wait()

	total := atomic.LoadInt64(&allowed) + atomic.LoadInt64(&blocked)
	if total != int64(concurrency*requestsPerGoroutine) {
		t.Errorf("expected %d total requests, got %d", concurrency*requestsPerGoroutine, total)
	}

	if atomic.LoadInt64(&allowed) > 100 {
		t.Errorf("expected at most 100 allowed requests, got %d", atomic.LoadInt64(&allowed))
	}
}

func TestSlidingWindow_InvalidInput(t *testing.T) {
	sw, err := NewSlidingWindow(10, 10, time.Second, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}

	_, err = sw.Allow(context.Background(), "", 1)
	if err != ErrInvalidKey {
		t.Errorf("expected ErrInvalidKey, got %v", err)
	}

	_, err = sw.Allow(context.Background(), "test", 0)
	if err != ErrInvalidTokens {
		t.Errorf("expected ErrInvalidTokens, got %v", err)
	}

	_, err = sw.Allow(context.Background(), "test", -1)
	if err != ErrInvalidTokens {
		t.Errorf("expected ErrInvalidTokens, got %v", err)
	}
}

func TestSlidingWindow_MultipleTokens(t *testing.T) {
	sw, err := NewSlidingWindow(10, 10, time.Second, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	sw.nowFunc = func() time.Time { return now }

	result, err := sw.Allow(context.Background(), "test", 5)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Allowed {
		t.Error("request should be allowed")
	}
	if result.Remaining != 5 {
		t.Errorf("expected remaining 5, got %d", result.Remaining)
	}

	result, err = sw.Allow(context.Background(), "test", 6)
	if err != nil {
		t.Fatal(err)
	}
	if result.Allowed {
		t.Error("request should be blocked - not enough tokens")
	}
}

func TestSlidingWindow_SetRate(t *testing.T) {
	sw, err := NewSlidingWindow(10, 10, time.Second, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}

	sw.SetRate(100, 100, time.Minute)

	if sw.rate != 100 {
		t.Errorf("expected rate 100, got %d", sw.rate)
	}
	if sw.burst != 100 {
		t.Errorf("expected burst 100, got %d", sw.burst)
	}
	if sw.window != time.Minute {
		t.Errorf("expected window 1 minute, got %v", sw.window)
	}
}

func TestSlidingWindow_Reset(t *testing.T) {
	sw, err := NewSlidingWindow(10, 10, time.Second, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 5; i++ {
		_, _ = sw.Allow(context.Background(), "test", 1)
	}

	if sw.GetCount("test") != 5 {
		t.Errorf("expected count 5, got %d", sw.GetCount("test"))
	}

	sw.Reset("test")

	if sw.GetCount("test") != 0 {
		t.Errorf("expected count 0 after reset, got %d", sw.GetCount("test"))
	}
}

func TestSlidingWindow_MultipleKeys(t *testing.T) {
	sw, err := NewSlidingWindow(10, 10, time.Second, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	sw.nowFunc = func() time.Time { return now }

	for i := 0; i < 5; i++ {
		_, _ = sw.Allow(context.Background(), "key1", 1)
		_, _ = sw.Allow(context.Background(), "key2", 1)
	}

	if sw.GetCount("key1") != 5 {
		t.Errorf("expected key1 to have count 5, got %d", sw.GetCount("key1"))
	}
	if sw.GetCount("key2") != 5 {
		t.Errorf("expected key2 to have count 5, got %d", sw.GetCount("key2"))
	}
}

func TestSlidingWindow_Cleanup(t *testing.T) {
	sw, err := NewSlidingWindow(10, 10, time.Second, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	sw.nowFunc = func() time.Time { return now }

	_, _ = sw.Allow(context.Background(), "key1", 1)

	now = now.Add(time.Hour)

	sw.Cleanup(time.Minute)

	if sw.GetCount("key1") != 0 {
		t.Errorf("expected key1 to be cleaned up")
	}
}

func TestSlidingWindow_Accuracy(t *testing.T) {
	window := 100 * time.Millisecond
	bucketSize := 10 * time.Millisecond
	limit := int64(5)

	sw, err := NewSlidingWindow(limit, limit, window, bucketSize)
	if err != nil {
		t.Fatal(err)
	}

	baseTime := time.Now().Truncate(bucketSize)

	for i := 0; i < 5; i++ {
		currentTime := baseTime.Add(time.Duration(i) * bucketSize)
		sw.nowFunc = func() time.Time { return currentTime }
		result, err := sw.Allow(context.Background(), "test", 1)
		if err != nil {
			t.Fatal(err)
		}
		if !result.Allowed {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}

	currentTime := baseTime.Add(99 * time.Millisecond)
	sw.nowFunc = func() time.Time { return currentTime }
	result, err := sw.Allow(context.Background(), "test", 1)
	if err != nil {
		t.Fatal(err)
	}
	if result.Allowed {
		t.Error("6th request should be blocked - all 5 buckets still in window")
	}

	currentTime = baseTime.Add(100 * time.Millisecond)
	sw.nowFunc = func() time.Time { return currentTime }
	result, err = sw.Allow(context.Background(), "test", 1)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Allowed {
		t.Error("should be allowed at 100ms - first bucket has exactly expired")
	}

	currentTime = baseTime.Add(100*time.Millisecond - time.Nanosecond)
	sw.nowFunc = func() time.Time { return currentTime }
	result, err = sw.Allow(context.Background(), "test", 1)
	if err != nil {
		t.Fatal(err)
	}
	if result.Allowed {
		t.Error("should be blocked at 99.999999ms - first bucket not yet expired")
	}
}






