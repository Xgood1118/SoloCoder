package api

import (
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/scheduler/go-auto-scheduler/internal/audit"
	"github.com/scheduler/go-auto-scheduler/internal/cron"
	"github.com/scheduler/go-auto-scheduler/internal/executor"
	"github.com/scheduler/go-auto-scheduler/internal/logger"
	"github.com/scheduler/go-auto-scheduler/internal/middleware"
	"github.com/scheduler/go-auto-scheduler/internal/models"
	"github.com/scheduler/go-auto-scheduler/internal/scheduler"
	"github.com/scheduler/go-auto-scheduler/internal/storage"
)

type APIHandler struct {
	db             *storage.Database
	scheduler      *scheduler.Scheduler
	cronParser     *cron.Parser
	auditor        *audit.Auditor
	asyncLogger    *logger.AsyncLogger
	authMiddleware *middleware.AuthMiddleware
	executorServer *executor.ExecutorServer
	upgrader       websocket.Upgrader
}

func NewAPIHandler(
	db *storage.Database,
	sched *scheduler.Scheduler,
	auditor *audit.Auditor,
	asyncLogger *logger.AsyncLogger,
	authMiddleware *middleware.AuthMiddleware,
	executorServer *executor.ExecutorServer,
) *APIHandler {
	return &APIHandler{
		db:             db,
		scheduler:      sched,
		cronParser:     cron.NewParser(),
		auditor:        auditor,
		asyncLogger:    asyncLogger,
		authMiddleware: authMiddleware,
		executorServer: executorServer,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (h *APIHandler) RegisterRoutes(r *gin.Engine) {
	r.Use(h.authMiddleware.CORSMiddleware())

	api := r.Group("/api/v1")
	{
		api.POST("/auth/login", h.authMiddleware.Login)

		auth := api.Group("")
		auth.Use(h.authMiddleware.AuthRequired())
		{
			auth.POST("/auth/logout", h.authMiddleware.Logout)

			cron := auth.Group("/cron")
			{
				cron.POST("/preview", h.PreviewCron)
				cron.POST("/validate", h.ValidateCron)
			}

			tasks := auth.Group("/tasks")
			{
				tasks.GET("", h.ListTasks)
				tasks.POST("", h.CreateTask)
				tasks.GET("/:id", h.authMiddleware.TaskAccessRequired(), h.GetTask)
				tasks.PUT("/:id", h.authMiddleware.TaskAccessRequired(), h.UpdateTask)
				tasks.DELETE("/:id", h.authMiddleware.TaskAccessRequired(), h.DeleteTask)
				tasks.PATCH("/:id/cron", h.authMiddleware.TaskAccessRequired(), h.UpdateTaskCron)
				tasks.POST("/:id/pause", h.authMiddleware.TaskAccessRequired(), h.PauseTask)
				tasks.POST("/:id/resume", h.authMiddleware.TaskAccessRequired(), h.ResumeTask)
				tasks.POST("/:id/run", h.authMiddleware.TaskAccessRequired(), h.RunTaskNow)
				tasks.GET("/:id/executions", h.authMiddleware.TaskAccessRequired(), h.ListTaskExecutions)
				tasks.GET("/:id/assignment", h.authMiddleware.TaskAccessRequired(), h.GetTaskAssignment)
			}

			executors := auth.Group("/executors")
			{
				executors.GET("", h.ListExecutors)
				executors.POST("", h.CreateExecutor)
				executors.GET("/:id", h.authMiddleware.ExecutorAccessRequired(), h.GetExecutor)
				executors.PUT("/:id", h.authMiddleware.ExecutorAccessRequired(), h.UpdateExecutor)
				executors.DELETE("/:id", h.authMiddleware.ExecutorAccessRequired(), h.DeleteExecutor)
				executors.GET("/ws/register", h.RegisterExecutorWS)
				executors.POST("/:id/heartbeat", h.HandleHeartbeat)
			}

			logs := auth.Group("/logs")
			{
				logs.Use(h.authMiddleware.TaskLogAccessRequired())
				logs.GET("", h.QueryLogs)
				logs.GET("/:task_id/download", h.DownloadLogs)
				logs.GET("/:task_id/tail", h.TailLogs)
			}

			audit := auth.Group("/audit")
			{
				audit.GET("", h.ListAuditLogs)
			}

			executions := auth.Group("/executions")
			{
				executions.GET("/:id", h.GetExecution)
				executions.POST("/:id/report", h.ReportExecutionResult)
			}
		}
	}
}

type CreateTaskRequest struct {
	Name             string                    `json:"name" binding:"required"`
	Description      string                    `json:"description"`
	CronExpr         string                    `json:"cron_expr" binding:"required"`
	TaskType         models.TaskType           `json:"task_type" binding:"required"`
	Command          string                    `json:"command" binding:"required"`
	Timeout          int                       `json:"timeout"`
	Priority         int                       `json:"priority"`
	DispatchStrategy models.DispatchStrategy   `json:"dispatch_strategy"`
	RetryStrategy    models.RetryStrategy      `json:"retry_strategy"`
	MaxRetry         int                       `json:"max_retry"`
	ExecutorID       string                    `json:"executor_id"`
}

func (h *APIHandler) CreateTask(c *gin.Context) {
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	normalized, err := h.cronParser.ConvertTo6(req.CronExpr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cron expression: " + err.Error()})
		return
	}

	if req.Timeout <= 0 {
		req.Timeout = 300
	}
	if req.MaxRetry <= 0 {
		req.MaxRetry = 3
	}
	if req.DispatchStrategy == "" {
		req.DispatchStrategy = models.DispatchRoundRobin
	}
	if req.RetryStrategy == "" {
		req.RetryStrategy = models.RetryNextSchedule
	}

	userID := c.GetString("user_id")

	task := &models.Task{
		Name:             req.Name,
		Description:      req.Description,
		CronExpr:         normalized,
		CronExpr5:        req.CronExpr,
		TaskType:         req.TaskType,
		Command:          req.Command,
		Timeout:          req.Timeout,
		Priority:         req.Priority,
		Status:           models.TaskStatusPending,
		DispatchStrategy: req.DispatchStrategy,
		RetryStrategy:    req.RetryStrategy,
		MaxRetry:         req.MaxRetry,
		UserID:           userID,
		ExecutorID:       req.ExecutorID,
	}

	if err := h.db.CreateTask(task); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	if err := h.auditor.LogTaskCreate(c.Request.Context(), task); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to log audit: " + err.Error()})
		return
	}

	if err := h.scheduler.AddTask(task); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to schedule task"})
		return
	}

	c.JSON(http.StatusCreated, task)
}

