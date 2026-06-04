package scheduler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/solocoder/taskscheduler/internal/config"
	"github.com/solocoder/taskscheduler/internal/cron"
	"github.com/solocoder/taskscheduler/internal/dependency"
	"github.com/solocoder/taskscheduler/internal/dlq"
	"github.com/solocoder/taskscheduler/internal/models"
	"github.com/solocoder/taskscheduler/internal/notifier"
	"github.com/solocoder/taskscheduler/internal/output"
	"github.com/solocoder/taskscheduler/internal/queue"
	"github.com/solocoder/taskscheduler/internal/retry"
	"github.com/solocoder/taskscheduler/internal/store"
	"github.com/solocoder/taskscheduler/internal/worker"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	ErrSchedulerStopped = errors.New("scheduler is stopped")
	ErrJobNotFound      = errors.New("job not found")
	ErrLockAcquired     = errors.New("lock already acquired by another node")
)

type DistributedLock interface {
	Acquire(ctx context.Context, key string, ttl time.Duration) (bool, error)
	Release(ctx context.Context, key string) error
}

type dbLock struct {
	db     *gorm.DB
	nodeID string
}

type LockRecord struct {
	Key       string    `gorm:"primaryKey;type:varchar(255)"`
	NodeID    string    `gorm:"type:varchar(100);not null"`
	ExpiresAt time.Time `gorm:"not null;index"`
	CreatedAt time.Time
}

func NewDistributedLock(db *gorm.DB, nodeID string) DistributedLock {
	db.AutoMigrate(&LockRecord{})
	return &dbLock{db: db, nodeID: nodeID}
}

func (l *dbLock) Acquire(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	now := time.Now()
	expiresAt := now.Add(ttl)

	var existing LockRecord
	err := l.db.WithContext(ctx).Where("`key` = ?", key).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) || existing.ExpiresAt.Before(now) {
		result := l.db.WithContext(ctx).Exec(
			"INSERT INTO lock_records (`key`, node_id, expires_at, created_at) VALUES (?, ?, ?, ?) "+
				"ON CONFLICT(`key`) DO UPDATE SET "+
				"node_id = CASE WHEN lock_records.expires_at < ? THEN excluded.node_id ELSE lock_records.node_id END, "+
				"expires_at = CASE WHEN lock_records.expires_at < ? THEN excluded.expires_at ELSE lock_records.expires_at END, "+
				"created_at = CASE WHEN lock_records.expires_at < ? THEN excluded.created_at ELSE lock_records.created_at END",
			key, l.nodeID, expiresAt, now,
			now, now, now,
		)
		if result.Error != nil {
			return false, result.Error
		}
	}

	var record LockRecord
	err = l.db.WithContext(ctx).Where("`key` = ? AND node_id = ?", key, l.nodeID).First(&record).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}

	return record.ExpiresAt.After(now), nil
}

func (l *dbLock) Release(ctx context.Context, key string) error {
	return l.db.WithContext(ctx).Where("`key` = ? AND node_id = ?", key, l.nodeID).Delete(&LockRecord{}).Error
}

type Scheduler struct {
	mu                sync.RWMutex
	config            *config.Config
	store             store.Store
	queue             queue.Queue
	workerPool        *worker.WorkerPool
	retryManager      *retry.RetryManager
	dlqManager        *dlq.DeadLetterManager
	dependencyChecker dependency.DependencyChecker
	outputManager     output.OutputManager
	notifier          *notifier.AlertManager
	cronParser        *cron.CronParser
	cronParserExtended *cron.CronParser
	lock              DistributedLock
	lockMigrated      bool
	taskHandlers      map[string]func(ctx context.Context, job *models.Job) (string, error)

	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	started    bool
	stopped    bool
	triggerCh  chan struct{}
}

type SchedulerConfig struct {
	Config            *config.Config
	Store             store.Store
	Queue             queue.Queue
	WorkerPool        *worker.WorkerPool
	RetryManager      *retry.RetryManager
	DLQManager        *dlq.DeadLetterManager
	DependencyChecker dependency.DependencyChecker
	OutputManager     output.OutputManager
	Notifier          *notifier.AlertManager
	DB                *gorm.DB
}

