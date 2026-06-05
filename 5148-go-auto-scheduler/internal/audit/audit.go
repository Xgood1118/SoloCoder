package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/scheduler/go-auto-scheduler/internal/models"
	"github.com/scheduler/go-auto-scheduler/internal/storage"
)

const (
	OpCreateTask    = "create_task"
	OpDeleteTask    = "delete_task"
	OpUpdateTask    = "update_task"
	OpUpdateTaskCron = "update_task_cron"
	OpPauseTask     = "pause_task"
	OpResumeTask    = "resume_task"
	OpCreateExecutor = "create_executor"
	OpDeleteExecutor = "delete_executor"
	OpUpdateExecutor = "update_executor"
	OpUpdateConfig   = "update_config"
	OpUpdateSchedule = "update_schedule"
	OpLogin          = "login"
	OpLogout         = "logout"
)

const (
	ResourceTask     = "task"
	ResourceExecutor = "executor"
	ResourceConfig   = "config"
	ResourceUser     = "user"
)

type SensitiveOperation struct {
	Operation    string
	ResourceType string
	Description  string
}

var sensitiveOperations = map[string]SensitiveOperation{
	OpDeleteTask: {
		Operation:    OpDeleteTask,
		ResourceType: ResourceTask,
		Description:  "删除任务可能导致服务中断",
	},
	OpUpdateTaskCron: {
		Operation:    OpUpdateTaskCron,
		ResourceType: ResourceTask,
		Description:  "修改任务调度时间",
	},
	OpUpdateExecutor: {
		Operation:    OpUpdateExecutor,
		ResourceType: ResourceExecutor,
		Description:  "修改执行器配置",
	},
	OpDeleteExecutor: {
		Operation:    OpDeleteExecutor,
		ResourceType: ResourceExecutor,
		Description:  "删除执行器可能导致任务失败",
	},
	OpUpdateConfig: {
		Operation:    OpUpdateConfig,
		ResourceType: ResourceConfig,
		Description:  "修改系统配置",
	},
}

type Auditor struct {
	db *storage.Database
}

func NewAuditor(db *storage.Database) *Auditor {
	return &Auditor{
		db: db,
	}
}

type AuditContext struct {
	UserID   string
	Username string
	IPAddress string
	Confirm  bool
}

type AuditOption func(*models.AuditLog)

func WithDetail(detail string) AuditOption {
	return func(log *models.AuditLog) {
		log.Detail = detail
	}
}

func WithDetailJSON(v interface{}) AuditOption {
	return func(log *models.AuditLog) {
		if data, err := json.Marshal(v); err == nil {
			log.Detail = string(data)
		}
	}
}

func WithResourceID(id string) AuditOption {
	return func(log *models.AuditLog) {
		log.ResourceID = id
	}
}

func WithIP(ip string) AuditOption {
	return func(log *models.AuditLog) {
		log.IPAddress = ip
	}
}

func (a *Auditor) Log(ctx context.Context, operation, resourceType string, options ...AuditOption) error {
	auditCtx, _ := ctx.Value("audit").(AuditContext)

	log := &models.AuditLog{
		UserID:       auditCtx.UserID,
		Username:     auditCtx.Username,
		Operation:    operation,
		ResourceType: resourceType,
		IPAddress:    auditCtx.IPAddress,
		Timestamp:    time.Now(),
		Confirmed:    auditCtx.Confirm,
	}

	if so, ok := sensitiveOperations[operation]; ok {
		log.Sensitive = true
		if !log.Confirmed {
			return fmt.Errorf("敏感操作需要确认: %s", so.Description)
		}
	}

	for _, opt := range options {
		opt(log)
	}

	return a.db.CreateAuditLog(log)
}

func (a *Auditor) LogTaskCreate(ctx context.Context, task *models.Task) error {
	return a.Log(ctx, OpCreateTask, ResourceTask,
		WithResourceID(task.ID),
		WithDetailJSON(map[string]interface{}{
			"name":     task.Name,
			"type":     task.TaskType,
			"cron":     task.CronExpr,
			"command":  task.Command,
			"timeout":  task.Timeout,
			"priority": task.Priority,
		}),
	)
}

func (a *Auditor) LogTaskDelete(ctx context.Context, taskID string, taskName string) error {
	return a.Log(ctx, OpDeleteTask, ResourceTask,
		WithResourceID(taskID),
		WithDetail(fmt.Sprintf("删除任务: %s (ID: %s)", taskName, taskID)),
	)
}

func (a *Auditor) LogTaskUpdate(ctx context.Context, taskID string, oldTask, newTask *models.Task) error {
	changes := a.getTaskChanges(oldTask, newTask)

	return a.Log(ctx, OpUpdateTask, ResourceTask,
		WithResourceID(taskID),
		WithDetailJSON(map[string]interface{}{
			"task_id": taskID,
			"changes": changes,
		}),
	)
}

func (a *Auditor) LogTaskCronUpdate(ctx context.Context, taskID string, oldCron, newCron string) error {
	return a.Log(ctx, OpUpdateTaskCron, ResourceTask,
		WithResourceID(taskID),
		WithDetail(fmt.Sprintf("修改 Cron 表达式: %s -> %s", oldCron, newCron)),
	)
}

func (a *Auditor) LogTaskPause(ctx context.Context, taskID string, taskName string) error {
	return a.Log(ctx, OpPauseTask, ResourceTask,
		WithResourceID(taskID),
		WithDetail(fmt.Sprintf("暂停任务: %s", taskName)),
	)
}

func (a *Auditor) LogTaskResume(ctx context.Context, taskID string, taskName string) error {
	return a.Log(ctx, OpResumeTask, ResourceTask,
		WithResourceID(taskID),
		WithDetail(fmt.Sprintf("恢复任务: %s", taskName)),
	)
}

