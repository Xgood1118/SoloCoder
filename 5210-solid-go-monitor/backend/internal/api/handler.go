package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"solid-go-monitor/internal/model"
	"solid-go-monitor/internal/scheduler"
	"solid-go-monitor/internal/store"
)

type Handler struct {
	store     *store.Store
	scheduler *scheduler.Scheduler
}

func NewHandler(s *store.Store, sch *scheduler.Scheduler) *Handler {
	return &Handler{store: s, scheduler: sch}
}

func (h *Handler) GetProbes(c *gin.Context) {
	probes := h.store.GetAllProbes()
	result := make([]map[string]interface{}, len(probes))
	for i, p := range probes {
		status := h.store.GetStatus(p.ID)
		if !p.Enabled {
			status = model.ProbeStatusDisabled
		}
		result[i] = map[string]interface{}{
			"id":       p.ID,
			"name":     p.Name,
			"type":     p.Type,
			"target":   p.Target,
			"interval": p.Interval,
			"timeout":  p.Timeout,
			"group":    p.Group,
			"enabled":  p.Enabled,
			"status":   status,
			"createTime": p.CreateTime,
			"failureThreshold": p.FailureThreshold,
			"webhookUrl": p.WebhookURL,
		}
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetProbe(c *gin.Context) {
	id := c.Param("id")
	probe, ok := h.store.GetProbe(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "probe not found"})
		return
	}
	c.JSON(http.StatusOK, probe)
}

type CreateProbeRequest struct {
	Name             string `json:"name" binding:"required"`
	Type             string `json:"type" binding:"required"`
	Target           string `json:"target" binding:"required"`
	Interval         int    `json:"interval"`
	Timeout          int    `json:"timeout"`
	Group            string `json:"group"`
	Enabled          bool   `json:"enabled"`
	FailureThreshold int    `json:"failureThreshold"`
	WebhookURL       string `json:"webhookUrl"`
}

func (h *Handler) CreateProbe(c *gin.Context) {
	var req CreateProbeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	probe := model.NewProbe(req.Name, model.ProbeType(req.Type), req.Target, req.Interval, req.Timeout, req.Group)
	probe.Enabled = req.Enabled
	if req.FailureThreshold > 0 {
		probe.FailureThreshold = req.FailureThreshold
	}
	probe.WebhookURL = req.WebhookURL

	if req.Interval == 0 {
		probe.Interval = 30
	}
	if req.Timeout == 0 {
		probe.Timeout = 10
	}
	if req.Group == "" {
		probe.Group = "default"
	}

	h.store.AddProbe(probe)
	if probe.Enabled {
		h.scheduler.StartProbe(probe.ID)
	}

	c.JSON(http.StatusCreated, probe)
}

func (h *Handler) UpdateProbe(c *gin.Context) {
	id := c.Param("id")
	existing, ok := h.store.GetProbe(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "probe not found"})
		return
	}

	var req CreateProbeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	existing.Name = req.Name
	existing.Type = model.ProbeType(req.Type)
	existing.Target = req.Target
	if req.Interval > 0 {
		existing.Interval = req.Interval
	}
	if req.Timeout > 0 {
		existing.Timeout = req.Timeout
	}
	existing.Group = req.Group
	existing.FailureThreshold = req.FailureThreshold
	existing.WebhookURL = req.WebhookURL

	wasEnabled := existing.Enabled
	existing.Enabled = req.Enabled

	h.store.UpdateProbe(existing)

	if wasEnabled != req.Enabled {
		if req.Enabled {
			h.scheduler.StartProbe(id)
		} else {
			h.scheduler.StopProbe(id)
			h.store.SetStatus(id, model.ProbeStatusDisabled)
		}
	} else if wasEnabled {
		h.scheduler.RestartProbe(id)
	}

	c.JSON(http.StatusOK, existing)
}

