package store

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/solo/ratelimiter/pkg/limiter/algorithm"
)

type HybridStore struct {
	redisStore       *RedisStore
	localStore       *LocalStore
	mu               sync.RWMutex
	status           StoreStatus
	degradeThreshold int
	recoverThreshold int
	consecutiveOk    int32
	consecutiveErr   int32
	stats            StoreStats
	nowFunc          func() time.Time
	checkInterval    time.Duration
	ctx              context.Context
	cancel           context.CancelFunc
}

func NewHybridStore(redisStore *RedisStore, localStore *LocalStore, degradeThreshold, recoverThreshold int, checkInterval time.Duration) (*HybridStore, error) {
	if redisStore == nil {
		return nil, ErrInvalidConfig
	}
	if localStore == nil {
		return nil, ErrInvalidConfig
	}
	if degradeThreshold <= 0 {
		degradeThreshold = 3
	}
	if recoverThreshold <= 0 {
		recoverThreshold = 5
	}
	if checkInterval <= 0 {
		checkInterval = time.Second * 10
	}

	ctx, cancel := context.WithCancel(context.Background())

	hs := &HybridStore{
		redisStore:       redisStore,
		localStore:       localStore,
		status:           StatusHealthy,
		degradeThreshold: degradeThreshold,
		recoverThreshold: recoverThreshold,
		nowFunc:          time.Now,
		checkInterval:    checkInterval,
		ctx:              ctx,
		cancel:           cancel,
	}

	hs.startHealthCheck()

	return hs, nil
}

func (hs *HybridStore) startHealthCheck() {
	ticker := time.NewTicker(hs.checkInterval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				hs.checkRedisHealth()
			case <-hs.ctx.Done():
				return
			}
		}
	}()
}

func (hs *HybridStore) checkRedisHealth() {
	hs.mu.RLock()
	currentStatus := hs.status
	hs.mu.RUnlock()

	if currentStatus == StatusDegraded {
		err := hs.redisStore.CheckHealth(hs.ctx)
		if err == nil {
			atomic.AddInt32(&hs.consecutiveOk, 1)
			if atomic.LoadInt32(&hs.consecutiveOk) >= int32(hs.recoverThreshold) {
				hs.mu.Lock()
				hs.status = StatusHealthy
				hs.stats.RecoveredCount++
				atomic.StoreInt32(&hs.consecutiveOk, 0)
				hs.mu.Unlock()
			}
		} else {
			atomic.StoreInt32(&hs.consecutiveOk, 0)
		}
	}
}

func (hs *HybridStore) Allow(ctx context.Context, key string, tokens int64, cfg algorithm.AlgorithmConfig) (algorithm.LimitResult, error) {
	hs.mu.RLock()
	currentStatus := hs.status
	hs.mu.RUnlock()

	hs.mu.Lock()
	hs.stats.TotalRequests++
	hs.mu.Unlock()

	if currentStatus == StatusHealthy {
		result, err := hs.redisStore.Allow(ctx, key, tokens, cfg)
		if err == nil {
			atomic.StoreInt32(&hs.consecutiveErr, 0)
			return result, nil
		}

		atomic.AddInt32(&hs.consecutiveErr, 1)
		hs.mu.Lock()
		hs.stats.RedisErrors++
		hs.stats.LastError = err
		hs.stats.LastErrorTime = hs.nowFunc()
		hs.mu.Unlock()

		if atomic.LoadInt32(&hs.consecutiveErr) >= int32(hs.degradeThreshold) {
			hs.mu.Lock()
			hs.status = StatusDegraded
			hs.stats.DegradedCount++
			atomic.StoreInt32(&hs.consecutiveOk, 0)
			hs.mu.Unlock()
		}
	}

	result, err := hs.localStore.Allow(ctx, key, tokens, cfg)
	if err == nil {
		hs.mu.Lock()
		if result.Allowed {
			hs.stats.AllowedRequests++
		} else {
			hs.stats.BlockedRequests++
		}
		hs.mu.Unlock()
	}
	return result, err
}