func (a *Auditor) LogExecutorCreate(ctx context.Context, executor *models.Executor) error {
	return a.Log(ctx, OpCreateExecutor, ResourceExecutor,
		WithResourceID(executor.ID),
		WithDetailJSON(map[string]interface{}{
			"name":    executor.Name,
			"type":    executor.ExecutorType,
			"address": executor.Address,
			"weight":  executor.Weight,
		}),
	)
}

func (a *Auditor) LogExecutorDelete(ctx context.Context, executorID string, executorName string) error {
	return a.Log(ctx, OpDeleteExecutor, ResourceExecutor,
		WithResourceID(executorID),
		WithDetail(fmt.Sprintf("删除执行器: %s (ID: %s)", executorName, executorID)),
	)
}

func (a *Auditor) LogExecutorUpdate(ctx context.Context, executorID string, oldExecutor, newExecutor *models.Executor) error {
	changes := a.getExecutorChanges(oldExecutor, newExecutor)

	return a.Log(ctx, OpUpdateExecutor, ResourceExecutor,
		WithResourceID(executorID),
		WithDetailJSON(map[string]interface{}{
			"executor_id": executorID,
			"changes":     changes,
		}),
	)
}

func (a *Auditor) LogConfigUpdate(ctx context.Context, configKey string, oldValue, newValue interface{}) error {
	return a.Log(ctx, OpUpdateConfig, ResourceConfig,
		WithDetail(fmt.Sprintf("修改配置 %s: %v -> %v", configKey, oldValue, newValue)),
	)
}

func (a *Auditor) LogLogin(ctx context.Context, userID, username, ip string) error {
	return a.Log(ctx, OpLogin, ResourceUser,
		WithResourceID(userID),
		WithIP(ip),
		WithDetail(fmt.Sprintf("用户登录: %s", username)),
	)
}

func (a *Auditor) LogLogout(ctx context.Context, userID, username, ip string) error {
	return a.Log(ctx, OpLogout, ResourceUser,
		WithResourceID(userID),
		WithIP(ip),
		WithDetail(fmt.Sprintf("用户登出: %s", username)),
	)
}

func (a *Auditor) IsSensitiveOperation(operation string) (SensitiveOperation, bool) {
	so, ok := sensitiveOperations[operation]
	return so, ok
}

func (a *Auditor) ListLogs(userID string, pagination *models.Pagination) ([]models.AuditLog, error) {
	return a.db.ListAuditLogs(userID, pagination)
}

func (a *Auditor) getTaskChanges(oldTask, newTask *models.Task) map[string]interface{} {
	changes := make(map[string]interface{})

	if oldTask.Name != newTask.Name {
		changes["name"] = map[string]string{"old": oldTask.Name, "new": newTask.Name}
	}
	if oldTask.Description != newTask.Description {
		changes["description"] = map[string]string{"old": oldTask.Description, "new": newTask.Description}
	}
	if oldTask.CronExpr != newTask.CronExpr {
		changes["cron_expr"] = map[string]string{"old": oldTask.CronExpr, "new": newTask.CronExpr}
	}
	if oldTask.Command != newTask.Command {
		changes["command"] = map[string]string{"old": oldTask.Command, "new": newTask.Command}
	}
	if oldTask.Timeout != newTask.Timeout {
		changes["timeout"] = map[string]int{"old": oldTask.Timeout, "new": newTask.Timeout}
	}
	if oldTask.Priority != newTask.Priority {
		changes["priority"] = map[string]int{"old": oldTask.Priority, "new": newTask.Priority}
	}
	if oldTask.DispatchStrategy != newTask.DispatchStrategy {
		changes["dispatch_strategy"] = map[string]models.DispatchStrategy{
			"old": oldTask.DispatchStrategy,
			"new": newTask.DispatchStrategy,
		}
	}
	if oldTask.RetryStrategy != newTask.RetryStrategy {
		changes["retry_strategy"] = map[string]models.RetryStrategy{
			"old": oldTask.RetryStrategy,
			"new": newTask.RetryStrategy,
		}
	}
	if oldTask.MaxRetry != newTask.MaxRetry {
		changes["max_retry"] = map[string]int{"old": oldTask.MaxRetry, "new": newTask.MaxRetry}
	}

	return changes
}

func (a *Auditor) getExecutorChanges(oldExecutor, newExecutor *models.Executor) map[string]interface{} {
	changes := make(map[string]interface{})

	if oldExecutor.Name != newExecutor.Name {
		changes["name"] = map[string]string{"old": oldExecutor.Name, "new": newExecutor.Name}
	}
	if oldExecutor.Description != newExecutor.Description {
		changes["description"] = map[string]string{"old": oldExecutor.Description, "new": newExecutor.Description}
	}
	if oldExecutor.Address != newExecutor.Address {
		changes["address"] = map[string]string{"old": oldExecutor.Address, "new": newExecutor.Address}
	}
	if oldExecutor.Weight != newExecutor.Weight {
		changes["weight"] = map[string]int{"old": oldExecutor.Weight, "new": newExecutor.Weight}
	}
	if oldExecutor.MaxTasks != newExecutor.MaxTasks {
		changes["max_tasks"] = map[string]int{"old": oldExecutor.MaxTasks, "new": newExecutor.MaxTasks}
	}

	return changes
}

func WithAuditContext(ctx context.Context, userID, username, ip string, confirmed bool) context.Context {
	return context.WithValue(ctx, "audit", AuditContext{
		UserID:    userID,
		Username:  username,
		IPAddress: ip,
		Confirm:   confirmed,
	})
}

func GetAuditContext(ctx context.Context) (AuditContext, bool) {
	ac, ok := ctx.Value("audit").(AuditContext)
	return ac, ok
}
