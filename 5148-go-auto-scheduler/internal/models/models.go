package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TaskStatus string

const (
	TaskStatusPending  TaskStatus = "pending"
	TaskStatusRunning  TaskStatus = "running"
	TaskStatusSuccess  TaskStatus = "success"
	TaskStatusFailed   TaskStatus = "failed"
	TaskStatusTimeout  TaskStatus = "timeout"
	TaskStatusPaused   TaskStatus = "paused"
	TaskStatusCanceled TaskStatus = "canceled"
)

type TaskType string

const (
	TaskTypeCommand TaskType = "command"
	TaskTypeDocker  TaskType = "docker"
	TaskTypeAPI     TaskType = "api"
)

type DispatchStrategy string

const (
	DispatchRoundRobin        DispatchStrategy = "round_robin"
	DispatchWeightedRoundRobin DispatchStrategy = "weighted_round_robin"
	DispatchLeastConnections  DispatchStrategy = "least_connections"
)

type RetryStrategy string

const (
	RetryImmediately RetryStrategy = "immediately"
	RetryNextSchedule RetryStrategy = "next_schedule"
	RetryMarkFailed  RetryStrategy = "mark_failed"
)

type ExecutorStatus string

const (
	ExecutorStatusOnline  ExecutorStatus = "online"
	ExecutorStatusOffline ExecutorStatus = "offline"
	ExecutorStatusBusy    ExecutorStatus = "busy"
)

type SignalType string

const (
	SignalTERM SignalType = "SIGTERM"
	SignalKILL SignalType = "SIGKILL"
)

type BaseModel struct {
	ID        string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	return nil
}

type Task struct {
	BaseModel
	Name           string           `gorm:"type:varchar(255);not null" json:"name"`
	Description    string           `gorm:"type:text" json:"description"`
	CronExpr       string           `gorm:"type:varchar(100);not null" json:"cron_expr"`
	CronExpr5      string           `gorm:"type:varchar(100)" json:"cron_expr_5"`
	TaskType       TaskType         `gorm:"type:varchar(50);not null" json:"task_type"`
	Command        string           `gorm:"type:text;not null" json:"command"`
	Timeout        int              `gorm:"default:300" json:"timeout"`
	Priority       int              `gorm:"default:0" json:"priority"`
	Status         TaskStatus       `gorm:"type:varchar(20);default:pending" json:"status"`
	DispatchStrategy DispatchStrategy `gorm:"type:varchar(50);default:round_robin" json:"dispatch_strategy"`
	RetryStrategy  RetryStrategy    `gorm:"type:varchar(50);default:next_schedule" json:"retry_strategy"`
	RetryCount     int              `gorm:"default:0" json:"retry_count"`
	MaxRetry       int              `gorm:"default:3" json:"max_retry"`
	UserID         string           `gorm:"type:varchar(36);not null" json:"user_id"`
	ExecutorID     string           `gorm:"type:varchar(36)" json:"executor_id"`
	IsPaused       bool             `gorm:"default:false" json:"is_paused"`
	IsDeleted      bool             `gorm:"default:false" json:"is_deleted"`
}

type Executor struct {
	BaseModel
	Name         string         `gorm:"type:varchar(255);not null" json:"name"`
	Description  string         `gorm:"type:text" json:"description"`
	ExecutorType TaskType       `gorm:"type:varchar(50);not null" json:"executor_type"`
	Address      string         `gorm:"type:varchar(512);not null" json:"address"`
	AuthToken    string         `gorm:"type:varchar(512)" json:"auth_token"`
	Weight       int            `gorm:"default:1" json:"weight"`
	MaxTasks     int            `gorm:"default:10" json:"max_tasks"`
	CurrentTasks int            `gorm:"default:0" json:"current_tasks"`
	Status       ExecutorStatus `gorm:"type:varchar(20);default:offline" json:"status"`
	LastHeartbeat time.Time     `json:"last_heartbeat"`
	UserID       string         `gorm:"type:varchar(36);not null" json:"user_id"`
	IsBackup     bool           `gorm:"default:false" json:"is_backup"`
	PrimaryID    string         `gorm:"type:varchar(36)" json:"primary_id"`
}

