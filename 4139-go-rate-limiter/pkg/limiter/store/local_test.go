package store

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/solo/ratelimiter/pkg/limiter/algorithm"
)

func TestNewLocalStore(t *testing.T) {
	cfg := algorithm.AlgorithmConfig{
		Type:   algorithm.TokenBucketType,
		Rate:   10,
		Burst:  100,
		Window: time.Second,
	}

	store, err := NewLocalStore(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if store == nil {
		t.Fatal("expected store, got nil")
	}
	if store.GetType() != StoreTypeLocal {
		t.Errorf("expected type %s, got %s", StoreTypeLocal, store.GetType())
	}
}

func TestLocalStore_Allow(t *testing.T) {
	cfg := algorithm.AlgorithmConfig{
		Type:   algorithm.TokenBucketType,
		Rate:   10,
		Burst:  10,
		Window: time.Second,
	}

	store, err := NewLocalStore(cfg)
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()

	for i := 0; i < 10; i++ {
		result, err := store.Allow(ctx, "test", 1, cfg)
		if err != nil {
			t.Fatal(err)
		}
		if !result.Allowed {
			t.Errorf("request %d should be allowed", i+1)
		}
	}

	result, err := store.Allow(ctx, "test", 1, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if result.Allowed {
		t.Error("11th request should be blocked")
	}

	stats := store.GetStats()
	if stats.TotalRequests != 11 {
		t.Errorf("expected 11 total requests, got %d", stats.TotalRequests)
	}
	if stats.AllowedRequests != 10 {
		t.Errorf("expected 10 allowed requests, got %d", stats.AllowedRequests)
	}
	if stats.BlockedRequests != 1 {
		t.Errorf("expected 1 blocked request, got %d", stats.BlockedRequests)
	}
}

func TestLocalStore_Concurrent(t *testing.T) {
	cfg := algorithm.AlgorithmConfig{
		Type:   algorithm.TokenBucketType,
		Rate:   100,
		Burst:  100,
		Window: time.Second,
	}

	store, err := NewLocalStore(cfg)
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
				result, err := store.Allow(context.Background(), "concurrent", 1, cfg)
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

func TestLocalStore_Reset(t *testing.T) {
	cfg := algorithm.AlgorithmConfig{
		Type:   algorithm.TokenBucketType,
		Rate:   10,
		Burst:  10,
		Window: time.Second,
	}

	store, err := NewLocalStore(cfg)
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()

	for i := 0; i < 5; i++ {
		_, _ = store.Allow(ctx, "test", 1, cfg)
	}

	result, _ := store.Allow(ctx, "test", 6, cfg)
	if result.Allowed {
		t.Error("expected to be blocked after using 5 tokens")
	}

	err = store.Reset(ctx, "test")
	if err != nil {
		t.Fatal(err)
	}

	result, err = store.Allow(ctx, "test", 10, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Allowed {
		t.Error("expected to be allowed after reset")
	}
}

func TestLocalStore_SetRate(t *testing.T) {
	cfg := algorithm.AlgorithmConfig{
		Type:   algorithm.TokenBucketType,
		Rate:   10,
		Burst:  10,
		Window: time.Second,
	}

	store, err := NewLocalStore(cfg)
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()

	newCfg := algorithm.AlgorithmConfig{
		Type:   algorithm.TokenBucketType,
		Rate:   100,
		Burst:  100,
		Window: time.Minute,
	}

	err = store.SetRate(ctx, "test", newCfg)
	if err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 100; i++ {
		result, err := store.Allow(ctx, "test", 1, newCfg)
		if err != nil {
			t.Fatal(err)
		}
		if !result.Allowed {
			t.Errorf("request %d should be allowed with new rate", i+1)
		}
	}
}

func TestLocalStore_GetStatus(t *testing.T) {
	cfg := algorithm.AlgorithmConfig{
		Type:   algorithm.TokenBucketType,
		Rate:   10,
		Burst:  10,
		Window: time.Second,
	}

	store, err := NewLocalStore(cfg)
	if err != nil {
		t.Fatal(err)
	}

	status := store.GetStatus(context.Background())
	if status != StatusHealthy {
		t.Errorf("expected status %s, got %s", StatusHealthy, status)
	}
}

func TestLocalStore_SlidingWindow(t *testing.T) {
	cfg := algorithm.AlgorithmConfig{
		Type:       algorithm.SlidingWindowType,
		Rate:       10,
		Burst:      10,
		Window:     time.Second,
		BucketSize: 100 * time.Millisecond,
	}

	store, err := NewLocalStore(cfg)
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()

	for i := 0; i < 10; i++ {
		result, err := store.Allow(ctx, "test", 1, cfg)
		if err != nil {
			t.Fatal(err)
		}
		if !result.Allowed {
			t.Errorf("request %d should be allowed", i+1)
		}
	}

	result, err := store.Allow(ctx, "test", 1, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if result.Allowed {
		t.Error("11th request should be blocked")
	}
}

func TestLocalStore_MultipleKeys(t *testing.T) {
	cfg := algorithm.AlgorithmConfig{
		Type:   algorithm.TokenBucketType,
		Rate:   10,
		Burst:  10,
		Window: time.Second,
	}

	store, err := NewLocalStore(cfg)
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()

	for i := 0; i < 5; i++ {
		_, _ = store.Allow(ctx, "key1", 1, cfg)
		_, _ = store.Allow(ctx, "key2", 1, cfg)
	}

	result1, _ := store.Allow(ctx, "key1", 6, cfg)
	if result1.Allowed {
		t.Error("key1 should be blocked after 5 requests")
	}

	result2, _ := store.Allow(ctx, "key2", 6, cfg)
	if result2.Allowed {
		t.Error("key2 should be blocked after 5 requests")
	}
}

func TestLocalStore_Close(t *testing.T) {
	cfg := algorithm.AlgorithmConfig{
		Type:   algorithm.TokenBucketType,
		Rate:   10,
		Burst:  10,
		Window: time.Second,
	}

	store, err := NewLocalStore(cfg)
	if err != nil {
		t.Fatal(err)
	}

	_, _ = store.Allow(context.Background(), "test", 1, cfg)

	err = store.Close()
	if err != nil {
		t.Fatal(err)
	}

	stats := store.GetStats()
	if stats.TotalRequests != 1 {
		t.Errorf("expected stats to persist after close, got %d total requests", stats.TotalRequests)
	}
}