func (h *Handler) PatchProbe(c *gin.Context) {
	id := c.Param("id")
	existing, ok := h.store.GetProbe(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "probe not found"})
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	wasEnabled := existing.Enabled

	if v, ok := body["name"].(string); ok {
		existing.Name = v
	}
	if v, ok := body["target"].(string); ok {
		existing.Target = v
	}
	if v, ok := body["interval"].(float64); ok {
		existing.Interval = int(v)
	}
	if v, ok := body["timeout"].(float64); ok {
		existing.Timeout = int(v)
	}
	if v, ok := body["group"].(string); ok {
		existing.Group = v
	}
	if v, ok := body["enabled"].(bool); ok {
		existing.Enabled = v
	}
	if v, ok := body["failureThreshold"].(float64); ok {
		existing.FailureThreshold = int(v)
	}
	if v, ok := body["webhookUrl"].(string); ok {
		existing.WebhookURL = v
	}

	h.store.UpdateProbe(existing)

	if _, ok := body["enabled"]; ok {
		if existing.Enabled {
			h.scheduler.StartProbe(id)
		} else {
			h.scheduler.StopProbe(id)
			h.store.SetStatus(id, model.ProbeStatusDisabled)
		}
	} else if wasEnabled && (body["interval"] != nil || body["timeout"] != nil || body["target"] != nil) {
		h.scheduler.RestartProbe(id)
	}

	c.JSON(http.StatusOK, existing)
}

func (h *Handler) DeleteProbe(c *gin.Context) {
	id := c.Param("id")
	h.scheduler.StopProbe(id)
	h.store.DeleteProbe(id)
	c.Status(http.StatusNoContent)
}

func (h *Handler) CloneProbe(c *gin.Context) {
	id := c.Param("id")
	original, ok := h.store.GetProbe(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "probe not found"})
		return
	}

	newProbe := &model.Probe{
		ID:               original.ID + "-clone",
		Name:             original.Name + " (copy)",
		Type:             original.Type,
		Target:           original.Target,
		Interval:         original.Interval,
		Timeout:          original.Timeout,
		Group:            original.Group,
		Enabled:          false,
		FailureThreshold: original.FailureThreshold,
		WebhookURL:       original.WebhookURL,
		CreateTime:       time.Now(),
		UpdateTime:       time.Now(),
	}

	h.store.AddProbe(newProbe)
	c.JSON(http.StatusCreated, newProbe)
}

func (h *Handler) TestProbe(c *gin.Context) {
	id := c.Param("id")
	result := h.scheduler.TestProbe(id)
	if result == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "probe not found"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ImportProbes(c *gin.Context) {
	var probes []CreateProbeRequest
	if err := c.ShouldBindJSON(&probes); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created := make([]*model.Probe, 0, len(probes))
	for _, req := range probes {
		probe := model.NewProbe(req.Name, model.ProbeType(req.Type), req.Target, req.Interval, req.Timeout, req.Group)
		probe.Enabled = req.Enabled
		if req.FailureThreshold > 0 {
			probe.FailureThreshold = req.FailureThreshold
		}
		probe.WebhookURL = req.WebhookURL
		if req.Interval == 0 {
			probe.Interval = 30
		}
		if req.Timeout == 0 {
			probe.Timeout = 10
		}
		if req.Group == "" {
			probe.Group = "default"
		}

		h.store.AddProbe(probe)
		if probe.Enabled {
			h.scheduler.StartProbe(probe.ID)
		}
		created = append(created, probe)
	}

	c.JSON(http.StatusCreated, created)
}

func (h *Handler) GetProbeResults(c *gin.Context) {
	id := c.Param("id")

	sinceStr := c.Query("since")
	untilStr := c.Query("until")
	limitStr := c.Query("limit")

	var results []*model.ProbeResult

	if sinceStr != "" && untilStr != "" {
		since, _ := time.Parse(time.RFC3339, sinceStr)
		until, _ := time.Parse(time.RFC3339, untilStr)
		results = h.store.GetResultsRange(id, since, until)
	} else if sinceStr != "" {
		since, _ := time.Parse(time.RFC3339, sinceStr)
		results = h.store.GetResultsSince(id, since)
	} else {
		results = h.store.GetResults(id)
	}

	if limitStr != "" {
		limit, _ := strconv.Atoi(limitStr)
		if limit > 0 && len(results) > limit {
			results = results[len(results)-limit:]
		}
	}

	c.JSON(http.StatusOK, results)
}

func (h *Handler) GetProbeStats(c *gin.Context) {
	id := c.Param("id")
	stats := h.store.GetStats(id)
	c.JSON(http.StatusOK, stats)
}

func (h *Handler) GetLastFailures(c *gin.Context) {
	id := c.Param("id")
	n := 10
	if nStr := c.Query("limit"); nStr != "" {
		if val, err := strconv.Atoi(nStr); err == nil && val > 0 {
			n = val
		}
	}
	failures := h.store.GetLastFailures(id, n)
	c.JSON(http.StatusOK, failures)
}

func (h *Handler) GetEvents(c *gin.Context) {
	limit := 100
	if limitStr := c.Query("limit"); limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}
	events := h.store.GetEvents(limit)
	c.JSON(http.StatusOK, events)
}

