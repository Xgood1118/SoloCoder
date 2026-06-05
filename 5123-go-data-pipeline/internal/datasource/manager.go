package datasource

import (
	"context"
	"fmt"
	"log-pipeline/internal/config"
	"log-pipeline/internal/models"
	"log-pipeline/internal/store"
	"log-pipeline/pkg/utils"
	"sync"
)

type Datasource interface {
	ID() string
	Type() models.DatasourceType
	Start(ctx context.Context, output chan<- *models.LogEntry) error
	Stop() error
	Status() models.DatasourceStatus
	Metrics() *models.DatasourceMetrics
	Reload(cfg *models.Datasource) error
}

type Manager struct {
	datasources map[string]Datasource
	mu          sync.RWMutex
	dsStore     *store.DatasourceStore
	outputChan  *utils.BoundedChannel[*models.LogEntry]
	workerPool  *utils.WorkerPool
	running     bool
}

func NewManager() *Manager {
	return &Manager{
		datasources: make(map[string]Datasource),
		dsStore:     store.NewDatasourceStore(),
		outputChan:  utils.NewBoundedChannel[*models.LogEntry](config.AppConfig.Datasource.ChannelBufferSize),
		workerPool:  utils.NewWorkerPool(config.AppConfig.Datasource.WorkerPoolSize, 100),
	}
}

func (m *Manager) Start() error {
	m.running = true
	m.workerPool.Start()

	datasources, err := m.dsStore.List()
	if err != nil {
		return fmt.Errorf("list datasources: %w", err)
	}

	for _, ds := range datasources {
		if ds.Status == models.DatasourceStatusRunning {
			if err := m.createAndStart(&ds); err != nil {
				utils.Sugar.Errorf("Failed to start datasource %s: %v", ds.ID, err)
			}
		}
	}

	return nil
}

func (m *Manager) Stop() {
	m.running = false
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, ds := range m.datasources {
		if err := ds.Stop(); err != nil {
			utils.Sugar.Errorf("Error stopping datasource %s: %v", id, err)
		}
	}
	m.datasources = make(map[string]Datasource)
	m.workerPool.Stop()
	m.outputChan.Close()
}

func (m *Manager) createAndStart(ds *models.Datasource) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.datasources[ds.ID]; exists {
		return fmt.Errorf("datasource %s already running", ds.ID)
	}

	datasource, err := m.createDatasource(ds)
	if err != nil {
		return fmt.Errorf("create datasource: %w", err)
	}

	ctx := context.Background()
	if err := datasource.Start(ctx, m.outputChan.SendChannel()); err != nil {
		return fmt.Errorf("start datasource: %w", err)
	}

	m.datasources[ds.ID] = datasource
	utils.Sugar.Infof("Datasource %s started successfully", ds.ID)
	return nil
}

func (m *Manager) createDatasource(ds *models.Datasource) (Datasource, error) {
	switch ds.Type {
	case models.DatasourceTypeFile:
		return NewFileDatasource(ds), nil
	case models.DatasourceTypeKafka:
		return NewKafkaDatasource(ds), nil
	case models.DatasourceTypeElasticsearch:
		return NewESDatasource(ds), nil
	case models.DatasourceTypeHTTP:
		return NewHTTPDatasource(ds, m), nil
	default:
		return nil, fmt.Errorf("unsupported datasource type: %s", ds.Type)
	}
}

func (m *Manager) StartDatasource(id string) error {
	ds, err := m.dsStore.GetByID(id)
	if err != nil {
		return err
	}

	if err := m.dsStore.UpdateStatus(id, models.DatasourceStatusRunning); err != nil {
		return err
	}

	return m.createAndStart(ds)
}

func (m *Manager) StopDatasource(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	ds, exists := m.datasources[id]
	if !exists {
		return fmt.Errorf("datasource %s not running", id)
	}

	if err := ds.Stop(); err != nil {
		return err
	}

	delete(m.datasources, id)
	if err := m.dsStore.UpdateStatus(id, models.DatasourceStatusPaused); err != nil {
		return err
	}

	utils.Sugar.Infof("Datasource %s stopped", id)
	return nil
}

func (m *Manager) ReloadDatasource(id string) error {
	m.mu.RLock()
	ds, exists := m.datasources[id]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("datasource %s not running", id)
	}

	cfg, err := m.dsStore.GetByID(id)
	if err != nil {
		return err
	}

	return ds.Reload(cfg)
}

func (m *Manager) OutputChannel() <-chan *models.LogEntry {
	return m.outputChan.Channel()
}

func (m *Manager) GetAllMetrics() []*models.DatasourceMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	metrics := make([]*models.DatasourceMetrics, 0, len(m.datasources))
	for _, ds := range m.datasources {
		metrics = append(metrics, ds.Metrics())
	}
	return metrics
}

func (m *Manager) GetHTTPDatasource(id string) *HTTPDatasource {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ds, exists := m.datasources[id]
	if !exists {
		return nil
	}
	httpDs, ok := ds.(*HTTPDatasource)
	if !ok {
		return nil
	}
	return httpDs
}

func (m *Manager) IsRunning() bool {
	return m.running
}

func (m *Manager) GetDatasource(id string) *models.Datasource {
	ds, err := m.dsStore.GetByID(id)
	if err != nil {
		return nil
	}
	return ds
}