func NewScheduler(cfg *SchedulerConfig) (*Scheduler, error) {
	if cfg == nil {
		return nil, errors.New("scheduler config is required")
	}
	if cfg.Config == nil {
		return nil, errors.New("config is required")
	}
	if cfg.Store == nil {
		return nil, errors.New("store is required")
	}
	if cfg.Queue == nil {
		return nil, errors.New("queue is required")
	}

	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Error,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)
	cfg.DB.Logger = newLogger

	s := &Scheduler{
		config:              cfg.Config,
		store:               cfg.Store,
		queue:               cfg.Queue,
		workerPool:          cfg.WorkerPool,
		retryManager:        cfg.RetryManager,
		dlqManager:          cfg.DLQManager,
		dependencyChecker:   cfg.DependencyChecker,
		outputManager:       cfg.OutputManager,
		notifier:            cfg.Notifier,
		cronParser:          cron.NewCronParser(cron.ModeStandard),
		cronParserExtended:  cron.NewCronParser(cron.ModeExtended),
		lock:                NewDistributedLock(cfg.DB, cfg.Config.Node.NodeID),
		taskHandlers:        make(map[string]func(ctx context.Context, job *models.Job) (string, error)),
		triggerCh:           make(chan struct{}, 1),
	}

	if s.retryManager == nil {
		s.retryManager = retry.NewRetryManager(&cfg.Config.Retry)
	}
	if s.retryManager != nil {
		s.retryManager.SetStore(cfg.Store)
	}
	if s.dependencyChecker == nil {
		s.dependencyChecker = dependency.DependencyChecker(dependency.NewDefaultDependencyChecker(cfg.Store))
	}
	if s.outputManager == nil {
		s.outputManager = output.NewOutputManager()
	}
	if s.notifier == nil {
		s.notifier = notifier.NewAlertManager()
	}
	if cfg.DLQManager == nil {
		s.dlqManager = dlq.NewDeadLetterManager(cfg.Store, cfg.DB)
	} else {
		s.dlqManager = cfg.DLQManager
	}

	return s, nil
}

func (s *Scheduler) RegisterTaskHandler(taskType string, handler func(ctx context.Context, job *models.Job) (string, error)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.taskHandlers[taskType] = handler
}

func (s *Scheduler) Start(ctx context.Context) error {
	s.mu.Lock()
	if s.started {
		s.mu.Unlock()
		return nil
	}
	if s.stopped {
		s.mu.Unlock()
		return ErrSchedulerStopped
	}

	s.ctx, s.cancel = context.WithCancel(ctx)
	s.started = true
	s.mu.Unlock()

	handler := func(ctx context.Context, task *queue.Task) error {
		return s.processTask(ctx, task)
	}

	s.mu.Lock()
	if s.workerPool == nil {
		poolCfg := worker.PoolConfig{
			WorkerCount: s.config.WorkerCount,
			MaxWorkers:  s.config.WorkerCount * 2,
			MinWorkers:  1,
			Queue:       s.queue,
			Handler:     handler,
		}

		pool, err := worker.NewWorkerPool(poolCfg)
		if err != nil {
			s.mu.Unlock()
			return fmt.Errorf("create worker pool failed: %w", err)
		}
		s.workerPool = pool
	}
	s.mu.Unlock()

	if err := s.workerPool.Start(s.ctx); err != nil {
		return fmt.Errorf("start worker pool failed: %w", err)
	}

	if err := s.recoverJobs(s.ctx); err != nil {
		return fmt.Errorf("recover jobs failed: %w", err)
	}

	s.wg.Add(1)
	go s.triggerLoop()

	return nil
}

func (s *Scheduler) Stop(ctx context.Context) error {
	s.mu.Lock()
	if !s.started || s.stopped {
		s.mu.Unlock()
		return nil
	}
	s.stopped = true
	s.mu.Unlock()

	if s.cancel != nil {
		s.cancel()
	}

	if s.workerPool != nil {
		if err := s.workerPool.Stop(ctx); err != nil {
			return err
		}
	}

	s.wg.Wait()

	return nil
}

