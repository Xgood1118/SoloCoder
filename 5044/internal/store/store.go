package store

import (
	"context"
	"fmt"
	"time"

	"github.com/solocoder/taskscheduler/internal/models"
	"gorm.io/gorm"
)

type Store interface {
	AutoMigrate() error
	SaveJob(ctx context.Context, job *models.Job) error
	GetJob(ctx context.Context, id string) (*models.Job, error)
	ListJobs(ctx context.Context) ([]*models.Job, error)
	ListJobsWithFilter(ctx context.Context, status models.JobStatus, offset, limit int) ([]*models.Job, int64, error)
	UpdateJobStatus(ctx context.Context, id string, status models.JobStatus) error
	ListPendingJobs(ctx context.Context, limit int) ([]*models.Job, error)
	ListRunningJobs(ctx context.Context) ([]*models.Job, error)
	RecoverJobs(ctx context.Context, nodeID string) ([]*models.Job, error)
	SaveExecution(ctx context.Context, execution *models.JobExecution) error
	ListExecutions(ctx context.Context, jobID string, offset, limit int) ([]*models.JobExecution, int64, error)
	MoveToDeadLetter(ctx context.Context, job *models.Job, errorMessage string) error
	GetDeadLetterJobs(ctx context.Context, processed bool, limit int) ([]*models.DeadLetterJob, error)
	GetDeadLetterJob(ctx context.Context, id string) (*models.DeadLetterJob, error)
	ListDeadLetterJobs(ctx context.Context, offset, limit int) ([]*models.DeadLetterJob, int64, error)
	UpdateJob(ctx context.Context, job *models.Job) error
	GetStats(ctx context.Context) (*Stats, error)
	Transaction(ctx context.Context, fn func(tx *gorm.DB) error) error
}

type Stats struct {
	TotalJobs     int64 `json:"total_jobs"`
	RunningJobs   int64 `json:"running_jobs"`
	SuccessJobs   int64 `json:"success_jobs"`
	FailedJobs    int64 `json:"failed_jobs"`
	DeadLetterJobs int64 `json:"dead_letter_jobs"`
}

type store struct {
	db *gorm.DB
}

func NewStore(db *gorm.DB) Store {
	return &store{db: db}
}

func (s *store) AutoMigrate() error {
	if err := s.createJobsTable(); err != nil {
		return err
	}
	if err := s.createJobExecutionsTable(); err != nil {
		return err
	}
	if err := s.createDeadLetterJobsTable(); err != nil {
		return err
	}
	if err := s.createLockRecordsTable(); err != nil {
		return err
	}
	return nil
}

func (s *store) createJobsTable() error {
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS jobs (
		id char(36) PRIMARY KEY,
		name varchar(255) NOT NULL,
		type varchar(100) NOT NULL,
		cron_expr varchar(100) NOT NULL,
		cron_mode varchar(20) NOT NULL DEFAULT 'standard',
		payload text,
		status varchar(20) NOT NULL DEFAULT 'pending',
		dependencies text,
		max_retries INTEGER DEFAULT 3,
		retry_count INTEGER DEFAULT 0,
		last_retry_time DATETIME,
		next_execute_time DATETIME NOT NULL,
		execute_times INTEGER DEFAULT 0,
		last_execute_time DATETIME,
		last_result text,
		error_message text,
		node_id varchar(100),
		created_at DATETIME,
		updated_at DATETIME
	)`
	if err := s.db.Exec(createTableSQL).Error; err != nil {
		return fmt.Errorf("create jobs table failed: %w", err)
	}

	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_jobs_name ON jobs(name)",
		"CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)",
		"CREATE INDEX IF NOT EXISTS idx_jobs_next_execute_time ON jobs(next_execute_time)",
		"CREATE INDEX IF NOT EXISTS idx_jobs_node_id ON jobs(node_id)",
	}
	for _, idx := range indexes {
		if err := s.db.Exec(idx).Error; err != nil {
			return fmt.Errorf("create index failed: %w", err)
		}
	}
	return nil
}

func (s *store) createJobExecutionsTable() error {
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS job_executions (
		id char(36) PRIMARY KEY,
		job_id char(36) NOT NULL,
		status varchar(20) NOT NULL,
		node_id varchar(100) NOT NULL,
		start_time DATETIME NOT NULL,
		end_time DATETIME,
		duration INTEGER,
		result text,
		error_message text,
		retry_count INTEGER DEFAULT 0,
		created_at DATETIME
	)`
	if err := s.db.Exec(createTableSQL).Error; err != nil {
		return fmt.Errorf("create job_executions table failed: %w", err)
	}

	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_job_executions_job_id ON job_executions(job_id)",
		"CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status)",
		"CREATE INDEX IF NOT EXISTS idx_job_executions_created_at ON job_executions(created_at)",
	}
	for _, idx := range indexes {
		if err := s.db.Exec(idx).Error; err != nil {
			return fmt.Errorf("create index failed: %w", err)
		}
	}
	return nil
}

