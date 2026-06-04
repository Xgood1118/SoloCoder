package worker

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/solocoder/taskscheduler/internal/queue"
)

var (
	ErrPoolNotStarted = errors.New("worker pool is not started")
	ErrPoolStopped    = errors.New("worker pool is stopped")
	ErrInvalidTask    = errors.New("invalid task")
	ErrTaskTimeout    = errors.New("task execution timeout")
)

type TaskHandler func(ctx context.Context, task *queue.Task) error

type WorkerPool struct {
	mu          sync.RWMutex
	workerCount int
	maxWorkers  int
	minWorkers  int
	queue       queue.Queue
	handler     TaskHandler
	workers     map[int]*worker
	wg          sync.WaitGroup
	started     bool
	closed      bool
	quit        chan struct{}
	adjustCh    chan int
	activeTasks int64
	completedTasks int64
	failedTasks int64
}

type worker struct {
	id     int
	pool   *WorkerPool
	ctx    context.Context
	cancel context.CancelFunc
}

type PoolConfig struct {
	WorkerCount int
	MaxWorkers  int
	MinWorkers  int
	Queue       queue.Queue
	Handler     TaskHandler
}

func NewWorkerPool(cfg PoolConfig) (*WorkerPool, error) {
	if cfg.Queue == nil {
		return nil, errors.New("queue is required")
	}
	if cfg.Handler == nil {
		return nil, errors.New("task handler is required")
	}

	workerCount := cfg.WorkerCount
	if workerCount <= 0 {
		workerCount = 5
	}

	minWorkers := cfg.MinWorkers
	if minWorkers <= 0 {
		minWorkers = 1
	}

	maxWorkers := cfg.MaxWorkers
	if maxWorkers <= 0 {
		maxWorkers = 50
	}

	if workerCount < minWorkers {
		workerCount = minWorkers
	}
	if workerCount > maxWorkers {
		workerCount = maxWorkers
	}

	return &WorkerPool{
		workerCount: workerCount,
		maxWorkers:  maxWorkers,
		minWorkers:  minWorkers,
		queue:       cfg.Queue,
		handler:     cfg.Handler,
		workers:     make(map[int]*worker),
		quit:        make(chan struct{}),
		adjustCh:    make(chan int, 10),
	}, nil
}

func (p *WorkerPool) Start(ctx context.Context) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.started {
		return nil
	}

	if p.closed {
		return ErrPoolStopped
	}

	p.started = true

	for i := 0; i < p.workerCount; i++ {
		p.addWorker(ctx, i)
	}

	go p.manageWorkers(ctx)

	return nil
}

func (p *WorkerPool) addWorker(ctx context.Context, id int) {
	w := &worker{
		id:   id,
		pool: p,
	}
	w.ctx, w.cancel = context.WithCancel(ctx)
	p.workers[id] = w
	p.wg.Add(1)
	go w.run()
}

func (p *WorkerPool) removeWorker(id int) {
	p.mu.Lock()
	w, exists := p.workers[id]
	if exists {
		w.cancel()
		delete(p.workers, id)
	}
	p.mu.Unlock()
}

func (p *WorkerPool) manageWorkers(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-p.quit:
			return
		case count := <-p.adjustCh:
			p.adjustWorkerCount(count)
		case <-time.After(5 * time.Second):
			p.autoAdjustWorkers()
		}
	}
}

func (p *WorkerPool) autoAdjustWorkers() {
	queueLen := p.queue.Len()
	active := atomic.LoadInt64(&p.activeTasks)
	totalWorkers := p.getWorkerCount()

	if queueLen > totalWorkers*2 && totalWorkers < p.maxWorkers {
		p.SetWorkerCount(totalWorkers + 1)
	} else if queueLen == 0 && active == 0 && totalWorkers > p.minWorkers {
		p.SetWorkerCount(totalWorkers - 1)
	}
}

func (p *WorkerPool) adjustWorkerCount(newCount int) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if newCount < p.minWorkers {
		newCount = p.minWorkers
	}
	if newCount > p.maxWorkers {
		newCount = p.maxWorkers
	}

	currentCount := len(p.workers)
	if newCount == currentCount {
		return
	}

	if newCount > currentCount {
		ctx := context.Background()
		for i := currentCount; i < newCount; i++ {
			p.addWorker(ctx, i)
		}
	} else {
		for i := currentCount - 1; i >= newCount; i-- {
			if w, exists := p.workers[i]; exists {
				w.cancel()
				delete(p.workers, i)
			}
		}
	}

	p.workerCount = newCount
}

