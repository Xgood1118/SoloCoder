package pipeline

import (
	"context"
	"fmt"
	"log-pipeline/internal/config"
	"log-pipeline/internal/models"
	"log-pipeline/internal/store"
	"log-pipeline/pkg/utils"
	"sync"
	"sync/atomic"
	"time"
)

type PipelineInstance struct {
	*models.Pipeline
	parsers     []Processor
	filters     []Processor
	transforms  []Processor
	enhancers   []Processor
	inputChan   *utils.BoundedChannel[*models.LogEntry]
	outputChan  chan *models.LogEntry
	cancel      context.CancelFunc
	running     bool
	mu          sync.RWMutex

	inputCount  atomic.Int64
	outputCount atomic.Int64
	errorCount  atomic.Int64
	latencies   []int64
	latencyMu   sync.Mutex
}

func NewPipelineInstance(p *models.Pipeline) (*PipelineInstance, error) {
	pi := &PipelineInstance{
		Pipeline:   p,
		inputChan:  utils.NewBoundedChannel[*models.LogEntry](config.AppConfig.Pipeline.ChannelBufferSize),
		outputChan: make(chan *models.LogEntry, config.AppConfig.Pipeline.ChannelBufferSize),
	}

	if err := pi.loadProcessors(); err != nil {
		return nil, err
	}

	return pi, nil
}

func (pi *PipelineInstance) loadProcessors() error {
	var cfg models.PipelineConfigData
	if err := utils.FromJSON(pi.Config, &cfg); err != nil {
		return fmt.Errorf("parse pipeline config: %w", err)
	}

	pi.parsers = make([]Processor, 0, len(cfg.Parsers))
	for _, pc := range cfg.Parsers {
		proc, err := NewProcessor(pc)
		if err != nil {
			utils.Sugar.Warnf("Failed to create parser %s: %v", pc.Type, err)
			continue
		}
		pi.parsers = append(pi.parsers, proc)
	}

	pi.filters = make([]Processor, 0, len(cfg.Filters))
	for _, pc := range cfg.Filters {
		proc, err := NewProcessor(pc)
		if err != nil {
			utils.Sugar.Warnf("Failed to create filter %s: %v", pc.Type, err)
			continue
		}
		pi.filters = append(pi.filters, proc)
	}

	pi.transforms = make([]Processor, 0, len(cfg.Transforms))
	for _, pc := range cfg.Transforms {
		proc, err := NewProcessor(pc)
		if err != nil {
			utils.Sugar.Warnf("Failed to create transform %s: %v", pc.Type, err)
			continue
		}
		pi.transforms = append(pi.transforms, proc)
	}

	pi.enhancers = make([]Processor, 0, len(cfg.Enhancers))
	for _, pc := range cfg.Enhancers {
		proc, err := NewProcessor(pc)
		if err != nil {
			utils.Sugar.Warnf("Failed to create enhancer %s: %v", pc.Type, err)
			continue
		}
		pi.enhancers = append(pi.enhancers, proc)
	}

	return nil
}

func (pi *PipelineInstance) Start(ctx context.Context) {
	pi.mu.Lock()
	defer pi.mu.Unlock()

	if pi.running {
		return
	}

	ctx, pi.cancel = context.WithCancel(ctx)
	pi.running = true

	go pi.run(ctx)
	utils.Sugar.Infof("Pipeline %s started", pi.ID)
}

func (pi *PipelineInstance) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			close(pi.outputChan)
			pi.inputChan.Close()
			pi.running = false
			utils.Sugar.Infof("Pipeline %s stopped", pi.ID)
			return
		case entry, ok := <-pi.inputChan.Channel():
			if !ok {
				continue
			}
			pi.processEntry(entry)
		}
	}
}

