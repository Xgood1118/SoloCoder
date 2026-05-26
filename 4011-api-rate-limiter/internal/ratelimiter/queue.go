package ratelimiter

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

const (
	QueuePrefix    = "rate_limit:queue:"
	MaxQueueTTL    = 1 * time.Minute
)

type QueueItem struct {
	ID        string    `json:"id"`
	Key       string    `json:"key"`
	Path      string    `json:"path"`
	CreatedAt time.Time `json:"created_at"`
	TimeoutAt time.Time `json:"timeout_at"`
}

type Queue struct {
	client      RedisClient
	queues      sync.Map
	notifyChans sync.Map
	ctx         context.Context
	cancel      context.CancelFunc
}

type queueState struct {
	items    []*QueueItem
	mu       sync.Mutex
	capacity int
}

func NewQueue(client RedisClient) *Queue {
	ctx, cancel := context.WithCancel(context.Background())
	q := &Queue{
		client: client,
		ctx:    ctx,
		cancel: cancel,
	}
	go q.cleanupLoop()
	return q
}

func (q *Queue) Close() {
	q.cancel()
}

func (q *Queue) getOrCreateQueue(key string, capacity int) *queueState {
	if existing, ok := q.queues.Load(key); ok {
		qs := existing.(*queueState)
		qs.mu.Lock()
		qs.capacity = capacity
		qs.mu.Unlock()
		return qs
	}

	qs := &queueState{
		items:    make([]*QueueItem, 0, capacity),
		capacity: capacity,
	}
	actual, _ := q.queues.LoadOrStore(key, qs)
	return actual.(*queueState)
}

func (q *Queue) Enqueue(ctx context.Context, key, path string, queueSize int, timeout time.Duration) (*QueueItem, bool, error) {
	qs := q.getOrCreateQueue(key, queueSize)

	qs.mu.Lock()
	defer qs.mu.Unlock()

	if len(qs.items) >= qs.capacity {
		return nil, false, nil
	}

	now := time.Now()
	item := &QueueItem{
		ID:        uuid.New().String(),
		Key:       key,
		Path:      path,
		CreatedAt: now,
		TimeoutAt: now.Add(timeout),
	}

	qs.items = append(qs.items, item)

	err := q.persistQueueItem(ctx, key, item)
	if err != nil {
		return nil, false, fmt.Errorf("failed to persist queue item: %w", err)
	}

	notifyKey := key + ":" + item.ID
	ch := make(chan struct{}, 1)
	q.notifyChans.Store(notifyKey, ch)

	return item, true, nil
}

func (q *Queue) Wait(ctx context.Context, key string, item *QueueItem, maxWait time.Duration) (bool, time.Duration, error) {
	notifyKey := key + ":" + item.ID
	ch, ok := q.notifyChans.Load(notifyKey)
	if !ok {
		return false, 0, fmt.Errorf("queue item not found")
	}

	waitTimeout := time.Until(item.TimeoutAt)
	if waitTimeout > maxWait {
		waitTimeout = maxWait
	}
	if waitTimeout < 0 {
		q.removeFromQueue(key, item.ID)
		return false, 0, nil
	}

	timer := time.NewTimer(waitTimeout)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		q.removeFromQueue(key, item.ID)
		return false, 0, ctx.Err()
	case <-timer.C:
		q.removeFromQueue(key, item.ID)
		return false, waitTimeout, nil
	case <-ch.(chan struct{}):
		q.removeFromQueue(key, item.ID)
		return true, waitTimeout, nil
	}
}

func (q *Queue) Dequeue(ctx context.Context, key string) (*QueueItem, error) {
	qs := q.getOrCreateQueue(key, 100)

	qs.mu.Lock()
	defer qs.mu.Unlock()

	if len(qs.items) == 0 {
		return nil, nil
	}

	item := qs.items[0]

	notifyKey := key + ":" + item.ID
	if ch, ok := q.notifyChans.LoadAndDelete(notifyKey); ok {
		select {
		case ch.(chan struct{}) <- struct{}{}:
		default:
		}
		close(ch.(chan struct{}))
	}

	qs.items = qs.items[1:]

	err := q.deleteQueueItem(ctx, key, item.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to delete queue item: %w", err)
	}

	return item, nil
}

