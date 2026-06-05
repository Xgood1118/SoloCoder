package store

import (
	"sort"
	"sync"
	"time"

	"solid-go-monitor/internal/model"
)

type RingBuffer struct {
	mu       sync.RWMutex
	data     []*model.ProbeResult
	capacity int
	head     int
	count    int
}

func NewRingBuffer(capacity int) *RingBuffer {
	return &RingBuffer{
		data:     make([]*model.ProbeResult, capacity),
		capacity: capacity,
		head:     0,
		count:    0,
	}
}

func (rb *RingBuffer) Add(result *model.ProbeResult) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	rb.data[rb.head] = result
	rb.head = (rb.head + 1) % rb.capacity
	if rb.count < rb.capacity {
		rb.count++
	}
}

func (rb *RingBuffer) GetAll() []*model.ProbeResult {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	results := make([]*model.ProbeResult, 0, rb.count)
	for i := 0; i < rb.count; i++ {
		idx := (rb.head - rb.count + i + rb.capacity) % rb.capacity
		results = append(results, rb.data[idx])
	}
	return results
}

func (rb *RingBuffer) GetSince(since time.Time) []*model.ProbeResult {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	results := make([]*model.ProbeResult, 0)
	for i := 0; i < rb.count; i++ {
		idx := (rb.head - rb.count + i + rb.capacity) % rb.capacity
		if rb.data[idx].Timestamp.After(since) {
			results = append(results, rb.data[idx])
		}
	}
	return results
}

func (rb *RingBuffer) GetRange(since, until time.Time) []*model.ProbeResult {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	results := make([]*model.ProbeResult, 0)
	for i := 0; i < rb.count; i++ {
		idx := (rb.head - rb.count + i + rb.capacity) % rb.capacity
		ts := rb.data[idx].Timestamp
		if ts.After(since) && ts.Before(until) {
			results = append(results, rb.data[idx])
		}
	}
	return results
}

func (rb *RingBuffer) GetStats() *model.ProbeStats {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	stats := &model.ProbeStats{
		TotalCount: rb.count,
	}

	if rb.count == 0 {
		return stats
	}

	times := make([]int64, 0, rb.count)
	for i := 0; i < rb.count; i++ {
		idx := (rb.head - rb.count + i + rb.capacity) % rb.capacity
		result := rb.data[idx]
		if result.Status == model.ProbeStatusUp {
			stats.UpCount++
			times = append(times, result.ResponseTime)
		} else {
			stats.DownCount++
		}
	}

	if rb.count > 0 {
		stats.SuccessRate = float64(stats.UpCount) / float64(rb.count) * 100
	}

	if len(times) > 0 {
		sort.Slice(times, func(i, j int) bool { return times[i] < times[j] })
		stats.P50 = times[len(times)*50/100]
		stats.P95 = times[len(times)*95/100]
		stats.P99 = times[len(times)*99/100]
	}

	return stats
}

func (rb *RingBuffer) GetLastFailures(n int) []*model.ProbeResult {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	failures := make([]*model.ProbeResult, 0, n)
	for i := rb.count - 1; i >= 0 && len(failures) < n; i-- {
		idx := (rb.head - 1 - (rb.count - 1 - i) + rb.capacity) % rb.capacity
		result := rb.data[idx]
		if result.Status == model.ProbeStatusDown {
			failures = append(failures, result)
		}
	}
	return failures
}