func (h *APIHandler) ListTasks(c *gin.Context) {
	userID := c.GetString("user_id")
	role := c.GetString("role")

	var pagination models.Pagination
	if err := c.ShouldBindQuery(&pagination); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if pagination.Page <= 0 {
		pagination.Page = 1
	}
	if pagination.PageSize <= 0 {
		pagination.PageSize = 20
	}

	queryUserID := userID
	if role == "admin" {
		queryUserID = ""
	}

	tasks, err := h.db.ListTasks(queryUserID, &pagination)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list tasks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  tasks,
		"total": pagination.Total,
		"page":  pagination.Page,
		"size":  pagination.PageSize,
	})
}

func (h *APIHandler) GetTask(c *gin.Context) {
	id := c.Param("id")
	task, err := h.db.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}
	c.JSON(http.StatusOK, task)
}

type UpdateTaskRequest struct {
	Name             string                    `json:"name"`
	Description      string                    `json:"description"`
	TaskType         models.TaskType           `json:"task_type"`
	Command          string                    `json:"command"`
	Timeout          int                       `json:"timeout"`
	Priority         int                       `json:"priority"`
	DispatchStrategy models.DispatchStrategy   `json:"dispatch_strategy"`
	RetryStrategy    models.RetryStrategy      `json:"retry_strategy"`
	MaxRetry         int                       `json:"max_retry"`
}

func (h *APIHandler) UpdateTask(c *gin.Context) {
	id := c.Param("id")

	oldTask, err := h.db.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	newTask := *oldTask
	if req.Name != "" {
		newTask.Name = req.Name
	}
	if req.Description != "" {
		newTask.Description = req.Description
	}
	if req.TaskType != "" {
		newTask.TaskType = req.TaskType
	}
	if req.Command != "" {
		newTask.Command = req.Command
	}
	if req.Timeout > 0 {
		newTask.Timeout = req.Timeout
	}
	if req.Priority != 0 {
		newTask.Priority = req.Priority
	}
	if req.DispatchStrategy != "" {
		newTask.DispatchStrategy = req.DispatchStrategy
	}
	if req.RetryStrategy != "" {
		newTask.RetryStrategy = req.RetryStrategy
	}
	if req.MaxRetry > 0 {
		newTask.MaxRetry = req.MaxRetry
	}

	if err := h.db.UpdateTask(&newTask); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task"})
		return
	}

	if err := h.auditor.LogTaskUpdate(c.Request.Context(), id, oldTask, &newTask); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to log audit: " + err.Error()})
		return
	}

	if !newTask.IsPaused && !newTask.IsDeleted {
		h.scheduler.UpdateTask(&newTask)
	}

	c.JSON(http.StatusOK, newTask)
}

