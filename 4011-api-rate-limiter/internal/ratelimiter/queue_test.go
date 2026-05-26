package ratelimiter

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestQueueEnqueueAndDequeue(t *testing.T) {
	mockRedis := NewMockRedisClient()
	q := NewQueue(mockRedis)
	defer q.Close()

	ctx := context.Background()
	key := "test:queue"
	queueSize := 10
	timeout := 5 * time.Second

	item, enqueued, err := q.Enqueue(ctx, key, "/api/test", queueSize, timeout)
	assert.NoError(t, err)
	assert.True(t, enqueued)
	assert.NotNil(t, item)
	assert.Equal(t, 1, q.Size(key))

	dequeued, err := q.Dequeue(ctx, key)
	assert.NoError(t, err)
	assert.NotNil(t, dequeued)
	assert.Equal(t, item.ID, dequeued.ID)
	assert.Equal(t, 0, q.Size(key))
}

func TestQueueFull(t *testing.T) {
	mockRedis := NewMockRedisClient()
	q := NewQueue(mockRedis)
	defer q.Close()

	ctx := context.Background()
	key := "test:queue:full"
	queueSize := 2
	timeout := 5 * time.Second

	for i := 0; i < 2; i++ {
		_, enqueued, err := q.Enqueue(ctx, key, "/api/test", queueSize, timeout)
		assert.NoError(t, err)
		assert.True(t, enqueued)
	}

	_, enqueued, err := q.Enqueue(ctx, key, "/api/test", queueSize, timeout)
	assert.NoError(t, err)
	assert.False(t, enqueued)
	assert.Equal(t, 2, q.Size(key))
}

func TestQueueTimeout(t *testing.T) {
	mockRedis := NewMockRedisClient()
	q := NewQueue(mockRedis)
	defer q.Close()

	ctx := context.Background()
	key := "test:queue:timeout"
	queueSize := 10
	timeout := 200 * time.Millisecond

	item, enqueued, err := q.Enqueue(ctx, key, "/api/test", queueSize, timeout)
	assert.NoError(t, err)
	assert.True(t, enqueued)

	allowed, waited, err := q.Wait(ctx, key, item, 500*time.Millisecond)
	assert.NoError(t, err)
	assert.False(t, allowed)
	assert.Greater(t, waited, time.Duration(0))
	assert.Equal(t, 0, q.Size(key))
}

func TestQueueNotify(t *testing.T) {
	mockRedis := NewMockRedisClient()
	q := NewQueue(mockRedis)
	defer q.Close()

	ctx := context.Background()
	key := "test:queue:notify"
	queueSize := 10
	timeout := 5 * time.Second

	item, enqueued, err := q.Enqueue(ctx, key, "/api/test", queueSize, timeout)
	assert.NoError(t, err)
	assert.True(t, enqueued)

	waitDone := make(chan bool)
	go func() {
		allowed, _, err := q.Wait(ctx, key, item, 5*time.Second)
		assert.NoError(t, err)
		waitDone <- allowed
	}()

	time.Sleep(100 * time.Millisecond)

	_, err = q.Dequeue(ctx, key)
	assert.NoError(t, err)

	select {
	case allowed := <-waitDone:
		assert.True(t, allowed)
	case <-time.After(2 * time.Second):
		t.Fatal("Wait did not return in time")
	}
}

func TestQueueCleanup(t *testing.T) {
	mockRedis := NewMockRedisClient()
	q := NewQueue(mockRedis)
	defer q.Close()

	ctx := context.Background()
	key := "test:queue:cleanup"
	queueSize := 10
	timeout := 100 * time.Millisecond

	for i := 0; i < 3; i++ {
		_, enqueued, err := q.Enqueue(ctx, key, "/api/test", queueSize, timeout)
		assert.NoError(t, err)
		assert.True(t, enqueued)
	}

	assert.Equal(t, 3, q.Size(key))

	time.Sleep(200 * time.Millisecond)

	q.cleanupExpired()

	assert.Equal(t, 0, q.Size(key))
}
