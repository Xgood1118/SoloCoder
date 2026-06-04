package queue

import (
	"context"
	"errors"
	"sync"
	"time"
)

var (
	ErrQueueClosed   = errors.New("queue is closed")
	ErrQueueEmpty    = errors.New("queue is empty")
	ErrQueueFull     = errors.New("queue is full")
	ErrInvalidTask   = errors.New("invalid task")
	ErrDeadLetter    = errors.New("task moved to dead letter queue")
)

type Priority int

const (
	PriorityLow    Priority = 1
	PriorityNormal Priority = 5
	PriorityHigh   Priority = 9
)

type TaskStatus int

const (
	TaskStatusPending   TaskStatus = 0
	TaskStatusRunning   TaskStatus = 1
	TaskStatusCompleted TaskStatus = 2
	TaskStatusFailed    TaskStatus = 3
	TaskStatusWaiting   TaskStatus = 4
	TaskStatusDeadLetter TaskStatus = 5
)

type Task struct {
	ID          string
	Name        string
	Priority    Priority
	Status      TaskStatus
	Payload     []byte
	RetryCount  int
	MaxRetry    int
	ExecuteAt   time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Timeout     time.Duration
	Error       string
}

type Queue interface {
	Enqueue(ctx context.Context, task *Task) error
	Dequeue(ctx context.Context) (*Task, error)
	Len() int
	Close() error
}

type MemoryQueue struct {
	taskCh     chan *Task
	deadLetter []*Task
	mu         sync.RWMutex
	closed     bool
	capacity   int
}

func NewMemoryQueue(capacity int) *MemoryQueue {
	if capacity <= 0 {
		capacity = 1000
	}
	return &MemoryQueue{
		taskCh:     make(chan *Task, capacity),
		deadLetter: make([]*Task, 0),
		capacity:   capacity,
	}
}

func (q *MemoryQueue) Enqueue(ctx context.Context, task *Task) error {
	if task == nil {
		return ErrInvalidTask
	}

	q.mu.RLock()
	if q.closed {
		q.mu.RUnlock()
		return ErrQueueClosed
	}
	q.mu.RUnlock()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case q.taskCh <- task:
		task.Status = TaskStatusPending
		task.UpdatedAt = time.Now()
		return nil
	default:
		return ErrQueueFull
	}
}

func (q *MemoryQueue) Dequeue(ctx context.Context) (*Task, error) {
	q.mu.RLock()
	if q.closed {
		q.mu.RUnlock()
		return nil, ErrQueueClosed
	}
	q.mu.RUnlock()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case task, ok := <-q.taskCh:
		if !ok {
			return nil, ErrQueueClosed
		}
		task.Status = TaskStatusRunning
		task.UpdatedAt = time.Now()
		return task, nil
	default:
		return nil, ErrQueueEmpty
	}
}

func (q *MemoryQueue) Len() int {
	return len(q.taskCh)
}

func (q *MemoryQueue) Close() error {
	q.mu.Lock()
	defer q.mu.Unlock()

	if q.closed {
		return nil
	}

	q.closed = true
	close(q.taskCh)
	return nil
}

func (q *MemoryQueue) EnqueueDeadLetter(task *Task) error {
	if task == nil {
		return ErrInvalidTask
	}

	q.mu.Lock()
	defer q.mu.Unlock()

	task.Status = TaskStatusDeadLetter
	task.UpdatedAt = time.Now()
	q.deadLetter = append(q.deadLetter, task)
	return nil
}

func (q *MemoryQueue) DeadLetterLen() int {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return len(q.deadLetter)
}

func (q *MemoryQueue) GetDeadLetter() []*Task {
	q.mu.RLock()
	defer q.mu.RUnlock()
	result := make([]*Task, len(q.deadLetter))
	copy(result, q.deadLetter)
	return result
}

func (q *MemoryQueue) ClearDeadLetter() {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.deadLetter = make([]*Task, 0)
}

type PriorityQueue struct {
	mu       sync.RWMutex
	queues   map[Priority]*MemoryQueue
	priorities []Priority
	closed   bool
	capacity int
}

func NewPriorityQueue(capacity int) *PriorityQueue {
	if capacity <= 0 {
		capacity = 1000
	}

	pq := &PriorityQueue{
		queues: make(map[Priority]*MemoryQueue),
		priorities: []Priority{PriorityHigh, PriorityNormal, PriorityLow},
		capacity: capacity,
	}

	for _, p := range pq.priorities {
		pq.queues[p] = NewMemoryQueue(capacity)
	}

	return pq
}

func (pq *PriorityQueue) Enqueue(ctx context.Context, task *Task) error {
	if task == nil {
		return ErrInvalidTask
	}

	pq.mu.RLock()
	if pq.closed {
		pq.mu.RUnlock()
		return ErrQueueClosed
	}
	pq.mu.RUnlock()

	priority := task.Priority
	if priority < PriorityLow {
		priority = PriorityLow
	}
	if priority > PriorityHigh {
		priority = PriorityHigh
	}

	q, ok := pq.queues[priority]
	if !ok {
		q = pq.queues[PriorityNormal]
	}

	return q.Enqueue(ctx, task)
}

func (pq *PriorityQueue) Dequeue(ctx context.Context) (*Task, error) {
	pq.mu.RLock()
	if pq.closed {
		pq.mu.RUnlock()
		return nil, ErrQueueClosed
	}
	pq.mu.RUnlock()

	for _, p := range pq.priorities {
		q := pq.queues[p]
		if q.Len() > 0 {
			task, err := q.Dequeue(ctx)
			if err == nil {
				return task, nil
			}
			if err != ErrQueueEmpty {
				return nil, err
			}
		}
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		return nil, ErrQueueEmpty
	}
}

func (pq *PriorityQueue) Len() int {
	pq.mu.RLock()
	defer pq.mu.RUnlock()

	total := 0
	for _, q := range pq.queues {
		total += q.Len()
	}
	return total
}

func (pq *PriorityQueue) Close() error {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	if pq.closed {
		return nil
	}

	pq.closed = true
	for _, q := range pq.queues {
		q.Close()
	}
	return nil
}

func (pq *PriorityQueue) EnqueueDeadLetter(task *Task) error {
	return pq.queues[PriorityLow].EnqueueDeadLetter(task)
}

func (pq *PriorityQueue) DeadLetterLen() int {
	return pq.queues[PriorityLow].DeadLetterLen()
}

func (pq *PriorityQueue) GetDeadLetter() []*Task {
	return pq.queues[PriorityLow].GetDeadLetter()
}

type QueueFactory func(capacity int) Queue

func NewQueue(queueType string, capacity int) Queue {
	switch queueType {
	case "priority":
		return NewPriorityQueue(capacity)
	default:
		return NewMemoryQueue(capacity)
	}
}
