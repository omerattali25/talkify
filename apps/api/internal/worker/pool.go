package worker

import (
	"context"
	"runtime"
	"sync"
	"talkify/apps/api/internal/logger"
)

// Task represents a unit of work to be processed
type Task struct {
	Handler func() error
	Name    string
}

// Pool represents a worker pool
type Pool struct {
	numWorkers int
	tasks      chan Task
	wg         sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
}

// NewPool creates a new worker pool with the specified number of workers
func NewPool(numWorkers int) *Pool {
	if numWorkers <= 0 {
		numWorkers = runtime.NumCPU() // Use number of CPU cores if not specified
	}

	ctx, cancel := context.WithCancel(context.Background())
	return &Pool{
		numWorkers: numWorkers,
		tasks:      make(chan Task, numWorkers*100), // Buffer size is 100 tasks per worker
		ctx:        ctx,
		cancel:     cancel,
	}
}

// Start initializes and starts the worker pool
func (p *Pool) Start() {
	logger.Info("Starting worker pool", map[string]interface{}{
		"workers": p.numWorkers,
	})

	// Start workers
	for i := 0; i < p.numWorkers; i++ {
		p.wg.Add(1)
		go p.worker(i)
	}
}

// Stop gracefully shuts down the worker pool
func (p *Pool) Stop() {
	logger.Info("Stopping worker pool")
	p.cancel()
	close(p.tasks)
	p.wg.Wait()
}

// Submit adds a new task to the pool
func (p *Pool) Submit(task Task) {
	select {
	case p.tasks <- task:
		logger.Debug("Task submitted to pool", map[string]interface{}{
			"task": task.Name,
		})
	case <-p.ctx.Done():
		logger.Warn("Worker pool is shutting down, task rejected", map[string]interface{}{
			"task": task.Name,
		})
	}
}

// worker is the main worker routine
func (p *Pool) worker(id int) {
	defer p.wg.Done()

	logger.Debug("Worker started", map[string]interface{}{
		"worker_id": id,
	})

	for {
		select {
		case task, ok := <-p.tasks:
			if !ok {
				logger.Debug("Worker shutting down", map[string]interface{}{
					"worker_id": id,
				})
				return
			}

			logger.Debug("Processing task", map[string]interface{}{
				"worker_id": id,
				"task":      task.Name,
			})

			if err := task.Handler(); err != nil {
				logger.Error("Task processing failed", err, map[string]interface{}{
					"worker_id": id,
					"task":      task.Name,
				})
			}

		case <-p.ctx.Done():
			logger.Debug("Worker context cancelled", map[string]interface{}{
				"worker_id": id,
			})
			return
		}
	}
}