func (s *Scheduler) ScheduleJob(ctx context.Context, job *models.Job) error {
	s.mu.RLock()
	stopped := s.stopped
	s.mu.RUnlock()

	if stopped {
		return ErrSchedulerStopped
	}

	if job == nil {
		return errors.New("job is required")
	}

	if job.CronExpr != "" {
		parser := s.cronParser
		if job.CronMode == models.CronModeExtended {
			parser = s.cronParserExtended
		}
		cronExpr, err := parser.Parse(job.CronExpr)
		if err != nil {
			return fmt.Errorf("parse cron expression failed: %w", err)
		}
		job.NextExecuteTime = cronExpr.Next(time.Now())
	}

	if job.NextExecuteTime.IsZero() {
		job.NextExecuteTime = time.Now()
	}

	if job.Status == "" {
		job.Status = models.JobStatusPending
	}

	job.NodeID = s.config.Node.NodeID

	if err := s.store.SaveJob(ctx, job); err != nil {
		return fmt.Errorf("save job failed: %w", err)
	}

	s.notifyTrigger()

	s.notifier.NotifyInfo(ctx, "任务已调度", fmt.Sprintf("任务 %s 已成功调度，下次执行时间: %s", job.Name, job.NextExecuteTime.Format(time.RFC3339)), job.ID)

	return nil
}

func (s *Scheduler) triggerLoop() {
	defer s.wg.Done()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-s.triggerCh:
			s.checkAndTriggerJobs()
		case <-ticker.C:
			s.checkAndTriggerJobs()
		}
	}
}

func (s *Scheduler) notifyTrigger() {
	select {
	case s.triggerCh <- struct{}{}:
	default:
	}
}

func (s *Scheduler) checkAndTriggerJobs() {
	lockKey := "scheduler:trigger"
	acquired, err := s.lock.Acquire(s.ctx, lockKey, 5*time.Second)
	if err != nil || !acquired {
		return
	}
	defer s.lock.Release(s.ctx, lockKey)

	jobs, err := s.store.ListPendingJobs(s.ctx, 100)
	if err != nil {
		s.notifier.NotifyError(s.ctx, "获取待执行任务失败", err.Error(), "")
		return
	}

	for _, job := range jobs {
		if err := s.submitJobToQueue(job); err != nil {
			s.notifier.NotifyError(s.ctx, "提交任务到队列失败", fmt.Sprintf("任务 %s: %s", job.Name, err.Error()), job.ID)
		}
	}
}

func (s *Scheduler) submitJobToQueue(job *models.Job) error {
	jobData, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("marshal job failed: %w", err)
	}

	task := &queue.Task{
		ID:        job.ID,
		Name:      job.Name,
		Priority:  queue.PriorityNormal,
		Payload:   jobData,
		MaxRetry:  job.MaxRetries,
		ExecuteAt: job.NextExecuteTime,
	}

	if err := s.workerPool.Submit(s.ctx, task); err != nil {
		return fmt.Errorf("submit task failed: %w", err)
	}

	if err := s.store.UpdateJobStatus(s.ctx, job.ID, models.JobStatusRunning); err != nil {
		return fmt.Errorf("update job status failed: %w", err)
	}

	return nil
}

func (s *Scheduler) processTask(ctx context.Context, task *queue.Task) error {
	var job models.Job
	if err := json.Unmarshal(task.Payload, &job); err != nil {
		return fmt.Errorf("unmarshal job failed: %w", err)
	}

	storedJob, err := s.store.GetJob(ctx, job.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return fmt.Errorf("get job failed: %w", err)
	}

	return s.executeJob(ctx, storedJob)
}

