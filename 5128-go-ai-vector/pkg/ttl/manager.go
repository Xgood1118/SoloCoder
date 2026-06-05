package ttl

import (
	"context"
	"sync"
	"time"

	"github.com/vector-proxy/pkg/core"
)

type TTLManager struct {
	mu              sync.RWMutex
	index           core.Index
	expiryMap       map[core.VectorID]time.Time
	cleanupInterval time.Duration
	stopChan        chan struct{}
	running         bool
}

func NewTTLManager(index core.Index, cleanupInterval time.Duration) *TTLManager {
	return &TTLManager{
		index:           index,
		expiryMap:       make(map[core.VectorID]time.Time),
		cleanupInterval: cleanupInterval,
		stopChan:        make(chan struct{}),
		running:         false,
	}
}

func (m *TTLManager) Start() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return
	}

	m.running = true
	go m.cleanupLoop()
}

func (m *TTLManager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.running {
		return
	}

	close(m.stopChan)
	m.running = false
}

func (m *TTLManager) cleanupLoop() {
	ticker := time.NewTicker(m.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopChan:
			return
		case <-ticker.C:
			m.cleanupExpired()
		}
	}
}

func (m *TTLManager) cleanupExpired() {
	m.mu.Lock()

	now := time.Now()
	expiredIDs := make([]core.VectorID, 0)

	for id, expiry := range m.expiryMap {
		if now.After(expiry) {
			expiredIDs = append(expiredIDs, id)
		}
	}

	for _, id := range expiredIDs {
		delete(m.expiryMap, id)
	}

	m.mu.Unlock()

	if len(expiredIDs) > 0 {
		ctx := context.Background()
		_ = m.index.Delete(ctx, expiredIDs)
	}
}

func (m *TTLManager) AddWithTTL(records []core.VectorRecord, ttl time.Duration) error {
	m.mu.Lock()
	now := time.Now()

	for i := range records {
		records[i].ExpiresAt = now.Add(ttl)
		records[i].CreatedAt = now
		m.expiryMap[records[i].ID] = records[i].ExpiresAt
	}

	m.mu.Unlock()

	ctx := context.Background()
	return m.index.Add(ctx, records)
}

func (m *TTLManager) Add(records []core.VectorRecord) error {
	m.mu.Lock()
	now := time.Now()

	for i := range records {
		records[i].CreatedAt = now
		if !records[i].ExpiresAt.IsZero() {
			m.expiryMap[records[i].ID] = records[i].ExpiresAt
		}
	}

	m.mu.Unlock()

	ctx := context.Background()
	return m.index.Add(ctx, records)
}

func (m *TTLManager) RemoveExpiry(ids []core.VectorID) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, id := range ids {
		delete(m.expiryMap, id)
	}
}

func (m *TTLManager) UpdateTTL(ids []core.VectorID, ttl time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	newExpiry := now.Add(ttl)

	for _, id := range ids {
		m.expiryMap[id] = newExpiry
	}
}

func (m *TTLManager) GetExpiry(id core.VectorID) (time.Time, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	expiry, exists := m.expiryMap[id]
	return expiry, exists
}

func (m *TTLManager) IsExpired(id core.VectorID) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	expiry, exists := m.expiryMap[id]
	if !exists {
		return false
	}

	return time.Now().After(expiry)
}

func (m *TTLManager) CleanupNow() int {
	m.mu.Lock()

	now := time.Now()
	expiredIDs := make([]core.VectorID, 0)

	for id, expiry := range m.expiryMap {
		if now.After(expiry) {
			expiredIDs = append(expiredIDs, id)
		}
	}

	for _, id := range expiredIDs {
		delete(m.expiryMap, id)
	}

	m.mu.Unlock()

	if len(expiredIDs) > 0 {
		ctx := context.Background()
		_ = m.index.Delete(ctx, expiredIDs)
	}

	return len(expiredIDs)
}

func (m *TTLManager) CountWithTTL() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.expiryMap)
}
