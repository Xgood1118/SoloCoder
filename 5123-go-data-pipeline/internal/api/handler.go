package api

import (
	"errors"
	"log-pipeline/internal/aggregation"
	"log-pipeline/internal/alert"
	"log-pipeline/internal/datasource"
	"log-pipeline/internal/models"
	"log-pipeline/internal/monitor"
	"log-pipeline/internal/pipeline"
	"log-pipeline/internal/store"
	"log-pipeline/pkg/utils"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	dsManager        *datasource.Manager
	pipelineManager  *pipeline.Manager
	alertEngine      *alert.Engine
	aggregationEngine *aggregation.Engine
	monitor          *monitor.Monitor
	dsStore          *store.DatasourceStore
	pipelineStore    *store.PipelineStore
}

func NewHandler(
	dsManager *datasource.Manager,
	pipelineManager *pipeline.Manager,
	alertEngine *alert.Engine,
	aggregationEngine *aggregation.Engine,
	monitor *monitor.Monitor,
) *Handler {
	return &Handler{
		dsManager:         dsManager,
		pipelineManager:   pipelineManager,
		alertEngine:       alertEngine,
		aggregationEngine: aggregationEngine,
		monitor:           monitor,
		dsStore:           store.NewDatasourceStore(),
		pipelineStore:     store.NewPipelineStore(),
	}
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func (h *Handler) error(c *gin.Context, code int, message string) {
	c.JSON(code, Response{
		Code:    code,
		Message: message,
	})
}

func (h *Handler) handleError(c *gin.Context, err error) {
	if errors.Is(err, store.ErrVersionConflict) {
		h.error(c, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, store.ErrNotFound) {
		h.error(c, http.StatusNotFound, err.Error())
		return
	}
	h.error(c, http.StatusInternalServerError, err.Error())
}

func (h *Handler) ListDatasources(c *gin.Context) {
	datasources, err := h.dsStore.List()
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, datasources)
}

func (h *Handler) GetDatasource(c *gin.Context) {
	id := c.Param("id")
	ds, err := h.dsStore.GetByID(id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, ds)
}

type CreateDatasourceRequest struct {
	Name       string                 `json:"name" binding:"required"`
	Type       models.DatasourceType  `json:"type" binding:"required"`
	Config     map[string]interface{} `json:"config" binding:"required"`
	PipelineID string                 `json:"pipeline_id"`
}

func (h *Handler) CreateDatasource(c *gin.Context) {
	var req CreateDatasourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, err.Error())
		return
	}

	ds := &models.Datasource{
		Name:       req.Name,
		Type:       req.Type,
		Config:     utils.ToJSON(req.Config),
		PipelineID: req.PipelineID,
		Status:     models.DatasourceStatusPaused,
	}

	if err := h.dsStore.Create(ds); err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, ds)
}

type UpdateDatasourceRequest struct {
	Name       string                 `json:"name"`
	Type       models.DatasourceType  `json:"type"`
	Config     map[string]interface{} `json:"config"`
	PipelineID string                 `json:"pipeline_id"`
	Version    int                    `json:"version" binding:"required"`
}

func (h *Handler) UpdateDatasource(c *gin.Context) {
	id := c.Param("id")

	var req UpdateDatasourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, err.Error())
		return
	}

	ds, err := h.dsStore.GetByID(id)
	if err != nil {
		h.handleError(c, err)
		return
	}

	if req.Name != "" {
		ds.Name = req.Name
	}
	if req.Type != "" {
		ds.Type = req.Type
	}
	if req.Config != nil {
		ds.Config = utils.ToJSON(req.Config)
	}
	if req.PipelineID != "" {
		ds.PipelineID = req.PipelineID
	}
	ds.Version = req.Version

	if err := h.dsStore.Update(ds); err != nil {
		h.handleError(c, err)
		return
	}

	if ds.Status == models.DatasourceStatusRunning {
		h.dsManager.ReloadDatasource(id)
	}

	h.success(c, ds)
}