func (s *Scheduler) executeJob(ctx context.Context, job *models.Job) error {
	execution := &models.JobExecution{
		JobID:      job.ID,
		Status:     models.JobStatusRunning,
		NodeID:     s.config.Node.NodeID,
		StartTime:  time.Now(),
		RetryCount: job.RetryCount,
	}

	if err := s.store.SaveExecution(ctx, execution); err != nil {
		return fmt.Errorf("save execution failed: %w", err)
	}

	ok, err := s.dependencyChecker.CheckDependencies(ctx, job)
	if err != nil {
		s.handleJobError(ctx, job, execution, fmt.Errorf("check dependencies failed: %w", err))
		return err
	}
	if !ok {
		job.Status = models.JobStatusWaiting
		job.NextExecuteTime = time.Now().Add(30 * time.Second)
		if err := s.store.UpdateJob(ctx, job); err != nil {
			return err
		}
		execution.Status = models.JobStatusWaiting
		endTime := time.Now()
		execution.EndTime = &endTime
		execution.Duration = endTime.Sub(execution.StartTime).Milliseconds()
		s.store.SaveExecution(ctx, execution)
		s.notifier.NotifyWarning(ctx, "任务等待依赖", fmt.Sprintf("任务 %s 等待依赖条件满足", job.Name), job.ID)
		return nil
	}

	s.mu.RLock()
	handler, exists := s.taskHandlers[job.Type]
	s.mu.RUnlock()

	var result string
	var execErr error

	if exists {
		result, execErr = handler(ctx, job)
	} else {
		execErr = fmt.Errorf("no handler registered for task type: %s", job.Type)
	}

	endTime := time.Now()
	execution.EndTime = &endTime
	execution.Duration = endTime.Sub(execution.StartTime).Milliseconds()
	execution.Result = result

	job.ExecuteTimes++
	lastExecuteTime := endTime
	job.LastExecuteTime = &lastExecuteTime
	job.LastResult = result

	if execErr != nil {
		execution.Status = models.JobStatusFailed
		execution.ErrorMessage = execErr.Error()
		s.store.SaveExecution(ctx, execution)
		s.handleJobError(ctx, job, execution, execErr)
		return execErr
	}

	execution.Status = models.JobStatusCompleted
	s.store.SaveExecution(ctx, execution)
	s.handleJobSuccess(ctx, job, execution)

	return nil
}

func (s *Scheduler) handleJobSuccess(ctx context.Context, job *models.Job, execution *models.JobExecution) {
	job.Status = models.JobStatusCompleted
	job.ErrorMessage = ""

	if job.CronExpr != "" {
		parser := s.cronParser
		if job.CronMode == models.CronModeExtended {
			parser = s.cronParserExtended
		}
		if cronExpr, err := parser.Parse(job.CronExpr); err == nil {
			nextTime := cronExpr.Next(time.Now())
			if !nextTime.IsZero() {
				job.NextExecuteTime = nextTime
				job.Status = models.JobStatusPending
				job.RetryCount = 0
			}
		}
	}

	if err := s.store.UpdateJob(ctx, job); err != nil {
		s.notifier.NotifyError(ctx, "更新任务状态失败", err.Error(), job.ID)
	}

	if s.outputManager != nil {
		if err := s.outputManager.SendResult(ctx, job, execution); err != nil {
			s.notifier.NotifyWarning(ctx, "发送任务结果失败", err.Error(), job.ID)
		}
	}

	s.notifier.NotifyInfo(ctx, "任务执行成功", fmt.Sprintf("任务 %s 执行成功，耗时 %d ms", job.Name, execution.Duration), job.ID)
	s.notifyTrigger()
}

func (s *Scheduler) handleJobError(ctx context.Context, job *models.Job, execution *models.JobExecution, err error) {
	job.ErrorMessage = err.Error()

	if s.retryManager.ShouldRetry(job) {
		if handleErr := s.retryManager.HandleRetry(ctx, job, err); handleErr != nil {
			s.notifier.NotifyError(ctx, "处理任务重试失败", handleErr.Error(), job.ID)
		}
		if updateErr := s.store.UpdateJob(ctx, job); updateErr != nil {
			s.notifier.NotifyError(ctx, "更新任务重试状态失败", updateErr.Error(), job.ID)
		}
		s.notifier.NotifyWarning(ctx, "任务执行失败，准备重试",
			fmt.Sprintf("任务 %s 执行失败，第 %d 次重试，下次执行时间: %s，错误: %s",
				job.Name, job.RetryCount, job.NextExecuteTime.Format(time.RFC3339)),
			job.ID)
	} else {
		if dlqErr := s.dlqManager.MoveToDeadLetter(ctx, job, err.Error()); dlqErr != nil {
			s.notifier.NotifyError(ctx, "移动任务到死信队列失败", dlqErr.Error(), job.ID)
		}
		s.notifier.NotifyCritical(ctx, "任务重试失败，进入死信队列",
			fmt.Sprintf("任务 %s 重试 %d 次后仍然失败，已进入死信队列，错误: %s",
				job.Name, job.RetryCount, err.Error()),
			job.ID)
	}

	if s.outputManager != nil {
		if outputErr := s.outputManager.SendResult(ctx, job, execution); outputErr != nil {
			s.notifier.NotifyWarning(ctx, "发送任务结果失败", outputErr.Error(), job.ID)
		}
	}

	s.notifyTrigger()
}

