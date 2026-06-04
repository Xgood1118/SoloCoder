package retry

import (
	"context"
	"time"

	"github.com/solocoder/taskscheduler/internal/config"
	"github.com/solocoder/taskscheduler/internal/models"
	"github.com/solocoder/taskscheduler/internal/store"
)

type RetryStrategyType string

const (
	StrategyFixed       RetryStrategyType = "fixed"
	StrategyExponential RetryStrategyType = "exponential"
	StrategyIncremental RetryStrategyType = "incremental"
)

type RetryStrategy struct {
	MaxRetries    int
	RetryStrategy RetryStrategyType
	Intervals     []time.Duration
	BaseInterval  time.Duration
	MaxInterval   time.Duration
}

type RetryManager struct {
	store    store.Store
	strategy *RetryStrategy
}

func NewDefaultRetryStrategy() *RetryStrategy {
	return &RetryStrategy{
		MaxRetries:    3,
		RetryStrategy: StrategyIncremental,
		Intervals: []time.Duration{
			1 * time.Minute,
			5 * time.Minute,
			30 * time.Minute,
		},
		BaseInterval: 1 * time.Minute,
		MaxInterval:  1 * time.Hour,
	}
}

func NewExponentialRetryStrategy(maxRetries int, baseInterval, maxInterval time.Duration) *RetryStrategy {
	return &RetryStrategy{
		MaxRetries:    maxRetries,
		RetryStrategy: StrategyExponential,
		BaseInterval:  baseInterval,
		MaxInterval:   maxInterval,
	}
}

func NewFixedRetryStrategy(maxRetries int, interval time.Duration) *RetryStrategy {
	return &RetryStrategy{
		MaxRetries:    maxRetries,
		RetryStrategy: StrategyFixed,
		BaseInterval:  interval,
	}
}

func NewIncrementalRetryStrategy(maxRetries int, intervals []time.Duration) *RetryStrategy {
	return &RetryStrategy{
		MaxRetries:    maxRetries,
		RetryStrategy: StrategyIncremental,
		Intervals:     intervals,
	}
}

func NewRetryManager(cfg *config.RetryConfig) *RetryManager {
	strategy := NewDefaultRetryStrategy()
	if cfg != nil {
		strategy.MaxRetries = cfg.MaxRetries
		if len(cfg.RetryIntervals) > 0 {
			strategy.Intervals = make([]time.Duration, len(cfg.RetryIntervals))
			for i, d := range cfg.RetryIntervals {
				strategy.Intervals[i] = d.Duration()
			}
		}
	}
	return &RetryManager{
		strategy: strategy,
	}
}

func NewRetryManagerWithStore(store store.Store, strategy *RetryStrategy) *RetryManager {
	if strategy == nil {
		strategy = NewDefaultRetryStrategy()
	}
	return &RetryManager{
		store:    store,
		strategy: strategy,
	}
}

func (rm *RetryManager) SetStore(store store.Store) {
	rm.store = store
}

func (rm *RetryManager) ShouldRetry(job *models.Job) bool {
	if job.MaxRetries <= 0 {
		return false
	}
	return job.RetryCount < job.MaxRetries
}

func (rm *RetryManager) GetNextRetryTime(job *models.Job) time.Time {
	now := time.Now()
	interval := rm.getRetryInterval(job.RetryCount)
	return now.Add(interval)
}

func (rm *RetryManager) getRetryInterval(retryCount int) time.Duration {
	switch rm.strategy.RetryStrategy {
	case StrategyFixed:
		return rm.strategy.BaseInterval

	case StrategyExponential:
		interval := rm.strategy.BaseInterval * time.Duration(1<<uint(retryCount))
		if interval > rm.strategy.MaxInterval {
			return rm.strategy.MaxInterval
		}
		return interval

	case StrategyIncremental:
		fallthrough
	default:
		if retryCount < len(rm.strategy.Intervals) {
			return rm.strategy.Intervals[retryCount]
		}
		if len(rm.strategy.Intervals) > 0 {
			return rm.strategy.Intervals[len(rm.strategy.Intervals)-1]
		}
		return rm.strategy.BaseInterval
	}
}

func (rm *RetryManager) HandleRetry(ctx context.Context, job *models.Job, execErr error) error {
	if !rm.ShouldRetry(job) {
		return nil
	}

	now := time.Now()
	job.RetryCount++
	job.LastRetryTime = &now
	job.NextExecuteTime = rm.GetNextRetryTime(job)
	job.Status = models.JobStatusPending
	job.ErrorMessage = execErr.Error()

	if rm.store != nil {
		if err := rm.store.UpdateJob(ctx, job); err != nil {
			return err
		}
	}

	return nil
}

func (rm *RetryManager) GetStrategy() *RetryStrategy {
	return rm.strategy
}
