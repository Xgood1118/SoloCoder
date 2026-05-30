package config

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/solo/ratelimiter/pkg/limiter/algorithm"
)

func TestConfigManager_AddRule_NoDeadlock(t *testing.T) {
	cm := NewConfigManager()

	initialCfg := &Config{
		Version: "1.0",
		Global: GlobalConfig{
			Enabled: true,
			DefaultAlgorithm: algorithm.AlgorithmConfig{
				Type:   algorithm.TokenBucketType,
				Rate:   100,
				Burst:  100,
				Window: time.Second,
			},
		},
		Rules: []Rule{},
	}

	_, err := cm.Load(initialCfg)
	if err != nil {
		t.Fatal(err)
	}

	var callbackCalled int32
	cm.AddReloadCallback(func(oldCfg, newCfg *Config) {
		atomic.AddInt32(&callbackCalled, 1)
	})

	done := make(chan bool, 1)
	go func() {
		rule := &Rule{
			ID:       "test-rule",
			Name:     "Test Rule",
			Priority: 100,
			Enabled:  true,
			Matchers: []Matcher{
				{
					Type:    MatcherPath,
					Pattern: "/api/test",
				},
			},
			Dimensions: []DimensionConfig{
				{
					Type: "ip",
				},
			},
			Algorithm: algorithm.AlgorithmConfig{
				Type:   algorithm.TokenBucketType,
				Rate:   10,
				Burst:  10,
				Window: time.Second,
			},
		}

		err := cm.AddRule(rule)
		if err != nil {
			t.Errorf("AddRule failed: %v", err)
		}
		done <- true
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("deadlock detected: AddRule did not return within 2 seconds")
	}

	if atomic.LoadInt32(&callbackCalled) == 0 {
		t.Error("callback was not called")
	}
}

func TestConfigManager_RemoveRule_NoDeadlock(t *testing.T) {
	cm := NewConfigManager()

	initialCfg := &Config{
		Version: "1.0",
		Global: GlobalConfig{
			Enabled: true,
			DefaultAlgorithm: algorithm.AlgorithmConfig{
				Type:   algorithm.TokenBucketType,
				Rate:   100,
				Burst:  100,
				Window: time.Second,
			},
		},
		Rules: []Rule{
			{
				ID:       "test-rule",
				Name:     "Test Rule",
				Priority: 100,
				Enabled:  true,
				Matchers: []Matcher{
					{
						Type:    MatcherPath,
						Pattern: "/api/test",
					},
				},
				Dimensions: []DimensionConfig{
				{
					Type: "ip",
				},
			},
				Algorithm: algorithm.AlgorithmConfig{
					Type:   algorithm.TokenBucketType,
					Rate:   10,
					Burst:  10,
					Window: time.Second,
				},
			},
		},
	}

	_, err := cm.Load(initialCfg)
	if err != nil {
		t.Fatal(err)
	}

	var callbackCalled int32
	cm.AddReloadCallback(func(oldCfg, newCfg *Config) {
		atomic.AddInt32(&callbackCalled, 1)
	})

	done := make(chan bool, 1)
	go func() {
		err := cm.RemoveRule("test-rule")
		if err != nil {
			t.Errorf("RemoveRule failed: %v", err)
		}
		done <- true
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("deadlock detected: RemoveRule did not return within 2 seconds")
	}

	if atomic.LoadInt32(&callbackCalled) == 0 {
		t.Error("callback was not called")
	}
}
