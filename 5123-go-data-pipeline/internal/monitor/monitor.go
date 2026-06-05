package monitor

import (
	"context"
	"log-pipeline/internal/config"
	"log-pipeline/internal/models"
	"log-pipeline/pkg/utils"
	"sync"
	"time"
)

type DataSourceManager interface {
	GetAllMetrics() []*models.DatasourceMetrics
}

type PipelineManager interface {
	GetAllMetrics() []*models.PipelineMetrics
}

type Monitor struct {
	dsManager       DataSourceManager
	pipelineManager PipelineManager
	metrics         map[string][]*models.PipelineMetrics
	dsMetrics       map[string][]*models.DatasourceMetrics
	alerts          []*models.AlertHistory
	mu              sync.RWMutex
	cancel          context.CancelFunc
	interval        time.Duration
	retention       time.Duration
}

func NewMonitor(dsManager DataSourceManager, pipelineManager PipelineManager) *Monitor {
	return &Monitor{
		dsManager:       dsManager,
		pipelineManager: pipelineManager,
		metrics:         make(map[string][]*models.PipelineMetrics),
		dsMetrics:       make(map[string][]*models.DatasourceMetrics),
		alerts:          make([]*models.AlertHistory, 0, 100),
		interval:        config.AppConfig.Monitor.MetricInterval,
		retention:       time.Duration(config.AppConfig.Monitor.RetentionDays) * 24 * time.Hour,
	}
}

func (m *Monitor) Start(ctx context.Context) {
	ctx, m.cancel = context.WithCancel(ctx)
	go m.collectLoop(ctx)
	utils.Sugar.Info("Monitor started")
}

func (m *Monitor) Stop() {
	if m.cancel != nil {
		m.cancel()
	}
	utils.Sugar.Info("Monitor stopped")
}

func (m *Monitor) collectLoop(ctx context.Context) {
	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.collectMetrics()
			m.cleanupOldData()
		}
	}
}

func (m *Monitor) collectMetrics() {
	dsMetrics := m.dsManager.GetAllMetrics()
	pipeMetrics := m.pipelineManager.GetAllMetrics()

	m.mu.Lock()
	defer m.mu.Unlock()

	for _, metric := range dsMetrics {
		m.dsMetrics[metric.DatasourceID] = append(m.dsMetrics[metric.DatasourceID], metric)
		if len(m.dsMetrics[metric.DatasourceID]) > 1000 {
			m.dsMetrics[metric.DatasourceID] = m.dsMetrics[metric.DatasourceID][100:]
		}
	}

	for _, metric := range pipeMetrics {
		m.metrics[metric.PipelineID] = append(m.metrics[metric.PipelineID], metric)
		if len(m.metrics[metric.PipelineID]) > 1000 {
			m.metrics[metric.PipelineID] = m.metrics[metric.PipelineID][100:]
		}
	}
}

func (m *Monitor) cleanupOldData() {
	m.mu.Lock()
	defer m.mu.Unlock()

	cutoff := time.Now().Add(-m.retention)

	for id, metrics := range m.metrics {
		filtered := make([]*models.PipelineMetrics, 0, len(metrics))
		for _, metric := range metrics {
			if metric.Timestamp.After(cutoff) {
				filtered = append(filtered, metric)
			}
		}
		m.metrics[id] = filtered
	}

	for id, metrics := range m.dsMetrics {
		filtered := make([]*models.DatasourceMetrics, 0, len(metrics))
		for _, metric := range metrics {
			if metric.Timestamp.After(cutoff) {
				filtered = append(filtered, metric)
			}
		}
		m.dsMetrics[id] = filtered
	}

	filteredAlerts := make([]*models.AlertHistory, 0, len(m.alerts))
	for _, alert := range m.alerts {
		if alert.TriggeredAt.After(cutoff) {
			filteredAlerts = append(filteredAlerts, alert)
		}
	}
	m.alerts = filteredAlerts
}

func (m *Monitor) GetPipelineMetrics(pipelineID string) []*models.PipelineMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.metrics[pipelineID]
}

func (m *Monitor) GetDatasourceMetrics(datasourceID string) []*models.DatasourceMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.dsMetrics[datasourceID]
}

func (m *Monitor) GetAllPipelineMetrics() map[string][]*models.PipelineMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string][]*models.PipelineMetrics, len(m.metrics))
	for k, v := range m.metrics {
		result[k] = v
	}
	return result
}

func (m *Monitor) GetAllDatasourceMetrics() map[string][]*models.DatasourceMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string][]*models.DatasourceMetrics, len(m.dsMetrics))
	for k, v := range m.dsMetrics {
		result[k] = v
	}
	return result
}

func (m *Monitor) GetCurrentStatus() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	dsMetrics := m.dsManager.GetAllMetrics()
	pipeMetrics := m.pipelineManager.GetAllMetrics()

	status := map[string]interface{}{
		"timestamp":       time.Now(),
		"datasource_count": len(dsMetrics),
		"pipeline_count":  len(pipeMetrics),
		"datasources":     dsMetrics,
		"pipelines":       pipeMetrics,
	}

	var errorCount int64
	var totalInput, totalOutput int64

	for _, ds := range dsMetrics {
		if ds.Status == "error" {
			errorCount++
		}
	}

	for _, p := range pipeMetrics {
		totalInput += p.InputCount
		totalOutput += p.OutputCount
		if p.Status == "error" {
			errorCount++
		}
	}

	status["error_count"] = errorCount
	status["total_input"] = totalInput
	status["total_output"] = totalOutput

	return status
}

func (m *Monitor) GetUnhealthyPipelines() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	pipeMetrics := m.pipelineManager.GetAllMetrics()
	unhealthy := make([]string, 0)

	for _, pm := range pipeMetrics {
		if pm.Status == string(models.PipelineStatusError) || pm.ErrorCount > 100 {
			unhealthy = append(unhealthy, pm.PipelineID)
		}
	}

	return unhealthy
}

func (m *Monitor) GetUnhealthyDatasources() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	dsMetrics := m.dsManager.GetAllMetrics()
	unhealthy := make([]string, 0)

	for _, dm := range dsMetrics {
		if dm.Status == string(models.DatasourceStatusError) || dm.ErrorCount > 100 {
			unhealthy = append(unhealthy, dm.DatasourceID)
		}
	}

	return unhealthy
}

func (m *Monitor) AddAlert(alert *models.AlertHistory) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.alerts = append(m.alerts, alert)
	if len(m.alerts) > 100 {
		m.alerts = m.alerts[1:]
	}
}

func (m *Monitor) GetRecentAlerts(limit int) []*models.AlertHistory {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if limit <= 0 || limit > len(m.alerts) {
		limit = len(m.alerts)
	}

	result := make([]*models.AlertHistory, limit)
	copy(result, m.alerts[len(m.alerts)-limit:])

	return result
}