func (s *store) createDeadLetterJobsTable() error {
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS dead_letter_jobs (
		id char(36) PRIMARY KEY,
		job_id char(36) NOT NULL,
		job_name varchar(255) NOT NULL,
		job_type varchar(100) NOT NULL,
		payload text,
		error_message text,
		retry_count INTEGER DEFAULT 0,
		processed BOOLEAN DEFAULT 0,
		processed_at DATETIME,
		processed_note text,
		created_at DATETIME,
		updated_at DATETIME
	)`
	if err := s.db.Exec(createTableSQL).Error; err != nil {
		return fmt.Errorf("create dead_letter_jobs table failed: %w", err)
	}

	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_dead_letter_jobs_job_id ON dead_letter_jobs(job_id)",
		"CREATE INDEX IF NOT EXISTS idx_dead_letter_jobs_processed ON dead_letter_jobs(processed)",
		"CREATE INDEX IF NOT EXISTS idx_dead_letter_jobs_created_at ON dead_letter_jobs(created_at)",
	}
	for _, idx := range indexes {
		if err := s.db.Exec(idx).Error; err != nil {
			return fmt.Errorf("create index failed: %w", err)
		}
	}
	return nil
}

func (s *store) createLockRecordsTable() error {
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS lock_records (
		"key" varchar(255) PRIMARY KEY,
		node_id varchar(100) NOT NULL,
		expires_at DATETIME NOT NULL,
		created_at DATETIME
	)`
	if err := s.db.Exec(createTableSQL).Error; err != nil {
		return fmt.Errorf("create lock_records table failed: %w", err)
	}

	indexSQL := "CREATE INDEX IF NOT EXISTS idx_lock_records_expires_at ON lock_records(expires_at)"
	if err := s.db.Exec(indexSQL).Error; err != nil {
		return fmt.Errorf("create index failed: %w", err)
	}
	return nil
}

func (s *store) SaveJob(ctx context.Context, job *models.Job) error {
	return s.db.WithContext(ctx).Save(job).Error
}