func (h *Handler) DeleteDatasource(c *gin.Context) {
	id := c.Param("id")

	if err := h.dsManager.StopDatasource(id); err == nil {
	}

	if err := h.dsStore.Delete(id); err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, nil)
}

func (h *Handler) StartDatasource(c *gin.Context) {
	id := c.Param("id")
	if err := h.dsManager.StartDatasource(id); err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, nil)
}

func (h *Handler) StopDatasource(c *gin.Context) {
	id := c.Param("id")
	if err := h.dsManager.StopDatasource(id); err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, nil)
}

func (h *Handler) GetDatasourceMetrics(c *gin.Context) {
	id := c.Param("id")
	metrics := h.monitor.GetDatasourceMetrics(id)
	h.success(c, metrics)
}

func (h *Handler) ReceiveLog(c *gin.Context) {
	apiKey := c.GetHeader("X-API-Key")
	dsID := c.Param("id")

	httpDs := h.dsManager.GetHTTPDatasource(dsID)
	if httpDs == nil {
		h.error(c, http.StatusNotFound, "HTTP datasource not found")
		return
	}

	if httpDs.APIKey() != "" && httpDs.APIKey() != apiKey {
		h.error(c, http.StatusUnauthorized, "Invalid API key")
		return
	}

	var entries []*models.LogEntry
	if err := c.ShouldBindJSON(&entries); err != nil {
		var singleEntry models.LogEntry
		if err := c.ShouldBindJSON(&singleEntry); err != nil {
			h.error(c, http.StatusBadRequest, "Invalid log format")
			return
		}
		entries = []*models.LogEntry{&singleEntry}
	}

	if err := httpDs.Push(entries); err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, map[string]int{"received": len(entries)})
}

func (h *Handler) ListPipelines(c *gin.Context) {
	pipelines, err := h.pipelineStore.List()
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, pipelines)
}

func (h *Handler) GetPipeline(c *gin.Context) {
	id := c.Param("id")
	p, err := h.pipelineStore.GetByID(id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, p)
}

type CreatePipelineRequest struct {
	Name        string                         `json:"name" binding:"required"`
	Description string                         `json:"description"`
	Config      *models.PipelineConfigData      `json:"config" binding:"required"`
}

func (h *Handler) CreatePipeline(c *gin.Context) {
	var req CreatePipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, err.Error())
		return
	}

	p := &models.Pipeline{
		Name:        req.Name,
		Description: req.Description,
		Config:      utils.ToJSON(req.Config),
		Status:      models.PipelineStatusPaused,
	}

	if err := h.pipelineStore.Create(p); err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, p)
}

type UpdatePipelineRequest struct {
	Name        string                    `json:"name"`
	Description string                    `json:"description"`
	Config      *models.PipelineConfigData `json:"config"`
	Version     int                       `json:"version" binding:"required"`
}

func (h *Handler) UpdatePipeline(c *gin.Context) {
	id := c.Param("id")

	var req UpdatePipelineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, err.Error())
		return
	}

	p, err := h.pipelineStore.GetByID(id)
	if err != nil {
		h.handleError(c, err)
		return
	}

	if req.Name != "" {
		p.Name = req.Name
	}
	if req.Description != "" {
		p.Description = req.Description
	}
	if req.Config != nil {
		p.Config = utils.ToJSON(req.Config)
	}
	p.Version = req.Version

	if err := h.pipelineStore.Update(p); err != nil {
		h.handleError(c, err)
		return
	}

	if p.Status == models.PipelineStatusRunning {
		h.pipelineManager.ReloadPipeline(id)
	}

	h.success(c, p)
}

func (h *Handler) DeletePipeline(c *gin.Context) {
	id := c.Param("id")

	if err := h.pipelineManager.StopPipeline(id); err == nil {
	}

	if err := h.pipelineStore.Delete(id); err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, nil)
}