type UpdateTaskCronRequest struct {
	CronExpr string `json:"cron_expr" binding:"required"`
}

func (h *APIHandler) UpdateTaskCron(c *gin.Context) {
	id := c.Param("id")

	task, err := h.db.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	var req UpdateTaskCronRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	normalized, err := h.cronParser.ConvertTo6(req.CronExpr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid cron expression: " + err.Error()})
		return
	}

	oldCron := task.CronExpr5
	if oldCron == "" {
		oldCron = task.CronExpr
	}

	if err := h.db.UpdateTaskCron(id, normalized, req.CronExpr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update cron"})
		return
	}

	if err := h.auditor.LogTaskCronUpdate(c.Request.Context(), id, oldCron, req.CronExpr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to log audit: " + err.Error()})
		return
	}

	task.CronExpr = normalized
	task.CronExpr5 = req.CronExpr
	if !task.IsPaused && !task.IsDeleted {
		h.scheduler.UpdateTask(task)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Cron expression updated",
		"cron_expr":  normalized,
		"cron_expr5": req.CronExpr,
	})
}

func (h *APIHandler) DeleteTask(c *gin.Context) {
	id := c.Param("id")

	task, err := h.db.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if err := h.auditor.LogTaskDelete(c.Request.Context(), id, task.Name); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	h.scheduler.RemoveTask(id)

	if err := h.db.DeleteTask(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task deleted successfully"})
}

func (h *APIHandler) PauseTask(c *gin.Context) {
	id := c.Param("id")

	task, err := h.db.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	task.IsPaused = true
	task.Status = models.TaskStatusPaused

	if err := h.db.UpdateTask(task); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to pause task"})
		return
	}

	h.scheduler.PauseTask(id)

	if err := h.auditor.LogTaskPause(c.Request.Context(), id, task.Name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to log audit"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task paused successfully"})
}

func (h *APIHandler) ResumeTask(c *gin.Context) {
	id := c.Param("id")

	task, err := h.db.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	task.IsPaused = false
	task.Status = models.TaskStatusPending

	if err := h.db.UpdateTask(task); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resume task"})
		return
	}

	h.scheduler.ResumeTask(task)

	if err := h.auditor.LogTaskResume(c.Request.Context(), id, task.Name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to log audit"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Task resumed successfully"})
}

func (h *APIHandler) RunTaskNow(c *gin.Context) {
	id := c.Param("id")

	task, err := h.db.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	executors, err := h.db.ListOnlineExecutors(task.TaskType)
	if err != nil || len(executors) == 0 {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "No available executors"})
		return
	}

	h.scheduler.AddTask(task)

	c.JSON(http.StatusAccepted, gin.H{"message": "Task queued for execution"})
}

func (h *APIHandler) ListTaskExecutions(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetString("user_id")
	role := c.GetString("role")

	var pagination models.Pagination
	if err := c.ShouldBindQuery(&pagination); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if pagination.Page <= 0 {
		pagination.Page = 1
	}
	if pagination.PageSize <= 0 {
		pagination.PageSize = 20
	}

	queryUserID := userID
	if role == "admin" {
		queryUserID = ""
	}

	executions, err := h.db.ListTaskExecutions(id, queryUserID, &pagination)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list executions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  executions,
		"total": pagination.Total,
		"page":  pagination.Page,
		"size":  pagination.PageSize,
	})
}

func (h *APIHandler) GetTaskAssignment(c *gin.Context) {
	id := c.Param("id")

	assignment, err := h.db.GetTaskAssignment(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assignment not found"})
		return
	}

	c.JSON(http.StatusOK, assignment)
}

func (h *APIHandler) PreviewCron(c *gin.Context) {
	var req models.CronPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Count <= 0 {
		req.Count = 5
	}

	result := h.cronParser.Preview(req.CronExpr, req.Count)
	c.JSON(http.StatusOK, result)
}