func (s *store) GetJob(ctx context.Context, id string) (*models.Job, error) {
	var job models.Job
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (s *store) ListJobs(ctx context.Context) ([]*models.Job, error) {
	var jobs []*models.Job
	if err := s.db.WithContext(ctx).Order("created_at DESC").Find(&jobs).Error; err != nil {
		return nil, err
	}
	return jobs, nil
}

func (s *store) UpdateJobStatus(ctx context.Context, id string, status models.JobStatus) error {
	return s.db.WithContext(ctx).
		Model(&models.Job{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (s *store) UpdateJob(ctx context.Context, job *models.Job) error {
	return s.db.WithContext(ctx).Save(job).Error
}

func (s *store) ListPendingJobs(ctx context.Context, limit int) ([]*models.Job, error) {
	var jobs []*models.Job
	now := time.Now()
	err := s.db.WithContext(ctx).
		Where("status = ? AND next_execute_time <= ?", models.JobStatusPending, now).
		Order("next_execute_time ASC").
		Limit(limit).
		Find(&jobs).Error
	if err != nil {
		return nil, err
	}
	return jobs, nil
}

func (s *store) ListRunningJobs(ctx context.Context) ([]*models.Job, error) {
	var jobs []*models.Job
	err := s.db.WithContext(ctx).
		Where("status = ?", models.JobStatusRunning).
		Find(&jobs).Error
	if err != nil {
		return nil, err
	}
	return jobs, nil
}

func (s *store) RecoverJobs(ctx context.Context, nodeID string) ([]*models.Job, error) {
	var jobs []*models.Job
	err := s.db.WithContext(ctx).
		Where("status IN ?", []models.JobStatus{
			models.JobStatusPending,
			models.JobStatusRunning,
			models.JobStatusWaiting,
			models.JobStatusFailed,
		}).
		Order("next_execute_time ASC").
		Find(&jobs).Error
	if err != nil {
		return nil, err
	}

	for _, job := range jobs {
		if job.Status == models.JobStatusRunning {
			job.Status = models.JobStatusPending
			job.NodeID = nodeID
			if err := s.db.WithContext(ctx).Save(job).Error; err != nil {
				return nil, err
			}
		}
	}

	return jobs, nil
}

func (s *store) SaveExecution(ctx context.Context, execution *models.JobExecution) error {
	return s.db.WithContext(ctx).Save(execution).Error
}

func (s *store) MoveToDeadLetter(ctx context.Context, job *models.Job, errorMessage string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		deadLetter := &models.DeadLetterJob{
			OriginalJobID: job.ID,
			Name:          job.Name,
			Type:          job.Type,
			CronExpr:      job.CronExpr,
			CronMode:      job.CronMode,
			Payload:       job.Payload,
			Dependencies:  job.Dependencies,
			MaxRetries:    job.MaxRetries,
			RetryCount:    job.RetryCount,
			LastResult:    job.LastResult,
			ErrorMessage:  errorMessage,
			FailedTime:    time.Now(),
			NodeID:        job.NodeID,
			Processed:     false,
		}

		if err := tx.Create(deadLetter).Error; err != nil {
			return err
		}

		if err := tx.Delete(job).Error; err != nil {
			return err
		}

		return nil
	})
}

func (s *store) GetDeadLetterJobs(ctx context.Context, processed bool, limit int) ([]*models.DeadLetterJob, error) {
	var jobs []*models.DeadLetterJob
	query := s.db.WithContext(ctx).Where("processed = ?", processed)
	if limit > 0 {
		query = query.Limit(limit)
	}
	err := query.Order("created_at DESC").Find(&jobs).Error
	if err != nil {
		return nil, err
	}
	return jobs, nil
}

func (s *store) Transaction(ctx context.Context, fn func(tx *gorm.DB) error) error {
	return s.db.WithContext(ctx).Transaction(fn)
}

func (s *store) ListJobsWithFilter(ctx context.Context, status models.JobStatus, offset, limit int) ([]*models.Job, int64, error) {
	var jobs []*models.Job
	var total int64

	query := s.db.WithContext(ctx).Model(&models.Job{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&jobs).Error
	if err != nil {
		return nil, 0, err
	}

	return jobs, total, nil
}

func (s *store) ListExecutions(ctx context.Context, jobID string, offset, limit int) ([]*models.JobExecution, int64, error) {
	var executions []*models.JobExecution
	var total int64

	query := s.db.WithContext(ctx).Model(&models.JobExecution{})
	if jobID != "" {
		query = query.Where("job_id = ?", jobID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&executions).Error
	if err != nil {
		return nil, 0, err
	}

	return executions, total, nil
}

func (s *store) GetDeadLetterJob(ctx context.Context, id string) (*models.DeadLetterJob, error) {
	var job models.DeadLetterJob
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (s *store) ListDeadLetterJobs(ctx context.Context, offset, limit int) ([]*models.DeadLetterJob, int64, error) {
	var jobs []*models.DeadLetterJob
	var total int64

	query := s.db.WithContext(ctx).Model(&models.DeadLetterJob{}).Where("processed = ?", false)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&jobs).Error
	if err != nil {
		return nil, 0, err
	}

	return jobs, total, nil
}

func (s *store) GetStats(ctx context.Context) (*Stats, error) {
	var stats Stats

	if err := s.db.WithContext(ctx).Model(&models.Job{}).Count(&stats.TotalJobs).Error; err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Model(&models.Job{}).Where("status = ?", models.JobStatusRunning).Count(&stats.RunningJobs).Error; err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Model(&models.Job{}).Where("status = ?", models.JobStatusCompleted).Count(&stats.SuccessJobs).Error; err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Model(&models.Job{}).Where("status = ?", models.JobStatusFailed).Count(&stats.FailedJobs).Error; err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Model(&models.DeadLetterJob{}).Where("processed = ?", false).Count(&stats.DeadLetterJobs).Error; err != nil {
		return nil, err
	}

	return &stats, nil
}