func (pi *PipelineInstance) processEntry(entry *models.LogEntry) {
	startTime := time.Now()
	pi.inputCount.Add(1)

	current := entry
	passed := true

	for _, parser := range pi.parsers {
		processed, cont, err := parser.Process(current)
		if err != nil {
			pi.errorCount.Add(1)
			utils.Sugar.Debugf("Parser error: %v", err)
		}
		if !cont {
			passed = false
			break
		}
		current = processed
	}

	if !passed {
		return
	}

	for _, filter := range pi.filters {
		processed, cont, err := filter.Process(current)
		if err != nil {
			pi.errorCount.Add(1)
			utils.Sugar.Debugf("Filter error: %v", err)
		}
		if !cont {
			passed = false
			break
		}
		current = processed
	}

	if !passed {
		return
	}

	for _, transform := range pi.transforms {
		processed, cont, err := transform.Process(current)
		if err != nil {
			pi.errorCount.Add(1)
			utils.Sugar.Debugf("Transform error: %v", err)
		}
		if !cont {
			passed = false
			break
		}
		current = processed
	}

	if !passed {
		return
	}

	for _, enhancer := range pi.enhancers {
		processed, cont, err := enhancer.Process(current)
		if err != nil {
			pi.errorCount.Add(1)
			utils.Sugar.Debugf("Enhancer error: %v", err)
		}
		if !cont {
			passed = false
			break
		}
		current = processed
	}

	if !passed {
		return
	}

	latency := time.Since(startTime).Milliseconds()
	pi.latencyMu.Lock()
	pi.latencies = append(pi.latencies, latency)
	if len(pi.latencies) > 1000 {
		pi.latencies = pi.latencies[1:]
	}
	pi.latencyMu.Unlock()

	select {
	case pi.outputChan <- current:
		pi.outputCount.Add(1)
	default:
		pi.errorCount.Add(1)
		utils.Sugar.Warnf("Output channel full for pipeline %s", pi.ID)
	}
}

func (pi *PipelineInstance) Stop() {
	pi.mu.Lock()
	defer pi.mu.Unlock()

	if pi.cancel != nil {
		pi.cancel()
	}
}

func (pi *PipelineInstance) Reload(cfg *models.Pipeline) error {
	pi.mu.Lock()
	defer pi.mu.Unlock()

	pi.Pipeline = cfg
	return pi.loadProcessors()
}

func (pi *PipelineInstance) Input() chan<- *models.LogEntry {
	return pi.inputChan.SendChannel()
}

func (pi *PipelineInstance) Output() <-chan *models.LogEntry {
	return pi.outputChan
}

func (pi *PipelineInstance) Metrics() *models.PipelineMetrics {
	var avgLatency, p95Latency float64

	pi.latencyMu.Lock()
	if len(pi.latencies) > 0 {
		var sum int64
		for _, l := range pi.latencies {
			sum += l
		}
		avgLatency = float64(sum) / float64(len(pi.latencies))

		sorted := make([]int64, len(pi.latencies))
		copy(sorted, pi.latencies)
		p95Idx := int(float64(len(sorted)) * 0.95)
		if p95Idx < len(sorted) && p95Idx >= 0 {
			p95Latency = float64(sorted[p95Idx])
		}
	}
	pi.latencyMu.Unlock()

	return &models.PipelineMetrics{
		PipelineID:   pi.ID,
		InputCount:   pi.inputCount.Load(),
		OutputCount:  pi.outputCount.Load(),
		ErrorCount:   pi.errorCount.Load(),
		AvgLatencyMs: avgLatency,
		P95LatencyMs: p95Latency,
		Status:       string(pi.Status),
		Timestamp:    time.Now(),
	}
}

type Manager struct {
	pipelines    map[string]*PipelineInstance
	mu           sync.RWMutex
	store        *store.PipelineStore
	workerPool   *utils.WorkerPool
	dsManager    interface{}
	outputCh     chan *models.LogEntry
}