func (h *Handler) StartPipeline(c *gin.Context) {
	id := c.Param("id")
	if err := h.pipelineManager.StartPipeline(id); err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, nil)
}

func (h *Handler) StopPipeline(c *gin.Context) {
	id := c.Param("id")
	if err := h.pipelineManager.StopPipeline(id); err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, nil)
}

func (h *Handler) GetPipelineMetrics(c *gin.Context) {
	id := c.Param("id")
	metrics := h.monitor.GetPipelineMetrics(id)
	h.success(c, metrics)
}

func (h *Handler) ListAlertRules(c *gin.Context) {
	rules, err := h.alertEngine.ListRules()
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, rules)
}

func (h *Handler) GetAlertRule(c *gin.Context) {
	id := c.Param("id")
	rule, err := h.alertEngine.GetRule(id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, rule)
}

type CreateAlertRuleRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	PipelineID  string                 `json:"pipeline_id" binding:"required"`
	Expression  string                 `json:"expression" binding:"required"`
	Window      string                 `json:"window" binding:"required"`
	Severity    models.AlertSeverity   `json:"severity"`
	Actions     []models.AlertAction   `json:"actions"`
}

func (h *Handler) CreateAlertRule(c *gin.Context) {
	var req CreateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, err.Error())
		return
	}

	_, threshold, err := h.alertEngine.ParseExpression(req.Expression)
	if err != nil {
		h.error(c, http.StatusBadRequest, "Invalid expression: "+err.Error())
		return
	}

	rule := &models.AlertRule{
		Name:        req.Name,
		Description: req.Description,
		PipelineID:  req.PipelineID,
		Expression:  req.Expression,
		Threshold:   threshold,
		Window:      req.Window,
		Severity:    req.Severity,
		Actions:     utils.ToJSON(req.Actions),
		Status:      models.AlertStatusActive,
	}

	if err := h.alertEngine.AddRule(rule); err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, rule)
}

type UpdateAlertRuleRequest struct {
	Name        string               `json:"name"`
	Description string               `json:"description"`
	Expression  string               `json:"expression"`
	Window      string               `json:"window"`
	Severity    models.AlertSeverity `json:"severity"`
	Actions     []models.AlertAction `json:"actions"`
	Status      models.AlertStatus   `json:"status"`
	Version     int                  `json:"version" binding:"required"`
}

func (h *Handler) UpdateAlertRule(c *gin.Context) {
	id := c.Param("id")

	var req UpdateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, err.Error())
		return
	}

	rule, err := h.alertEngine.GetRule(id)
	if err != nil {
		h.handleError(c, err)
		return
	}

	if req.Name != "" {
		rule.Name = req.Name
	}
	if req.Description != "" {
		rule.Description = req.Description
	}
	if req.Expression != "" {
		_, threshold, err := h.alertEngine.ParseExpression(req.Expression)
		if err != nil {
			h.error(c, http.StatusBadRequest, "Invalid expression: "+err.Error())
			return
		}
		rule.Expression = req.Expression
		rule.Threshold = threshold
	}
	if req.Window != "" {
		rule.Window = req.Window
	}
	if req.Severity != "" {
		rule.Severity = req.Severity
	}
	if req.Actions != nil {
		rule.Actions = utils.ToJSON(req.Actions)
	}
	if req.Status != "" {
		rule.Status = req.Status
	}
	rule.Version = req.Version

	if err := h.alertEngine.UpdateRule(rule); err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, rule)
}

func (h *Handler) DeleteAlertRule(c *gin.Context) {
	id := c.Param("id")
	if err := h.alertEngine.DeleteRule(id); err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, nil)
}

func (h *Handler) ListAlertHistory(c *gin.Context) {
	ruleID := c.Query("rule_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	history, err := h.alertEngine.ListHistory(ruleID, limit)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, history)
}

func (h *Handler) ListAggregationRules(c *gin.Context) {
	rules, err := h.aggregationEngine.ListRules()
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, rules)
}

