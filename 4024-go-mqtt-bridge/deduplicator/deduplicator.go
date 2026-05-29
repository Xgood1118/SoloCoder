package deduplicator

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

type entry struct {
	expiresAt time.Time
}

type Deduplicator struct {
	mu     sync.Mutex
	window time.Duration
	seen   map[string]entry
	stopCh chan struct{}
}

func New(windowSeconds int) *Deduplicator {
	if windowSeconds <= 0 {
		windowSeconds = 5
	}
	d := &Deduplicator{
		window: time.Duration(windowSeconds) * time.Second,
		seen:   make(map[string]entry),
		stopCh: make(chan struct{}),
	}
	go d.cleanupLoop()
	return d
}

func (d *Deduplicator) Stop() {
	close(d.stopCh)
}

func (d *Deduplicator) Key(clientID, topic string, payload []byte) string {
	h := sha256.New()
	h.Write([]byte(clientID))
	h.Write([]byte{0xff})
	h.Write([]byte(topic))
	h.Write([]byte{0xff})
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}

func (d *Deduplicator) IsDuplicate(key string) bool {
	now := time.Now()
	d.mu.Lock()
	defer d.mu.Unlock()
	if e, ok := d.seen[key]; ok && now.Before(e.expiresAt) {
		return true
	}
	d.seen[key] = entry{expiresAt: now.Add(d.window)}
	return false
}

func (d *Deduplicator) cleanupLoop() {
	ticker := time.NewTicker(d.window / 2)
	defer ticker.Stop()
	for {
		select {
		case <-d.stopCh:
			return
		case <-ticker.C:
			d.purge()
		}
	}
}

func (d *Deduplicator) purge() {
	now := time.Now()
	d.mu.Lock()
	defer d.mu.Unlock()
	for k, v := range d.seen {
		if !now.Before(v.expiresAt) {
			delete(d.seen, k)
		}
	}
}
