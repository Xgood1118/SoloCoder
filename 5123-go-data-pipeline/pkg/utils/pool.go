package utils

import (
	"context"
	"sync"
)

type WorkerPool struct {
	workerCount int
	taskQueue   chan func()
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc
}

func NewWorkerPool(workerCount int, queueSize int) *WorkerPool {
	ctx, cancel := context.WithCancel(context.Background())
	return &WorkerPool{
		workerCount: workerCount,
		taskQueue:   make(chan func(), queueSize),
		ctx:         ctx,
		cancel:      cancel,
	}
}

func (p *WorkerPool) Start() {
	for i := 0; i < p.workerCount; i++ {
		p.wg.Add(1)
		go func() {
			defer p.wg.Done()
			for {
				select {
				case task, ok := <-p.taskQueue:
					if !ok {
						return
					}
					task()
				case <-p.ctx.Done():
					return
				}
			}
		}()
	}
}

func (p *WorkerPool) Submit(task func()) bool {
	select {
	case p.taskQueue <- task:
		return true
	case <-p.ctx.Done():
		return false
	}
}

func (p *WorkerPool) Stop() {
	p.cancel()
	close(p.taskQueue)
	p.wg.Wait()
}

type BoundedChannel[T any] struct {
	ch   chan T
	ctx  context.Context
	done chan struct{}
}

func NewBoundedChannel[T any](bufferSize int) *BoundedChannel[T] {
	return &BoundedChannel[T]{
		ch:   make(chan T, bufferSize),
		ctx:  context.Background(),
		done: make(chan struct{}),
	}
}

func (c *BoundedChannel[T]) Send(data T) bool {
	select {
	case c.ch <- data:
		return true
	case <-c.done:
		return false
	}
}

func (c *BoundedChannel[T]) Receive() (T, bool) {
	select {
	case data, ok := <-c.ch:
		return data, ok
	case <-c.done:
		var zero T
		return zero, false
	}
}

func (c *BoundedChannel[T]) Channel() <-chan T {
	return c.ch
}

func (c *BoundedChannel[T]) SendChannel() chan<- T {
	return c.ch
}

func (c *BoundedChannel[T]) Close() {
	close(c.done)
	close(c.ch)
}

func (c *BoundedChannel[T]) Len() int {
	return len(c.ch)
}
