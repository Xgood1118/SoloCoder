package dlq

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/solocoder/taskscheduler/internal/models"
	"github.com/solocoder/taskscheduler/internal/queue"
	"github.com/solocoder/taskscheduler/internal/store"
	"gorm.io/gorm"
)

type AlertNotifier interface {
	SendAlert(ctx context.Context, job *models.DeadLetterJob) error
}

type ConsoleAlertNotifier struct{}

func NewConsoleAlertNotifier() *ConsoleAlertNotifier {
	return &ConsoleAlertNotifier{}
}

func (n *ConsoleAlertNotifier) SendAlert(ctx context.Context, job *models.DeadLetterJob) error {
	log.Printf("ALERT: Job moved to dead letter queue. JobID: %s, Name: %s, Error: %s",
		job.OriginalJobID, job.Name, job.ErrorMessage)
	return nil
}

type DeadLetterManager struct {
	store    store.Store
	db       *gorm.DB
	queue    queue.Queue
	notifier AlertNotifier
}

func NewDeadLetterManager(store store.Store, db *gorm.DB) *DeadLetterManager {
	return &DeadLetterManager{
		store:    store,
		db:       db,
		notifier: NewConsoleAlertNotifier(),
	}
}

func NewDeadLetterManagerWithQueue(store store.Store, q queue.Queue, notifier AlertNotifier) *DeadLetterManager {
	if notifier == nil {
		notifier = NewConsoleAlertNotifier()
	}
	return &DeadLetterManager{
		store:    store,
		queue:    q,
		notifier: notifier,
	}
}

func (dlm *DeadLetterManager) SetQueue(q queue.Queue) {
	dlm.queue = q
}

func (dlm *DeadLetterManager) SetNotifier(notifier AlertNotifier) {
	dlm.notifier = notifier
}

func (dlm *DeadLetterManager) SetDB(db *gorm.DB) {
	dlm.db = db
}

func (dlm *DeadLetterManager) MoveToDeadLetter(ctx context.Context, job *models.Job, errorMessage string) error {
	if job == nil {
		return errors.New("job is nil")
	}

	if err := dlm.store.MoveToDeadLetter(ctx, job, errorMessage); err != nil {
		return fmt.Errorf("failed to move job to dead letter: %w", err)
	}

	deadLetterJobs, err := dlm.store.GetDeadLetterJobs(ctx, false, 1)
	if err != nil {
		return fmt.Errorf("failed to get dead letter job: %w", err)
	}

	if len(deadLetterJobs) > 0 && dlm.notifier != nil {
		if err := dlm.notifier.SendAlert(ctx, deadLetterJobs[0]); err != nil {
			log.Printf("Warning: failed to send alert: %v", err)
		}
	}

	return nil
}

func (dlm *DeadLetterManager) ListDeadLetters(ctx context.Context, processed bool, limit int) ([]*models.DeadLetterJob, error) {
	return dlm.store.GetDeadLetterJobs(ctx, processed, limit)
}

func (dlm *DeadLetterManager) ProcessDeadLetter(ctx context.Context, jobID, processedBy, note string) error {
	jobs, err := dlm.store.GetDeadLetterJobs(ctx, false, 0)
	if err != nil {
		return fmt.Errorf("failed to get dead letter jobs: %w", err)
	}

	var targetJob *models.DeadLetterJob
	for _, job := range jobs {
		if job.ID == jobID || job.OriginalJobID == jobID {
			targetJob = job
			break
		}
	}

	if targetJob == nil {
		return fmt.Errorf("dead letter job not found: %s", jobID)
	}

	now := time.Now()
	targetJob.Processed = true
	targetJob.ProcessedAt = &now
	targetJob.ProcessedBy = processedBy
	targetJob.Note = note

	db := dlm.db
	if db == nil {
		return errors.New("db is not initialized")
	}

	return db.WithContext(ctx).Model(&models.DeadLetterJob{}).
		Where("id = ?", targetJob.ID).
		Updates(map[string]interface{}{
			"processed":    true,
			"processed_at": targetJob.ProcessedAt,
			"processed_by": targetJob.ProcessedBy,
			"note":         targetJob.Note,
			"updated_at":   now,
		}).Error
}

func (dlm *DeadLetterManager) Resubmit(ctx context.Context, jobID string) error {
	jobs, err := dlm.store.GetDeadLetterJobs(ctx, false, 0)
	if err != nil {
		return fmt.Errorf("failed to get dead letter jobs: %w", err)
	}

	var targetJob *models.DeadLetterJob
	for _, job := range jobs {
		if job.ID == jobID || job.OriginalJobID == jobID {
			targetJob = job
			break
		}
	}

	if targetJob == nil {
		return fmt.Errorf("dead letter job not found: %s", jobID)
	}

	newJob := &models.Job{
		ID:              targetJob.OriginalJobID,
		Name:            targetJob.Name,
		Type:            targetJob.Type,
		CronExpr:        targetJob.CronExpr,
		CronMode:        targetJob.CronMode,
		Payload:         targetJob.Payload,
		Status:          models.JobStatusPending,
		Dependencies:    targetJob.Dependencies,
		MaxRetries:      targetJob.MaxRetries,
		RetryCount:      0,
		NextExecuteTime: time.Now(),
	}

	db := dlm.db
	if db == nil {
		return errors.New("db is not initialized")
	}

	if err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(newJob).Error; err != nil {
			return err
		}

		now := time.Now()
		return tx.Model(&models.DeadLetterJob{}).
			Where("id = ?", targetJob.ID).
			Updates(map[string]interface{}{
				"processed":    true,
				"processed_at": now,
				"note":         "Resubmitted to queue",
				"updated_at":   now,
			}).Error
	}); err != nil {
		return fmt.Errorf("failed to resubmit job: %w", err)
	}

	task := &queue.Task{
		ID:       newJob.ID,
		Name:     newJob.Name,
		Payload:  []byte(newJob.Payload),
		MaxRetry: newJob.MaxRetries,
	}

	if dlm.queue != nil {
		if err := dlm.queue.Enqueue(ctx, task); err != nil {
			return fmt.Errorf("failed to enqueue resubmitted job: %w", err)
		}
	}

	return nil
}