func NewManager(dsManager interface{}) *Manager {
	return &Manager{
		pipelines:  make(map[string]*PipelineInstance),
		store:      store.NewPipelineStore(),
		workerPool: utils.NewWorkerPool(config.AppConfig.Pipeline.WorkerPoolSize, 100),
		dsManager:  dsManager,
		outputCh:   make(chan *models.LogEntry, config.AppConfig.Pipeline.ChannelBufferSize*2),
	}
}

func (m *Manager) Start() error {
	m.workerPool.Start()

	pipelines, err := m.store.List()
	if err != nil {
		return fmt.Errorf("list pipelines: %w", err)
	}

	for _, p := range pipelines {
		if p.Status == models.PipelineStatusRunning {
			if err := m.createAndStart(&p); err != nil {
				utils.Sugar.Errorf("Failed to start pipeline %s: %v", p.ID, err)
			}
		}
	}

	go m.forwardOutput()

	return nil
}

func (m *Manager) forwardOutput() {
	for {
		m.mu.RLock()
		pipes := make([]*PipelineInstance, 0, len(m.pipelines))
		for _, p := range m.pipelines {
			pipes = append(pipes, p)
		}
		m.mu.RUnlock()

		for _, p := range pipes {
			select {
			case entry, ok := <-p.Output():
				if ok {
					select {
					case m.outputCh <- entry:
					default:
						utils.Sugar.Warn("Manager output channel full")
					}
				}
			default:
			}
		}

		time.Sleep(10 * time.Millisecond)
	}
}

func (m *Manager) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, p := range m.pipelines {
		p.Stop()
		delete(m.pipelines, id)
	}
	m.workerPool.Stop()
	close(m.outputCh)
}

func (m *Manager) createAndStart(p *models.Pipeline) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.pipelines[p.ID]; exists {
		return fmt.Errorf("pipeline %s already running", p.ID)
	}

	instance, err := NewPipelineInstance(p)
	if err != nil {
		return fmt.Errorf("create pipeline instance: %w", err)
	}

	ctx := context.Background()
	instance.Start(ctx)
	m.pipelines[p.ID] = instance

	return nil
}

func (m *Manager) StartPipeline(id string) error {
	p, err := m.store.GetByID(id)
	if err != nil {
		return err
	}

	if err := m.store.UpdateStatus(id, models.PipelineStatusRunning); err != nil {
		return err
	}

	return m.createAndStart(p)
}

func (m *Manager) StopPipeline(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	pi, exists := m.pipelines[id]
	if !exists {
		return fmt.Errorf("pipeline %s not running", id)
	}

	pi.Stop()
	delete(m.pipelines, id)

	return m.store.UpdateStatus(id, models.PipelineStatusPaused)
}

func (m *Manager) ReloadPipeline(id string) error {
	m.mu.RLock()
	pi, exists := m.pipelines[id]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("pipeline %s not running", id)
	}

	cfg, err := m.store.GetByID(id)
	if err != nil {
		return err
	}

	return pi.Reload(cfg)
}

func (m *Manager) RouteEntry(entry *models.LogEntry) {
	ds, ok := m.dsManager.(interface{ GetDatasource(string) *models.Datasource })
	if !ok {
		return
	}

	datasource := ds.GetDatasource(entry.DatasourceID)
	if datasource == nil || datasource.PipelineID == "" {
		return
	}

	m.mu.RLock()
	pi, exists := m.pipelines[datasource.PipelineID]
	m.mu.RUnlock()

	if !exists {
		return
	}

	select {
	case pi.Input() <- entry:
	default:
		utils.Sugar.Warnf("Pipeline %s input channel full", datasource.PipelineID)
	}
}

func (m *Manager) OutputChannel() <-chan *models.LogEntry {
	return m.outputCh
}

func (m *Manager) GetAllMetrics() []*models.PipelineMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	metrics := make([]*models.PipelineMetrics, 0, len(m.pipelines))
	for _, pi := range m.pipelines {
		metrics = append(metrics, pi.Metrics())
	}
	return metrics
}
