package algorithm

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewTokenBucket(t *testing.T) {
	tests := []struct {
		name      string
		rate      int64
		burst     int64
		window    time.Duration
		wantErr   bool
		errReason string
	}{
		{"valid config", 10, 100, time.Second, false, ""},
		{"zero rate", 0, 100, time.Second, true, "rate must be > 0"},
		{"negative burst", 10, -1, time.Second, true, "burst must be >= 0"},
		{"zero window", 10, 100, 0, true, "window must be > 0"},
		{"zero burst defaults to rate", 10, 0, time.Second, false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tb, err := NewTokenBucket(tt.rate, tt.burst, tt.window)
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
			if tb == nil {
				t.Errorf("expected token bucket, got nil")
			}
			if tt.burst == 0 && tb.burst != tt.rate {
				t.Errorf("expected burst to default to rate %d, got %d", tt.rate, tb.burst)
			}
		})
	}
}

func TestTokenBucket_Allow(t *testing.T) {
	tb, err := NewTokenBucket(10, 10, time.Second)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	tb.nowFunc = func() time.Time { return now }

	for i := 0; i < 10; i++ {
		result, err := tb.Allow(context.Background(), "test", 1)
		if err != nil {
			t.Fatal(err)
		}
		if !result.Allowed {
			t.Errorf("request %d should be allowed", i+1)
		}
		if result.Remaining != int64(9-i) {
			t.Errorf("expected remaining %d, got %d", 9-i, result.Remaining)
		}
	}

	result, err := tb.Allow(context.Background(), "test", 1)
	if err != nil {
		t.Fatal(err)
	}
	if result.Allowed {
		t.Error("11th request should be blocked")
	}
	if result.Remaining != 0 {
		t.Errorf("expected remaining 0, got %d", result.Remaining)
	}
	if result.RetryAfter <= 0 {
		t.Error("expected retry after > 0")
	}
}

func TestTokenBucket_AllowMultipleTokens(t *testing.T) {
	tb, err := NewTokenBucket(10, 10, time.Second)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	tb.nowFunc = func() time.Time { return now }

	result, err := tb.Allow(context.Background(), "test", 5)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Allowed {
		t.Error("request should be allowed")
	}
	if result.Remaining != 5 {
		t.Errorf("expected remaining 5, got %d", result.Remaining)
	}
	if result.Consumed != 5 {
		t.Errorf("expected consumed 5, got %d", result.Consumed)
	}

	result, err = tb.Allow(context.Background(), "test", 6)
	if err != nil {
		t.Fatal(err)
	}
	if result.Allowed {
		t.Error("request should be blocked - not enough tokens")
	}
}

func TestTokenBucket_TokenRefill(t *testing.T) {
	tb, err := NewTokenBucket(10, 10, time.Second)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	tb.nowFunc = func() time.Time { return now }

	for i := 0; i < 10; i++ {
		_, err := tb.Allow(context.Background(), "test", 1)
		if err != nil {
			t.Fatal(err)
		}
	}

	result, _ := tb.Allow(context.Background(), "test", 1)
	if result.Allowed {
		t.Fatal("expected to be blocked after consuming all tokens")
	}

	now = now.Add(500 * time.Millisecond)

	result, err = tb.Allow(context.Background(), "test", 1)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Allowed {
		t.Error("expected to be allowed after 500ms - should have 5 tokens refilled")
	}
	if result.Remaining != 4 {
		t.Errorf("expected remaining 4, got %d", result.Remaining)
	}
}

func TestTokenBucket_Concurrent(t *testing.T) {
	tb, err := NewTokenBucket(100, 100, time.Second)
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
				result, err := tb.Allow(context.Background(), "concurrent", 1)
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

func TestTokenBucket_InvalidInput(t *testing.T) {
	tb, err := NewTokenBucket(10, 10, time.Second)
	if err != nil {
		t.Fatal(err)
	}

	_, err = tb.Allow(context.Background(), "", 1)
	if err != ErrInvalidKey {
		t.Errorf("expected ErrInvalidKey, got %v", err)
	}

	_, err = tb.Allow(context.Background(), "test", 0)
	if err != ErrInvalidTokens {
		t.Errorf("expected ErrInvalidTokens, got %v", err)
	}

	_, err = tb.Allow(context.Background(), "test", -1)
	if err != ErrInvalidTokens {
		t.Errorf("expected ErrInvalidTokens, got %v", err)
	}
}

func TestTokenBucket_SetRate(t *testing.T) {
	tb, err := NewTokenBucket(10, 10, time.Second)
	if err != nil {
		t.Fatal(err)
	}

	tb.SetRate(100, 100, time.Minute)

	if tb.rate != 100 {
		t.Errorf("expected rate 100, got %d", tb.rate)
	}
	if tb.burst != 100 {
		t.Errorf("expected burst 100, got %d", tb.burst)
	}
	if tb.window != time.Minute {
		t.Errorf("expected window 1 minute, got %v", tb.window)
	}
}

func TestTokenBucket_Reset(t *testing.T) {
	tb, err := NewTokenBucket(10, 10, time.Second)
	if err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 5; i++ {
		_, _ = tb.Allow(context.Background(), "test", 1)
	}

	if tb.GetTokens("test") != 5 {
		t.Errorf("expected 5 tokens, got %d", tb.GetTokens("test"))
	}

	tb.Reset("test")

	if tb.GetTokens("test") != 10 {
		t.Errorf("expected 10 tokens after reset, got %d", tb.GetTokens("test"))
	}
}

func TestTokenBucket_MultipleKeys(t *testing.T) {
	tb, err := NewTokenBucket(10, 10, time.Second)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	tb.nowFunc = func() time.Time { return now }

	for i := 0; i < 5; i++ {
		_, _ = tb.Allow(context.Background(), "key1", 1)
		_, _ = tb.Allow(context.Background(), "key2", 1)
	}

	if tb.GetTokens("key1") != 5 {
		t.Errorf("expected key1 to have 5 tokens, got %d", tb.GetTokens("key1"))
	}
	if tb.GetTokens("key2") != 5 {
		t.Errorf("expected key2 to have 5 tokens, got %d", tb.GetTokens("key2"))
	}
}

func TestTokenBucket_Cleanup(t *testing.T) {
	tb, err := NewTokenBucket(10, 10, time.Second)
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now()
	tb.nowFunc = func() time.Time { return now }

	_, _ = tb.Allow(context.Background(), "key1", 1)

	now = now.Add(time.Hour)

	tb.Cleanup(time.Minute)

	if tb.GetTokens("key1") != 10 {
		t.Errorf("expected key1 to be reset to full after cleanup")
	}
}
