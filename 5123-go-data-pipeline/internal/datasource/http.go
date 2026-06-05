package datasource

import (
	"context"
	"log-pipeline/internal/models"
	"log-pipeline/pkg/utils"
)

type HTTPDatasource struct {
	*BaseDatasource
	cfg     *models.Datasource
	httpCfg *models.HTTPConfig
	manager *Manager
	output  chan<- *models.LogEntry
}

func NewHTTPDatasource(cfg *models.Datasource, manager *Manager) *HTTPDatasource {
	return &HTTPDatasource{
		BaseDatasource: NewBaseDatasource(cfg.ID, models.DatasourceTypeHTTP),
		cfg:            cfg,
		manager:        manager,
	}
}

func (h *HTTPDatasource) Start(ctx context.Context, output chan<- *models.LogEntry) error {
	var httpCfg models.HTTPConfig
	if err := utils.FromJSON(h.cfg.Config, &httpCfg); err != nil {
		return err
	}
	h.httpCfg = &httpCfg
	h.output = output
	return nil
}

func (h *HTTPDatasource) Push(entries []*models.LogEntry) error {
	if h.Status() != models.DatasourceStatusRunning {
		return nil
	}

	for _, entry := range entries {
		entry.DatasourceID = h.ID()
		if entry.ID == "" {
			entry.ID = utils.GenerateID()
		}
		if entry.Timestamp.IsZero() {
			entry.Timestamp = models.NewLogEntry().Timestamp
		}

		select {
		case h.output <- entry:
			h.IncrementRecord()
		default:
			h.IncrementError()
			utils.Sugar.Warnf("Output channel full, dropping log from %s", h.ID())
		}
	}

	return nil
}

func (h *HTTPDatasource) Stop() error {
	h.SetStatus(models.DatasourceStatusPaused)
	return nil
}

func (h *HTTPDatasource) Reload(cfg *models.Datasource) error {
	h.cfg = cfg
	var httpCfg models.HTTPConfig
	if err := utils.FromJSON(cfg.Config, &httpCfg); err != nil {
		return err
	}
	h.httpCfg = &httpCfg
	return nil
}

func (h *HTTPDatasource) APIKey() string {
	return h.httpCfg.APIKey
}

func (h *HTTPDatasource) Path() string {
	return h.httpCfg.Path
}
