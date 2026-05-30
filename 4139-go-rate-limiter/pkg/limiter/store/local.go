package store

import (
	"context"
	"sync"
	"time"

	"github.com/solo/ratelimiter/pkg/limiter/algorithm"
)

type LocalStore struct {
	mu         sync.RWMutex
	algorithms map[string]algorithm.Algorithm
	defaultCfg algorithm.AlgorithmConfig
	stats      StoreStats
	nowFunc    func() time.Time
}

func NewLocalStore(cfg algorithm.AlgorithmConfig) (*LocalStore, error) {
	if err := algorithm.ValidateConfig(cfg); err != nil {
		return nil, err
	}

	return &LocalStore{
		algorithms: make(map[string]algorithm.Algorithm),
		defaultCfg: cfg,
		nowFunc:    time.Now,
	}, nil
}

func (s *LocalStore) getOrCreateAlgorithm(key string, cfg algorithm.AlgorithmConfig) (algorithm.Algorithm, error) {
	s.mu.RLock()
	algo, exists := s.algorithms[key]
	s.mu.RUnlock()

	if exists {
		return algo, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	algo, exists = s.algorithms[key]
	if exists {
		return algo, nil
	}

	algo, err := algorithm.NewAlgorithm(cfg)
	if err != nil {
		return nil, err
	}

	s.algorithms[key] = algo
	return algo, nil
}

func (s *LocalStore) Allow(ctx context.Context, key string, tokens int64, cfg algorithm.AlgorithmConfig) (algorithm.LimitResult, error) {
	if cfg.Type == "" {
		cfg = s.defaultCfg
	}

	algo, err := s.getOrCreateAlgorithm(key, cfg)
	if err != nil {
		s.mu.Lock()
		s.stats.TotalRequests++
		s.stats.LastError = err
		s.stats.LastErrorTime = s.nowFunc()
		s.mu.Unlock()
		return algorithm.LimitResult{}, err
	}

	result, err := algo.Allow(ctx, key, tokens)

	s.mu.Lock()
	s.stats.TotalRequests++
	if result.Allowed {
		s.stats.AllowedRequests++
	} else {
		s.stats.BlockedRequests++
	}
	s.mu.Unlock()

	return result, err
}

func (s *LocalStore) SetRate(ctx context.Context, key string, cfg algorithm.AlgorithmConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	algo, err := algorithm.NewAlgorithm(cfg)
	if err != nil {
		return err
	}

	s.algorithms[key] = algo
	return nil
}

func (s *LocalStore) Reset(ctx context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if algo, exists := s.algorithms[key]; exists {
		if sw, ok := algo.(*algorithm.SlidingWindow); ok {
			sw.Reset(key)
		} else if tb, ok := algo.(*algorithm.TokenBucket); ok {
			tb.Reset(key)
		}
	}
	delete(s.algorithms, key)
	return nil
}

func (s *LocalStore) GetStatus(ctx context.Context) StoreStatus {
	return StatusHealthy
}

func (s *LocalStore) GetType() StoreType {
	return StoreTypeLocal
}

func (s *LocalStore) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.algorithms = make(map[string]algorithm.Algorithm)
	return nil
}

func (s *LocalStore) GetStats() StoreStats {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.stats
}

func (s *LocalStore) ResetStats() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stats = StoreStats{}
}

func (s *LocalStore) Cleanup(ctx context.Context, ttl time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := s.nowFunc()
	cutoff := now.Add(-ttl)

	for _, algo := range s.algorithms {
		if tb, ok := algo.(*algorithm.TokenBucket); ok {
			tb.Cleanup(ttl)
		} else if sw, ok := algo.(*algorithm.SlidingWindow); ok {
			sw.Cleanup(ttl)
		}
		_ = cutoff
	}

}

func (s *LocalStore) StartCleanupLoop(ctx context.Context, interval, ttl time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.Cleanup(ctx, ttl)
			case <-ctx.Done():
				return
			}
		}
	}()
}
