package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type JobStatus string

const (
	JobStatusPending   JobStatus = "pending"
	JobStatusRunning   JobStatus = "running"
	JobStatusCompleted JobStatus = "completed"
	JobStatusFailed    JobStatus = "failed"
	JobStatusWaiting   JobStatus = "waiting"
	JobStatusDead      JobStatus = "dead"
)

type CronMode string

const (
	CronModeStandard CronMode = "standard"
	CronModeExtended CronMode = "extended"
)

type Job struct {
	ID              string    `gorm:"primaryKey;type:char(36)" json:"id"`
	Name            string    `gorm:"type:varchar(255);not null;index" json:"name"`
	Type            string    `gorm:"type:varchar(100);not null" json:"type"`
	CronExpr        string    `gorm:"type:varchar(100);not null" json:"cron_expr"`
	CronMode        CronMode  `gorm:"type:varchar(20);not null;default:'standard'" json:"cron_mode"`
	Payload         string    `gorm:"type:text" json:"payload"`
	Status          JobStatus `gorm:"type:varchar(20);not null;default:'pending';index" json:"status"`
	Dependencies    string    `gorm:"type:text" json:"dependencies"`
	MaxRetries      int       `gorm:"default:3" json:"max_retries"`
	RetryCount      int       `gorm:"default:0" json:"retry_count"`
	LastRetryTime   *time.Time `json:"last_retry_time"`
	NextExecuteTime time.Time `gorm:"not null;index" json:"next_execute_time"`
	ExecuteTimes    int       `gorm:"default:0" json:"execute_times"`
	LastExecuteTime *time.Time `json:"last_execute_time"`
	LastResult      string    `gorm:"type:text" json:"last_result"`
	ErrorMessage    string    `gorm:"type:text" json:"error_message"`
	NodeID          string    `gorm:"type:varchar(100);index" json:"node_id"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (j *Job) BeforeCreate(tx *gorm.DB) error {
	if j.ID == "" {
		j.ID = uuid.New().String()
	}
	now := time.Now()
	j.CreatedAt = now
	j.UpdatedAt = now
	return nil
}

func (j *Job) BeforeUpdate(tx *gorm.DB) error {
	j.UpdatedAt = time.Now()
	return nil
}

type JobExecution struct {
	ID            string    `gorm:"primaryKey;type:char(36)" json:"id"`
	JobID         string    `gorm:"type:char(36);not null;index" json:"job_id"`
	Job           *Job      `gorm:"foreignKey:JobID" json:"job,omitempty"`
	Status        JobStatus `gorm:"type:varchar(20);not null" json:"status"`
	NodeID        string    `gorm:"type:varchar(100);not null" json:"node_id"`
	StartTime     time.Time `gorm:"not null" json:"start_time"`
	EndTime       *time.Time `json:"end_time"`
	Duration      int64     `json:"duration"`
	Result        string    `gorm:"type:text" json:"result"`
	ErrorMessage  string    `gorm:"type:text" json:"error_message"`
	RetryCount    int       `gorm:"default:0" json:"retry_count"`
	CreatedAt     time.Time `json:"created_at"`
}

func (je *JobExecution) BeforeCreate(tx *gorm.DB) error {
	if je.ID == "" {
		je.ID = uuid.New().String()
	}
	je.CreatedAt = time.Now()
	return nil
}

type DeadLetterJob struct {
	ID            string    `gorm:"primaryKey;type:char(36)" json:"id"`
	OriginalJobID string    `gorm:"type:char(36);not null;index" json:"original_job_id"`
	Name          string    `gorm:"type:varchar(255);not null" json:"name"`
	Type          string    `gorm:"type:varchar(100);not null" json:"type"`
	CronExpr      string    `gorm:"type:varchar(100);not null" json:"cron_expr"`
	CronMode      CronMode  `gorm:"type:varchar(20);not null" json:"cron_mode"`
	Payload       string    `gorm:"type:text" json:"payload"`
	Dependencies  string    `gorm:"type:text" json:"dependencies"`
	MaxRetries    int       `json:"max_retries"`
	RetryCount    int       `json:"retry_count"`
	LastResult    string    `gorm:"type:text" json:"last_result"`
	ErrorMessage  string    `gorm:"type:text" json:"error_message"`
	FailedTime    time.Time `gorm:"not null" json:"failed_time"`
	NodeID        string    `gorm:"type:varchar(100)" json:"node_id"`
	Processed     bool      `gorm:"default:false;index" json:"processed"`
	ProcessedAt   *time.Time `json:"processed_at"`
	ProcessedBy   string    `gorm:"type:varchar(100)" json:"processed_by"`
	Note          string    `gorm:"type:text" json:"note"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (dlj *DeadLetterJob) BeforeCreate(tx *gorm.DB) error {
	if dlj.ID == "" {
		dlj.ID = uuid.New().String()
	}
	now := time.Now()
	dlj.CreatedAt = now
	dlj.UpdatedAt = now
	return nil
}

func (dlj *DeadLetterJob) BeforeUpdate(tx *gorm.DB) error {
	dlj.UpdatedAt = time.Now()
	return nil
}