func (h *Handler) AckEvent(c *gin.Context) {
	id := c.Param("id")
	h.store.AckEvent(id, "user")
	c.Status(http.StatusOK)
}

func (h *Handler) GetAlerts(c *gin.Context) {
	alerts := h.store.GetAllAlerts()

	sortBy := c.Query("sortBy")
	if sortBy == "name" {
		// 按探针名排序由前端处理
	}
	// 默认按开始时间倒序

	c.JSON(http.StatusOK, alerts)
}

func (h *Handler) GetAlertHistory(c *gin.Context) {
	limit := 100
	if limitStr := c.Query("limit"); limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}
	history := h.store.GetAlertHistory(limit)
	c.JSON(http.StatusOK, history)
}

type AckAlertRequest struct {
	ProbeIDs []string `json:"probeIds"`
}

func (h *Handler) AckAlert(c *gin.Context) {
	id := c.Param("id")
	h.store.AckAlert(id, "user")
	c.Status(http.StatusOK)
}

func (h *Handler) AckAlertsBatch(c *gin.Context) {
	var req AckAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	for _, probeID := range req.ProbeIDs {
		h.store.AckAlert(probeID, "user")
	}
	c.Status(http.StatusOK)
}

type SilenceAlertRequest struct {
	Minutes int `json:"minutes"`
}

func (h *Handler) SilenceAlert(c *gin.Context) {
	id := c.Param("id")
	var req SilenceAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Minutes <= 0 {
		req.Minutes = 30
	}
	h.store.SilenceAlert(id, req.Minutes)
	c.Status(http.StatusOK)
}

type SilenceAlertsBatchRequest struct {
	ProbeIDs []string `json:"probeIds"`
	Minutes  int      `json:"minutes"`
}

func (h *Handler) SilenceAlertsBatch(c *gin.Context) {
	var req SilenceAlertsBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Minutes <= 0 {
		req.Minutes = 30
	}
	for _, probeID := range req.ProbeIDs {
		h.store.SilenceAlert(probeID, req.Minutes)
	}
	c.Status(http.StatusOK)
}

func (h *Handler) GetGroups(c *gin.Context) {
	groups := h.store.GetGroups()
	c.JSON(http.StatusOK, groups)
}

func (h *Handler) Overview(c *gin.Context) {
	probes := h.store.GetAllProbes()
	alerts := h.store.GetAllAlerts()

	total := len(probes)
	up := 0
	down := 0
	disabled := 0
	unknown := 0

	for _, p := range probes {
		if !p.Enabled {
			disabled++
			continue
		}
		status := h.store.GetStatus(p.ID)
		switch status {
		case model.ProbeStatusUp:
			up++
		case model.ProbeStatusDown:
			down++
		default:
			unknown++
		}
	}

	groups := h.store.GetGroups()

	c.JSON(http.StatusOK, gin.H{
		"total":    total,
		"up":       up,
		"down":     down,
		"disabled": disabled,
		"unknown":  unknown,
		"alerts":   len(alerts),
		"groups":   groups,
	})
}
