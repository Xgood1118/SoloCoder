package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/solocoder/taskscheduler/internal/models"
	"github.com/solocoder/taskscheduler/internal/scheduler"
	"gorm.io/gorm"
)

type APIHandler struct {
	scheduler *scheduler.Scheduler
}

type APIServer struct {
	handler *APIHandler
	server  *http.Server
	engine  *gin.Engine
	addr    string
}

func NewAPIHandler(s *scheduler.Scheduler) *APIHandler {
	return &APIHandler{
		scheduler: s,
	}
}

func NewAPIServer(s *scheduler.Scheduler, addr string) *APIServer {
	handler := NewAPIHandler(s)
	engine := gin.Default()
	handler.RegisterRoutes(engine)

	return &APIServer{
		handler: handler,
		engine:  engine,
		addr:    addr,
		server: &http.Server{
			Addr:    addr,
			Handler: engine,
		},
	}
}

func (s *APIServer) Start(ctx context.Context) error {
	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			panic(err)
		}
	}()
	return nil
}

func (s *APIServer) Stop(ctx context.Context) error {
	shutdownCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return s.server.Shutdown(shutdownCtx)
}

func (h *APIHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		jobs := api.Group("/jobs")
		{
			jobs.POST("", h.CreateJob)
			jobs.GET("", h.ListJobs)
			jobs.GET("/:id", h.GetJob)
			jobs.PUT("/:id", h.UpdateJob)
			jobs.DELETE("/:id", h.DeleteJob)
			jobs.POST("/:id/trigger", h.TriggerJob)
			jobs.GET("/:id/executions", h.ListJobExecutions)
		}

		deadLetters := api.Group("/dead-letters")
		{
			deadLetters.GET("", h.ListDeadLetters)
			deadLetters.POST("/:id/resubmit", h.ResubmitDeadLetter)
			deadLetters.POST("/:id/process", h.ProcessDeadLetter)
		}

		api.GET("/stats", h.GetStats)
	}
}

type CreateJobRequest struct {
	Name         string            `json:"name" binding:"required"`
	Type         string            `json:"type" binding:"required"`
	CronExpr     string            `json:"cron_expr"`
	CronMode     models.CronMode   `json:"cron_mode"`
	Payload      string            `json:"payload"`
	Dependencies []string          `json:"dependencies"`
	MaxRetries   int               `json:"max_retries"`
}

type CreateJobResponse struct {
	JobID           string `json:"job_id"`
	Status          string `json:"status"`
	NextExecuteTime string `json:"next_execute_time"`
}

type JobResponse struct {
	*models.Job
}

type JobListResponse struct {
	Total int64          `json:"total"`
	Jobs  []*models.Job  `json:"jobs"`
}

type ExecutionListResponse struct {
	Total      int64                  `json:"total"`
	Executions []*models.JobExecution `json:"executions"`
}

type DeadLetterListResponse struct {
	Total       int64                   `json:"total"`
	DeadLetters []*models.DeadLetterJob `json:"dead_letters"`
}

type ProcessDeadLetterRequest struct {
	ProcessedBy string `json:"processed_by"`
	Note        string `json:"note"`
}

func (h *APIHandler) CreateJob(c *gin.Context) {
	var req CreateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	job := &models.Job{
		Name:       req.Name,
		Type:       req.Type,
		CronExpr:   req.CronExpr,
		CronMode:   req.CronMode,
		Payload:    req.Payload,
		MaxRetries: req.MaxRetries,
	}

	if len(req.Dependencies) > 0 {
		job.Dependencies = strings.Join(req.Dependencies, ",")
	}

	if job.CronMode == "" {
		job.CronMode = models.CronModeStandard
	}

	if err := h.scheduler.ScheduleJob(c.Request.Context(), job); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, CreateJobResponse{
		JobID:           job.ID,
		Status:          string(job.Status),
		NextExecuteTime: job.NextExecuteTime.Format("2006-01-02T15:04:05Z07:00"),
	})
}

func (h *APIHandler) ListJobs(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	jobs, total, err := h.scheduler.ListJobsWithFilter(c.Request.Context(), status, offset, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, JobListResponse{
		Total: total,
		Jobs:  jobs,
	})
}

func (h *APIHandler) GetJob(c *gin.Context) {
	id := c.Param("id")

	job, err := h.scheduler.GetJob(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, JobResponse{Job: job})
}

func (h *APIHandler) UpdateJob(c *gin.Context) {
	id := c.Param("id")

	existingJob, err := h.scheduler.GetJob(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var req CreateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	existingJob.Name = req.Name
	existingJob.Type = req.Type
	existingJob.CronExpr = req.CronExpr
	if req.CronMode != "" {
		existingJob.CronMode = req.CronMode
	}
	existingJob.Payload = req.Payload
	existingJob.MaxRetries = req.MaxRetries

	if len(req.Dependencies) > 0 {
		existingJob.Dependencies = strings.Join(req.Dependencies, ",")
	}

	if err := h.scheduler.UpdateJob(c.Request.Context(), existingJob); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, JobResponse{Job: existingJob})
}

func (h *APIHandler) DeleteJob(c *gin.Context) {
	id := c.Param("id")

	if err := h.scheduler.DeleteJob(c.Request.Context(), id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "job deleted successfully"})
}

func (h *APIHandler) TriggerJob(c *gin.Context) {
	id := c.Param("id")

	if err := h.scheduler.TriggerJob(c.Request.Context(), id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "job triggered successfully"})
}

func (h *APIHandler) ListJobExecutions(c *gin.Context) {
	jobID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	executions, total, err := h.scheduler.ListExecutions(c.Request.Context(), jobID, offset, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, ExecutionListResponse{
		Total:      total,
		Executions: executions,
	})
}

func (h *APIHandler) ListDeadLetters(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	deadLetters, total, err := h.scheduler.ListDeadLetters(c.Request.Context(), offset, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, DeadLetterListResponse{
		Total:       total,
		DeadLetters: deadLetters,
	})
}

func (h *APIHandler) ResubmitDeadLetter(c *gin.Context) {
	id := c.Param("id")

	if _, err := h.scheduler.GetDeadLetterJob(c.Request.Context(), id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dead letter job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := h.scheduler.ResubmitDeadLetter(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "dead letter job resubmitted successfully"})
}

func (h *APIHandler) ProcessDeadLetter(c *gin.Context) {
	id := c.Param("id")

	var req ProcessDeadLetterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if _, err := h.scheduler.GetDeadLetterJob(c.Request.Context(), id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "dead letter job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := h.scheduler.ProcessDeadLetter(c.Request.Context(), id, req.ProcessedBy, req.Note); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "dead letter job processed successfully"})
}

func (h *APIHandler) GetStats(c *gin.Context) {
	stats, err := h.scheduler.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