func (w *worker) run() {
	defer w.pool.wg.Done()

	for {
		select {
		case <-w.ctx.Done():
			return
		case <-w.pool.quit:
			return
		default:
			task, err := w.pool.dequeueTask(w.ctx)
			if err != nil {
				if err == queue.ErrQueueClosed || err == context.Canceled {
					return
				}
				time.Sleep(100 * time.Millisecond)
				continue
			}

			w.pool.executeTask(w.ctx, task)
		}
	}
}

func (p *WorkerPool) dequeueTask(ctx context.Context) (*queue.Task, error) {
	ctx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()
	return p.queue.Dequeue(ctx)
}

func (p *WorkerPool) executeTask(ctx context.Context, task *queue.Task) {
	atomic.AddInt64(&p.activeTasks, 1)
	defer atomic.AddInt64(&p.activeTasks, -1)

	timeout := task.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Minute
	}

	taskCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	errCh := make(chan error, 1)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				errCh <- fmt.Errorf("task panic: %v", r)
			}
		}()
		errCh <- p.handler(taskCtx, task)
	}()

	var err error
	select {
	case err = <-errCh:
	case <-taskCtx.Done():
		err = ErrTaskTimeout
	}

	task.UpdatedAt = time.Now()

	if err != nil {
		atomic.AddInt64(&p.failedTasks, 1)
		task.Status = queue.TaskStatusFailed
		task.Error = err.Error()
		task.RetryCount++

		if task.RetryCount < task.MaxRetry {
			backoff := getBackoffDuration(task.RetryCount)
			task.ExecuteAt = time.Now().Add(backoff)
			retryCtx := context.Background()
			if enqueueErr := p.queue.Enqueue(retryCtx, task); enqueueErr != nil {
				p.enqueueDeadLetter(task)
			}
		} else {
			p.enqueueDeadLetter(task)
		}
	} else {
		atomic.AddInt64(&p.completedTasks, 1)
		task.Status = queue.TaskStatusCompleted
		task.Error = ""
	}
}

func getBackoffDuration(retryCount int) time.Duration {
	backoffs := []time.Duration{
		1 * time.Minute,
		5 * time.Minute,
		30 * time.Minute,
		1 * time.Hour,
		2 * time.Hour,
	}

	if retryCount <= 0 {
		return backoffs[0]
	}
	if retryCount >= len(backoffs) {
		return backoffs[len(backoffs)-1]
	}
	return backoffs[retryCount-1]
}

func (p *WorkerPool) enqueueDeadLetter(task *queue.Task) {
	if dlq, ok := p.queue.(*queue.MemoryQueue); ok {
		_ = dlq.EnqueueDeadLetter(task)
	} else if pq, ok := p.queue.(*queue.PriorityQueue); ok {
		_ = pq.EnqueueDeadLetter(task)
	}
}

func (p *WorkerPool) Submit(ctx context.Context, task *queue.Task) error {
	if task == nil {
		return ErrInvalidTask
	}

	p.mu.RLock()
	if p.closed {
		p.mu.RUnlock()
		return ErrPoolStopped
	}
	if !p.started {
		p.mu.RUnlock()
		return ErrPoolNotStarted
	}
	p.mu.RUnlock()

	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()
	if task.ExecuteAt.IsZero() {
		task.ExecuteAt = time.Now()
	}
	if task.MaxRetry <= 0 {
		task.MaxRetry = 3
	}

	return p.queue.Enqueue(ctx, task)
}

func (p *WorkerPool) Stop(ctx context.Context) error {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil
	}

	p.closed = true
	p.started = false
	close(p.quit)
	p.mu.Unlock()

	done := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-ctx.Done():
		return ctx.Err()
	}

	return p.queue.Close()
}

func (p *WorkerPool) SetWorkerCount(count int) {
	p.mu.RLock()
	closed := p.closed
	p.mu.RUnlock()

	if closed {
		return
	}

	p.adjustCh <- count
}

func (p *WorkerPool) getWorkerCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.workers)
}

func (p *WorkerPool) GetWorkerCount() int {
	return p.getWorkerCount()
}

func (p *WorkerPool) GetActiveTasks() int64 {
	return atomic.LoadInt64(&p.activeTasks)
}

func (p *WorkerPool) GetCompletedTasks() int64 {
	return atomic.LoadInt64(&p.completedTasks)
}

func (p *WorkerPool) GetFailedTasks() int64 {
	return atomic.LoadInt64(&p.failedTasks)
}

func (p *WorkerPool) GetQueueLen() int {
	return p.queue.Len()
}

func (p *WorkerPool) IsRunning() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.started && !p.closed
}