type TaskExecution struct {
	BaseModel
	TaskID        string     `gorm:"type:varchar(36);not null;index" json:"task_id"`
	ExecutorID    string     `gorm:"type:varchar(36);not null" json:"executor_id"`
	StartTime     time.Time  `gorm:"index" json:"start_time"`
	EndTime       *time.Time `json:"end_time"`
	Status        TaskStatus `gorm:"type:varchar(20);default:pending" json:"status"`
	ExitCode      *int       `json:"exit_code"`
	Stdout        string     `gorm:"type:text" json:"stdout"`
	Stderr        string     `gorm:"type:text" json:"stderr"`
	Command       string     `gorm:"type:text" json:"command"`
	Timeout       int        `json:"timeout"`
	SignalType    SignalType `gorm:"type:varchar(20)" json:"signal_type"`
	SignalTime    *time.Time `json:"signal_time"`
	IsTimeout     bool       `gorm:"default:false" json:"is_timeout"`
	RetryCount    int        `gorm:"default:0" json:"retry_count"`
	QueueDuration int64      `gorm:"default:0" json:"queue_duration_ms"`
}

type TaskAssignment struct {
	BaseModel
	TaskID        string    `gorm:"type:varchar(36);not null;uniqueIndex" json:"task_id"`
	ExecutorID    string    `gorm:"type:varchar(36);not null" json:"executor_id"`
	AssignedAt    time.Time `json:"assigned_at"`
	DispatchStrategy DispatchStrategy `gorm:"type:varchar(50)" json:"dispatch_strategy"`
}

type AuditLog struct {
	BaseModel
	UserID       string    `gorm:"type:varchar(36);not null;index" json:"user_id"`
	Username     string    `gorm:"type:varchar(255);not null" json:"username"`
	Operation    string    `gorm:"type:varchar(100);not null;index" json:"operation"`
	ResourceType string    `gorm:"type:varchar(50);not null" json:"resource_type"`
	ResourceID   string    `gorm:"type:varchar(36);index" json:"resource_id"`
	Detail       string    `gorm:"type:text" json:"detail"`
	IPAddress    string    `gorm:"type:varchar(50)" json:"ip_address"`
	Timestamp    time.Time `gorm:"index" json:"timestamp"`
	Sensitive    bool      `gorm:"default:false" json:"sensitive"`
	Confirmed    bool      `gorm:"default:false" json:"confirmed"`
}

type ExecutionLog struct {
	BaseModel
	TaskExecutionID string    `gorm:"type:varchar(36);not null;index" json:"task_execution_id"`
	TaskID          string    `gorm:"type:varchar(36);not null;index" json:"task_id"`
	Timestamp       time.Time `gorm:"index" json:"timestamp"`
	Level           string    `gorm:"type:varchar(20)" json:"level"`
	Content         string    `gorm:"type:text" json:"content"`
	Source          string    `gorm:"type:varchar(50)" json:"source"`
	Offset          int64     `json:"offset"`
}

type User struct {
	BaseModel
	Username string `gorm:"type:varchar(100);unique;not null" json:"username"`
	Password string `gorm:"type:varchar(255);not null" json:"-"`
	Email    string `gorm:"type:varchar(255)" json:"email"`
	Role     string `gorm:"type:varchar(50);default:user" json:"role"`
	IsActive bool   `gorm:"default:true" json:"is_active"`
}

type Heartbeat struct {
	ExecutorID  string    `json:"executor_id"`
	Timestamp   time.Time `json:"timestamp"`
	Load        float64   `json:"load"`
	CurrentJobs int       `json:"current_jobs"`
}

type CronPreviewRequest struct {
	CronExpr string `json:"cron_expr" binding:"required"`
	Count    int    `json:"count"`
}

type CronPreviewResponse struct {
	Valid      bool        `json:"valid"`
	Error      string      `json:"error,omitempty"`
	NextTimes  []time.Time `json:"next_times,omitempty"`
	Normalized string      `json:"normalized,omitempty"`
}

type Pagination struct {
	Page     int `form:"page,default=1"`
	PageSize int `form:"page_size,default=20"`
	Total    int64 `json:"total"`
}

type LogQueryRequest struct {
	TaskID string `form:"task_id" binding:"required"`
	Pagination
}

type LogDownloadRequest struct {
	TaskID string `uri:"task_id" binding:"required"`
}