func (h *APIHandler) ValidateCron(c *gin.Context) {
	var req struct {
		CronExpr string `json:"cron_expr" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.cronParser.ValidateDetailed(req.CronExpr); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"valid": false,
			"error": err.Error(),
		})
		return
	}

	normalized, _ := h.cronParser.ConvertTo6(req.CronExpr)
	c.JSON(http.StatusOK, gin.H{
		"valid":      true,
		"normalized": normalized,
	})
}

type CreateExecutorRequest struct {
	Name        string           `json:"name" binding:"required"`
	Description string           `json:"description"`
	ExecutorType models.TaskType `json:"executor_type" binding:"required"`
	Address     string           `json:"address" binding:"required"`
	AuthToken   string           `json:"auth_token"`
	Weight      int              `json:"weight"`
	MaxTasks    int              `json:"max_tasks"`
	IsBackup    bool             `json:"is_backup"`
	PrimaryID   string           `json:"primary_id"`
}

func (h *APIHandler) CreateExecutor(c *gin.Context) {
	var req CreateExecutorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Weight <= 0 {
		req.Weight = 1
	}
	if req.MaxTasks <= 0 {
		req.MaxTasks = 10
	}

	userID := c.GetString("user_id")

	executor := &models.Executor{
		Name:         req.Name,
		Description:  req.Description,
		ExecutorType: req.ExecutorType,
		Address:      req.Address,
		AuthToken:    req.AuthToken,
		Weight:       req.Weight,
		MaxTasks:     req.MaxTasks,
		Status:       models.ExecutorStatusOffline,
		UserID:       userID,
		IsBackup:     req.IsBackup,
		PrimaryID:    req.PrimaryID,
	}

	if err := h.db.CreateExecutor(executor); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create executor"})
		return
	}

	if err := h.auditor.LogExecutorCreate(c.Request.Context(), executor); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to log audit"})
		return
	}

	c.JSON(http.StatusCreated, executor)
}

func (h *APIHandler) ListExecutors(c *gin.Context) {
	userID := c.GetString("user_id")
	role := c.GetString("role")

	var pagination models.Pagination
	if err := c.ShouldBindQuery(&pagination); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if pagination.Page <= 0 {
		pagination.Page = 1
	}
	if pagination.PageSize <= 0 {
		pagination.PageSize = 20
	}

	queryUserID := userID
	if role == "admin" {
		queryUserID = ""
	}

	executors, err := h.db.ListExecutors(queryUserID, &pagination)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list executors"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  executors,
		"total": pagination.Total,
		"page":  pagination.Page,
		"size":  pagination.PageSize,
	})
}

func (h *APIHandler) GetExecutor(c *gin.Context) {
	id := c.Param("id")
	executor, err := h.db.GetExecutor(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Executor not found"})
		return
	}
	c.JSON(http.StatusOK, executor)
}

type UpdateExecutorRequest struct {
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Address     string           `json:"address"`
	AuthToken   string           `json:"auth_token"`
	Weight      int              `json:"weight"`
	MaxTasks    int              `json:"max_tasks"`
}

func (h *APIHandler) UpdateExecutor(c *gin.Context) {
	id := c.Param("id")

	oldExecutor, err := h.db.GetExecutor(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Executor not found"})
		return
	}

	var req UpdateExecutorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	newExecutor := *oldExecutor
	if req.Name != "" {
		newExecutor.Name = req.Name
	}
	if req.Description != "" {
		newExecutor.Description = req.Description
	}
	if req.Address != "" {
		newExecutor.Address = req.Address
	}
	if req.AuthToken != "" {
		newExecutor.AuthToken = req.AuthToken
	}
	if req.Weight > 0 {
		newExecutor.Weight = req.Weight
	}
	if req.MaxTasks > 0 {
		newExecutor.MaxTasks = req.MaxTasks
	}

	if err := h.auditor.LogExecutorUpdate(c.Request.Context(), id, oldExecutor, &newExecutor); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.UpdateExecutor(&newExecutor); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update executor"})
		return
	}

	c.JSON(http.StatusOK, newExecutor)
}

func (h *APIHandler) DeleteExecutor(c *gin.Context) {
	id := c.Param("id")

	executor, err := h.db.GetExecutor(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Executor not found"})
		return
	}

	if err := h.auditor.LogExecutorDelete(c.Request.Context(), id, executor.Name); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.DeleteExecutor(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete executor"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Executor deleted successfully"})
}

func (h *APIHandler) RegisterExecutorWS(c *gin.Context) {
	executorID := c.Query("executor_id")
	if executorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "executor_id is required"})
		return
	}

	_, err := h.db.GetExecutor(executorID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Executor not found"})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	h.executorServer.RegisterExecutor(executorID, conn)

	defer func() {
		h.executorServer.UnregisterExecutor(executorID)
		conn.Close()
	}()

	for {
		var heartbeat models.Heartbeat
		if err := conn.ReadJSON(&heartbeat); err != nil {
			break
		}

		if err := h.executorServer.HandleHeartbeat(executorID, &heartbeat); err != nil {
			break
		}
	}
}

func (h *APIHandler) HandleHeartbeat(c *gin.Context) {
	id := c.Param("id")

	var heartbeat models.Heartbeat
	if err := c.ShouldBindJSON(&heartbeat); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.executorServer.HandleHeartbeat(id, &heartbeat); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process heartbeat"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *APIHandler) QueryLogs(c *gin.Context) {
	taskID := c.Query("task_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))

	logs, pagination, err := h.asyncLogger.GetTaskLogs(taskID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": pagination.Total,
		"page":  pagination.Page,
		"size":  pagination.PageSize,
	})
}

func (h *APIHandler) DownloadLogs(c *gin.Context) {
	taskID := c.Param("task_id")

	filePath, err := h.asyncLogger.DownloadTaskLogs(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare log file"})
		return
	}

	defer func() {
		if !strings.Contains(filePath, "task_"+taskID+".log") {
			os.Remove(filePath)
		}
	}()

	fileInfo, err := os.Stat(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Log file not found"})
		return
	}

	c.Header("Content-Disposition", "attachment; filename=task_"+taskID+"_logs.log")
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Content-Length", strconv.FormatInt(fileInfo.Size(), 10))

	c.File(filePath)
}

func (h *APIHandler) TailLogs(c *gin.Context) {
	taskID := c.Param("task_id")
	lines, _ := strconv.Atoi(c.DefaultQuery("lines", "100"))

	if lines <= 0 {
		lines = 100
	}
	if lines > 1000 {
		lines = 1000
	}

	logLines, err := h.asyncLogger.Tail(taskID, lines)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"lines": logLines,
		"count": len(logLines),
	})
}

func (h *APIHandler) ListAuditLogs(c *gin.Context) {
	userID := c.GetString("user_id")
	role := c.GetString("role")

	var pagination models.Pagination
	if err := c.ShouldBindQuery(&pagination); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if pagination.Page <= 0 {
		pagination.Page = 1
	}
	if pagination.PageSize <= 0 {
		pagination.PageSize = 20
	}

	queryUserID := userID
	if role == "admin" {
		queryUserID = ""
	}

	logs, err := h.auditor.ListLogs(queryUserID, &pagination)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list audit logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": pagination.Total,
		"page":  pagination.Page,
		"size":  pagination.PageSize,
	})
}

func (h *APIHandler) GetExecution(c *gin.Context) {
	id := c.Param("id")

	execution, err := h.db.GetTaskExecution(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Execution not found"})
		return
	}

	userID := c.GetString("user_id")
	role := c.GetString("role")

	if role != "admin" {
		task, err := h.db.GetTask(execution.TaskID)
		if err != nil || task.UserID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
	}

	c.JSON(http.StatusOK, execution)
}

type ExecutionReportRequest struct {
	TaskID    string    `json:"task_id" binding:"required"`
	Status    string    `json:"status" binding:"required"`
	ExitCode  int       `json:"exit_code"`
	Stdout    string    `json:"stdout"`
	Stderr    string    `json:"stderr"`
	EndTime   time.Time `json:"end_time"`
	IsTimeout bool      `json:"is_timeout"`
}

func (h *APIHandler) ReportExecutionResult(c *gin.Context) {
	executionID := c.Param("id")

	var req ExecutionReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	execution, err := h.db.GetTaskExecution(executionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Execution not found"})
		return
	}

	execution.Status = models.TaskStatus(req.Status)
	execution.ExitCode = &req.ExitCode
	execution.Stdout = req.Stdout
	execution.Stderr = req.Stderr
	execution.EndTime = &req.EndTime
	execution.IsTimeout = req.IsTimeout

	if err := h.db.UpdateTaskExecution(execution); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update execution"})
		return
	}

	if err := h.db.DecrementExecutorTasks(execution.ExecutorID); err != nil {
	}

	h.asyncLogger.LogStdout(executionID, execution.TaskID, req.Stdout)
	if req.Stderr != "" {
		h.asyncLogger.LogStderr(executionID, execution.TaskID, req.Stderr)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Result reported successfully"})
}