type CreateAggregationRequest struct {
	Name          string                `json:"name" binding:"required"`
	PipelineID    string                `json:"pipeline_id" binding:"required"`
	MetricName    string                `json:"metric_name" binding:"required"`
	Type          models.AggregationType `json:"type" binding:"required"`
	Field         string                `json:"field"`
	Filter        string                `json:"filter"`
	Windows       string                `json:"windows" binding:"required"`
	GroupBy       string                `json:"group_by"`
	PercentileVal float64               `json:"percentile_val"`
}

func (h *Handler) CreateAggregationRule(c *gin.Context) {
	var req CreateAggregationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, err.Error())
		return
	}

	rule := &models.AggregationRule{
		Name:          req.Name,
		PipelineID:    req.PipelineID,
		MetricName:    req.MetricName,
		Type:          req.Type,
		Field:         req.Field,
		Filter:        req.Filter,
		Windows:       req.Windows,
		GroupBy:       req.GroupBy,
		PercentileVal: req.PercentileVal,
	}

	if err := h.aggregationEngine.AddRule(rule); err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, rule)
}

func (h *Handler) GetAggregationRule(c *gin.Context) {
	ruleID := c.Param("id")
	rule, err := h.aggregationEngine.GetRule(ruleID)
	if err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, rule)
}

func (h *Handler) UpdateAggregationRule(c *gin.Context) {
	ruleID := c.Param("id")
	var req CreateAggregationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, http.StatusBadRequest, err.Error())
		return
	}

	rule := &models.AggregationRule{
		ID:            ruleID,
		Name:          req.Name,
		PipelineID:    req.PipelineID,
		MetricName:    req.MetricName,
		Type:          req.Type,
		Field:         req.Field,
		Filter:        req.Filter,
		Windows:       req.Windows,
		GroupBy:       req.GroupBy,
		PercentileVal: req.PercentileVal,
	}

	if err := h.aggregationEngine.UpdateRule(rule); err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, rule)
}

func (h *Handler) DeleteAggregationRule(c *gin.Context) {
	ruleID := c.Param("id")
	if err := h.aggregationEngine.DeleteRule(ruleID); err != nil {
		h.handleError(c, err)
		return
	}
	h.success(c, nil)
}

func (h *Handler) GetAggregationResults(c *gin.Context) {
	ruleID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))

	results := h.aggregationEngine.GetResults(ruleID, limit)
	h.success(c, results)
}

func (h *Handler) GetMonitorStatus(c *gin.Context) {
	status := h.monitor.GetCurrentStatus()
	h.success(c, status)
}

func (h *Handler) GetMonitorAlerts(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	alerts := h.monitor.GetRecentAlerts(limit)
	h.success(c, alerts)
}

func (h *Handler) GetMonitorOverview(c *gin.Context) {
	status := h.monitor.GetCurrentStatus()
	unhealthyPipes := h.monitor.GetUnhealthyPipelines()
	unhealthyDS := h.monitor.GetUnhealthyDatasources()
	recentAlerts := h.monitor.GetRecentAlerts(20)

	h.success(c, gin.H{
		"status":             status,
		"unhealthy_pipes":    unhealthyPipes,
		"unhealthy_ds":       unhealthyDS,
		"recent_alerts":      recentAlerts,
		"pipeline_metrics":   h.monitor.GetAllPipelineMetrics(),
		"datasource_metrics": h.monitor.GetAllDatasourceMetrics(),
	})
}

func (h *Handler) HealthCheck(c *gin.Context) {
	h.success(c, gin.H{
		"status":    "healthy",
		"timestamp": time.Now(),
		"services": gin.H{
			"datasource": h.dsManager.IsRunning(),
			"pipeline":   true,
		},
	})
}