func (hs *HybridStore) SetRate(ctx context.Context, key string, cfg algorithm.AlgorithmConfig) error {
	hs.mu.RLock()
	currentStatus := hs.status
	hs.mu.RUnlock()

	var firstErr error

	if currentStatus == StatusHealthy {
		if err := hs.redisStore.SetRate(ctx, key, cfg); err != nil {
			firstErr = err
		}
	}

	if err := hs.localStore.SetRate(ctx, key, cfg); err != nil && firstErr == nil {
		firstErr = err
	}

	return firstErr
}

func (hs *HybridStore) Reset(ctx context.Context, key string) error {
	var firstErr error

	if err := hs.redisStore.Reset(ctx, key); err != nil {
		firstErr = err
	}

	if err := hs.localStore.Reset(ctx, key); err != nil && firstErr == nil {
		firstErr = err
	}

	return firstErr
}

func (hs *HybridStore) GetStatus(ctx context.Context) StoreStatus {
	hs.mu.RLock()
	defer hs.mu.RUnlock()
	return hs.status
}

func (hs *HybridStore) GetType() StoreType {
	return StoreTypeHybrid
}

func (hs *HybridStore) Close() error {
	hs.cancel()
	var firstErr error

	if err := hs.redisStore.Close(); err != nil {
		firstErr = err
	}

	if err := hs.localStore.Close(); err != nil && firstErr == nil {
		firstErr = err
	}

	return firstErr
}

func (hs *HybridStore) GetStats() StoreStats {
	hs.mu.RLock()
	defer hs.mu.RUnlock()

	redisStats := hs.redisStore.GetStats()
	localStats := hs.localStore.GetStats()

	stats := hs.stats
	stats.TotalRequests += redisStats.TotalRequests + localStats.TotalRequests
	stats.AllowedRequests += redisStats.AllowedRequests + localStats.AllowedRequests
	stats.BlockedRequests += redisStats.BlockedRequests + localStats.BlockedRequests
	stats.RedisErrors += redisStats.RedisErrors

	return stats
}

func (hs *HybridStore) ResetStats() {
	hs.mu.Lock()
	defer hs.mu.Unlock()

	hs.stats = StoreStats{}
	hs.redisStore.ResetStats()
	hs.localStore.ResetStats()
	atomic.StoreInt32(&hs.consecutiveErr, 0)
	atomic.StoreInt32(&hs.consecutiveOk, 0)
}

func (hs *HybridStore) ForceDegrade() {
	hs.mu.Lock()
	defer hs.mu.Unlock()
	hs.status = StatusDegraded
	hs.stats.DegradedCount++
}

func (hs *HybridStore) ForceRecover() {
	hs.mu.Lock()
	defer hs.mu.Unlock()
	hs.status = StatusHealthy
	hs.stats.RecoveredCount++
	atomic.StoreInt32(&hs.consecutiveErr, 0)
}

func (hs *HybridStore) GetRedisStore() *RedisStore {
	return hs.redisStore
}

func (hs *HybridStore) GetLocalStore() *LocalStore {
	return hs.localStore
}

func NewHybridStoreFromConfig(cfg StoreConfig) (*HybridStore, error) {
	defaultCfg := cfg.LocalAlgorithm
	if err := algorithm.ValidateConfig(defaultCfg); err != nil {
		return nil, err
	}

	localStore, err := NewLocalStore(defaultCfg)
	if err != nil {
		return nil, err
	}

	redisStore, err := NewRedisStore(
		cfg.RedisAddr,
		cfg.RedisPassword,
		cfg.RedisDB,
		cfg.RedisPoolSize,
		cfg.RedisTimeout,
		defaultCfg,
	)
	if err != nil {
		return nil, err
	}

	return NewHybridStore(
		redisStore,
		localStore,
		cfg.DegradeThreshold,
		cfg.RecoverThreshold,
		cfg.CheckInterval,
	)
}