func (s *Scheduler) recoverJobs(ctx context.Context) error {
	lockKey := "scheduler:recover"
	acquired, err := s.lock.Acquire(ctx, lockKey, 30*time.Second)
	if err != nil {
		return fmt.Errorf("acquire recover lock failed: %w", err)
	}
	if !acquired {
		return nil
	}
	defer s.lock.Release(ctx, lockKey)

	jobs, err := s.store.RecoverJobs(ctx, s.config.Node.NodeID)
	if err != nil {
		return fmt.Errorf("recover jobs from store failed: %w", err)
	}

	for _, job := range jobs {
		if job.NextExecuteTime.Before(time.Now()) {
			job.NextExecuteTime = time.Now().Add(5 * time.Second)
			if err := s.store.UpdateJob(ctx, job); err != nil {
				s.notifier.NotifyError(ctx, "恢复任务失败", err.Error(), job.ID)
				continue
			}
		}
	}

	s.notifier.NotifyInfo(ctx, "任务恢复完成", fmt.Sprintf("已恢复 %d 个未完成任务", len(jobs)), "")

	return nil
}

func (s *Scheduler) GetJob(ctx context.Context, id string) (*models.Job, error) {
	return s.store.GetJob(ctx, id)
}

func (s *Scheduler) ListJobs(ctx context.Context) ([]*models.Job, error) {
	return s.store.ListJobs(ctx)
}

func (s *Scheduler) DeleteJob(ctx context.Context, id string) error {
	job, err := s.store.GetJob(ctx, id)
	if err != nil {
		return err
	}
	return s.store.Transaction(ctx, func(tx *gorm.DB) error {
		if err := tx.Delete(job).Error; err != nil {
			return err
		}
		return nil
	})
}

func (s *Scheduler) TriggerJob(ctx context.Context, id string) error {
	job, err := s.store.GetJob(ctx, id)
	if err != nil {
		return err
	}
	job.NextExecuteTime = time.Now()
	job.Status = models.JobStatusPending
	if err := s.store.UpdateJob(ctx, job); err != nil {
		return err
	}
	s.notifyTrigger()
	return nil
}

func (s *Scheduler) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.started && !s.stopped
}

func (s *Scheduler) ListJobsWithFilter(ctx context.Context, status string, offset, limit int) ([]*models.Job, int64, error) {
	return s.store.ListJobsWithFilter(ctx, models.JobStatus(status), offset, limit)
}

func (s *Scheduler) UpdateJob(ctx context.Context, job *models.Job) error {
	if job.CronExpr != "" {
		cronExpr, err := s.cronParser.Parse(job.CronExpr)
		if err != nil {
			return fmt.Errorf("parse cron expression failed: %w", err)
		}
		job.NextExecuteTime = cronExpr.Next(time.Now())
	}
	if err := s.store.UpdateJob(ctx, job); err != nil {
		return err
	}
	s.notifyTrigger()
	return nil
}

func (s *Scheduler) ListExecutions(ctx context.Context, jobID string, offset, limit int) ([]*models.JobExecution, int64, error) {
	return s.store.ListExecutions(ctx, jobID, offset, limit)
}

func (s *Scheduler) GetStats(ctx context.Context) (*store.Stats, error) {
	return s.store.GetStats(ctx)
}

func (s *Scheduler) ListDeadLetters(ctx context.Context, offset, limit int) ([]*models.DeadLetterJob, int64, error) {
	return s.store.ListDeadLetterJobs(ctx, offset, limit)
}

func (s *Scheduler) GetDeadLetterJob(ctx context.Context, id string) (*models.DeadLetterJob, error) {
	return s.store.GetDeadLetterJob(ctx, id)
}

func (s *Scheduler) ResubmitDeadLetter(ctx context.Context, id string) error {
	return s.dlqManager.Resubmit(ctx, id)
}

func (s *Scheduler) ProcessDeadLetter(ctx context.Context, id, processedBy, note string) error {
	return s.dlqManager.ProcessDeadLetter(ctx, id, processedBy, note)
}