func (q *Queue) removeFromQueue(key string, itemID string) {
	qs := q.getOrCreateQueue(key, 100)

	qs.mu.Lock()
	defer qs.mu.Unlock()

	for i, item := range qs.items {
		if item.ID == itemID {
			qs.items = append(qs.items[:i], qs.items[i+1:]...)
			break
		}
	}

	notifyKey := key + ":" + itemID
	q.notifyChans.Delete(notifyKey)

	_ = q.deleteQueueItem(context.Background(), key, itemID)
}

func (q *Queue) Size(key string) int {
	qs := q.getOrCreateQueue(key, 100)

	qs.mu.Lock()
	defer qs.mu.Unlock()

	return len(qs.items)
}

func (q *Queue) persistQueueItem(ctx context.Context, key string, item *QueueItem) error {
	redisKey := QueuePrefix + key
	data, err := json.Marshal(item)
	if err != nil {
		return err
	}

	score := float64(item.CreatedAt.UnixNano()) / float64(time.Millisecond)
	err = q.client.ZAdd(ctx, redisKey, &redis.Z{
		Score:  score,
		Member: item.ID + ":" + string(data),
	}).Err()
	if err != nil {
		return err
	}

	return q.client.Expire(ctx, redisKey, MaxQueueTTL).Err()
}

func (q *Queue) deleteQueueItem(ctx context.Context, key string, itemID string) error {
	redisKey := QueuePrefix + key
	items, err := q.client.ZRangeByScore(ctx, redisKey, &redis.ZRangeBy{
		Min: "-inf",
		Max: "+inf",
	}).Result()
	if err != nil {
		return err
	}

	for _, itemStr := range items {
		prefix := itemID + ":"
		if len(itemStr) > len(prefix) && itemStr[:len(prefix)] == prefix {
			_ = q.client.ZRemRangeByScore(ctx, redisKey, "-inf", "+inf").Err()
			break
		}
	}

	return nil
}

func (q *Queue) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-q.ctx.Done():
			return
		case <-ticker.C:
			q.cleanupExpired()
		}
	}
}

func (q *Queue) cleanupExpired() {
	now := time.Now()

	q.queues.Range(func(key, value interface{}) bool {
		qs := value.(*queueState)
		qs.mu.Lock()

		validItems := make([]*QueueItem, 0, len(qs.items))
		for _, item := range qs.items {
			if item.TimeoutAt.After(now) {
				validItems = append(validItems, item)
			} else {
				notifyKey := item.Key + ":" + item.ID
				if ch, ok := q.notifyChans.LoadAndDelete(notifyKey); ok {
					select {
					case ch.(chan struct{}) <- struct{}{}:
					default:
					}
					close(ch.(chan struct{}))
				}
			}
		}
		qs.items = validItems
		qs.mu.Unlock()
		return true
	})
}

func (q *Queue) RebuildFromRedis(ctx context.Context) error {
	pattern := QueuePrefix + "*"
	keys, err := q.scanKeys(ctx, pattern)
	if err != nil {
		return fmt.Errorf("failed to scan queue keys: %w", err)
	}

	now := time.Now()

	for _, redisKey := range keys {
		items, err := q.client.ZRangeByScore(ctx, redisKey, &redis.ZRangeBy{
			Min: "-inf",
			Max: "+inf",
		}).Result()
		if err != nil {
			continue
		}

		key := redisKey[len(QueuePrefix):]

		for _, itemStr := range items {
			idx := firstColonIndex(itemStr)
			if idx == -1 {
				continue
			}

			id := itemStr[:idx]
			dataStr := itemStr[idx+1:]

			var item QueueItem
			err := json.Unmarshal([]byte(dataStr), &item)
			if err != nil {
				continue
			}

			if item.TimeoutAt.Before(now) {
				continue
			}

			qs := q.getOrCreateQueue(key, 100)
			qs.mu.Lock()
			qs.items = append(qs.items, &item)
			qs.mu.Unlock()

			notifyKey := key + ":" + id
			ch := make(chan struct{}, 1)
			q.notifyChans.Store(notifyKey, ch)
		}
	}

	return nil
}

func (q *Queue) scanKeys(ctx context.Context, pattern string) ([]string, error) {
	var allKeys []string
	var cursor uint64

	for {
		keys, newCursor, err := q.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return nil, err
		}
		allKeys = append(allKeys, keys...)
		cursor = newCursor
		if cursor == 0 {
			break
		}
	}

	return allKeys, nil
}

func firstColonIndex(s string) int {
	for i, c := range s {
		if c == ':' {
			return i
		}
	}
	return -1
}
