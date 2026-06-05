package aggregation

import (
	"context"
	"fmt"
	"log-pipeline/internal/models"
	"log-pipeline/internal/store"
	"log-pipeline/pkg/utils"
	"sort"
	"strings"
	"sync"
	"time"
)

type Aggregator interface {
	Add(value float64)
	Result() float64
	Reset()
	Type() models.AggregationType
}

type CountAggregator struct {
	count int64
}

func (a *CountAggregator) Add(_ float64) {
	a.count++
}

func (a *CountAggregator) Result() float64 {
	return float64(a.count)
}

func (a *CountAggregator) Reset() {
	a.count = 0
}

func (a *CountAggregator) Type() models.AggregationType {
	return models.AggregationCount
}

type SumAggregator struct {
	sum float64
}

func (a *SumAggregator) Add(value float64) {
	a.sum += value
}

func (a *SumAggregator) Result() float64 {
	return a.sum
}

func (a *SumAggregator) Reset() {
	a.sum = 0
}

func (a *SumAggregator) Type() models.AggregationType {
	return models.AggregationSum
}

type AvgAggregator struct {
	sum   float64
	count int64
}

func (a *AvgAggregator) Add(value float64) {
	a.sum += value
	a.count++
}

func (a *AvgAggregator) Result() float64 {
	if a.count == 0 {
		return 0
	}
	return a.sum / float64(a.count)
}

func (a *AvgAggregator) Reset() {
	a.sum = 0
	a.count = 0
}

func (a *AvgAggregator) Type() models.AggregationType {
	return models.AggregationAvg
}

type MinAggregator struct {
	min   float64
	first bool
}

func (a *MinAggregator) Add(value float64) {
	if !a.first || value < a.min {
		a.min = value
		a.first = true
	}
}

func (a *MinAggregator) Result() float64 {
	return a.min
}

func (a *MinAggregator) Reset() {
	a.min = 0
	a.first = false
}

func (a *MinAggregator) Type() models.AggregationType {
	return models.AggregationMin
}

type MaxAggregator struct {
	max   float64
	first bool
}

func (a *MaxAggregator) Add(value float64) {
	if !a.first || value > a.max {
		a.max = value
		a.first = true
	}
}

func (a *MaxAggregator) Result() float64 {
	return a.max
}

func (a *MaxAggregator) Reset() {
	a.max = 0
	a.first = false
}

func (a *MaxAggregator) Type() models.AggregationType {
	return models.AggregationMax
}

type PercentileAggregator struct {
	values     []float64
	percentile float64
}

func NewPercentileAggregator(p float64) *PercentileAggregator {
	return &PercentileAggregator{
		values:     make([]float64, 0, 1000),
		percentile: p,
	}
}

func (a *PercentileAggregator) Add(value float64) {
	a.values = append(a.values, value)
}

func (a *PercentileAggregator) Result() float64 {
	if len(a.values) == 0 {
		return 0
	}

	sorted := make([]float64, len(a.values))
	copy(sorted, a.values)
	sort.Float64s(sorted)

	idx := int(float64(len(sorted)) * a.percentile / 100.0)
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	if idx < 0 {
		idx = 0
	}
	return sorted[idx]
}

func (a *PercentileAggregator) Reset() {
	a.values = a.values[:0]
}

func (a *PercentileAggregator) Type() models.AggregationType {
	return models.AggregationPercentile
}

func NewAggregator(aggType models.AggregationType, percentileVal float64) Aggregator {
	switch aggType {
	case models.AggregationCount:
		return &CountAggregator{}
	case models.AggregationSum:
		return &SumAggregator{}
	case models.AggregationAvg:
		return &AvgAggregator{}
	case models.AggregationMin:
		return &MinAggregator{}
	case models.AggregationMax:
		return &MaxAggregator{}
	case models.AggregationPercentile:
		return NewPercentileAggregator(percentileVal)
	default:
		return &CountAggregator{}
	}
}

type WindowKey struct {
	RuleID    string
	Window    string
	Timestamp time.Time
	Tags      string
}

type WindowState struct {
	key        WindowKey
	aggregator Aggregator
	startTime  time.Time
	endTime    time.Time
}

type AggregationInstance struct {
	rule       *models.AggregationRule
	windows    map[string]*WindowState
	aggregator Aggregator
	mu         sync.RWMutex
	results    []*models.AggregationResult
}

func NewAggregationInstance(rule *models.AggregationRule) *AggregationInstance {
	return &AggregationInstance{
		rule:       rule,
		windows:    make(map[string]*WindowState),
		aggregator: NewAggregator(rule.Type, rule.PercentileVal),
		results:    make([]*models.AggregationResult, 0, 1000),
	}
}

func (a *AggregationInstance) Process(entry *models.LogEntry) {
	if entry.DatasourceID == "" {
		return
	}

	if a.rule.Filter != "" {
		if !a.matchFilter(entry) {
			return
		}
	}

	value := a.extractValue(entry)
	windows := strings.Split(a.rule.Windows, ",")

	for _, window := range windows {
		window = strings.TrimSpace(window)
		windowStart, windowEnd := a.getWindowBounds(window, entry.Timestamp)

		tagsKey := a.buildTagsKey(entry)
		keyStr := fmt.Sprintf("%s|%s|%s", a.rule.ID, window, tagsKey)

		a.mu.Lock()
		ws, exists := a.windows[keyStr]
		if !exists || !ws.startTime.Equal(windowStart) {
			if exists {
				a.emitResult(ws)
			}
			ws = &WindowState{
				key: WindowKey{
					RuleID:    a.rule.ID,
					Window:    window,
					Timestamp: windowStart,
					Tags:      tagsKey,
				},
				aggregator: NewAggregator(a.rule.Type, a.rule.PercentileVal),
				startTime:  windowStart,
				endTime:    windowEnd,
			}
			a.windows[keyStr] = ws
		}
		ws.aggregator.Add(value)
		a.mu.Unlock()
	}
}

func (a *AggregationInstance) matchFilter(entry *models.LogEntry) bool {
	filter := a.rule.Filter
	if strings.HasPrefix(filter, "level == ") {
		level := strings.Trim(filter[10:], " '\"")
		return entry.Level == level
	}
	if strings.Contains(filter, "&&") {
		parts := strings.Split(filter, "&&")
		for _, part := range parts {
			part = strings.TrimSpace(part)
			if strings.HasPrefix(part, "level == ") {
				level := strings.Trim(part[10:], " '\"")
				if entry.Level != level {
					return false
				}
			}
		}
		return true
	}
	return true
}

func (a *AggregationInstance) extractValue(entry *models.LogEntry) float64 {
	if a.rule.Field == "" {
		return 1
	}

	if val, ok := entry.Fields[a.rule.Field]; ok {
		switch v := val.(type) {
		case float64:
			return v
		case int:
			return float64(v)
		case int64:
			return float64(v)
		}
	}

	return 1
}

func (a *AggregationInstance) buildTagsKey(entry *models.LogEntry) string {
	if a.rule.GroupBy == "" {
		return "all"
	}

	groupBys := strings.Split(a.rule.GroupBy, ",")
	parts := make([]string, 0, len(groupBys))
	for _, gb := range groupBys {
		gb = strings.TrimSpace(gb)
		if val, ok := entry.Tags[gb]; ok {
			parts = append(parts, fmt.Sprintf("%s=%s", gb, val))
		}
	}

	if len(parts) == 0 {
		return "all"
	}
	return strings.Join(parts, "|")
}

func (a *AggregationInstance) getWindowBounds(window string, t time.Time) (time.Time, time.Time) {
	switch window {
	case "minute":
		start := t.Truncate(time.Minute)
		return start, start.Add(time.Minute)
	case "hour":
		start := t.Truncate(time.Hour)
		return start, start.Add(time.Hour)
	case "day":
		start := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
		return start, start.Add(24 * time.Hour)
	default:
		start := t.Truncate(time.Minute)
		return start, start.Add(time.Minute)
	}
}

func (a *AggregationInstance) emitResult(ws *WindowState) {
	result := &models.AggregationResult{
		ID:         utils.GenerateID(),
		MetricName: a.rule.MetricName,
		Tags:       a.parseTags(ws.key.Tags),
		Value:      ws.aggregator.Result(),
		Timestamp:  ws.startTime,
		Window:     ws.key.Window,
	}

	a.results = append(a.results, result)
	if len(a.results) > 10000 {
		a.results = a.results[1000:]
	}
}

func (a *AggregationInstance) parseTags(tagsStr string) map[string]string {
	tags := make(map[string]string)
	if tagsStr == "all" {
		return tags
	}

	parts := strings.Split(tagsStr, "|")
	for _, part := range parts {
		kv := strings.Split(part, "=")
		if len(kv) == 2 {
			tags[kv[0]] = kv[1]
		}
	}
	return tags
}

func (a *AggregationInstance) GetResults(limit int) []*models.AggregationResult {
	a.mu.RLock()
	defer a.mu.RUnlock()

	if limit <= 0 || limit > len(a.results) {
		limit = len(a.results)
	}

	results := make([]*models.AggregationResult, limit)
	copy(results, a.results[len(a.results)-limit:])
	return results
}

func (a *AggregationInstance) GetCurrentValue(window string) float64 {
	a.mu.RLock()
	defer a.mu.RUnlock()

	now := time.Now()
	windowStart, _ := a.getWindowBounds(window, now)

	for _, ws := range a.windows {
		if ws.key.Window == window && ws.startTime.Equal(windowStart) {
			return ws.aggregator.Result()
		}
	}

	return 0
}

func (a *AggregationInstance) Reload(rule *models.AggregationRule) {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.rule = rule
	a.aggregator = NewAggregator(rule.Type, rule.PercentileVal)
	a.windows = make(map[string]*WindowState)
}

type Engine struct {
	aggregations map[string]*AggregationInstance
	store        *store.AggregationStore
	mu           sync.RWMutex
	cancel       context.CancelFunc
}

func NewEngine() *Engine {
	return &Engine{
		aggregations: make(map[string]*AggregationInstance),
		store:        store.NewAggregationStore(),
	}
}

func (e *Engine) Start(ctx context.Context) error {
	ctx, e.cancel = context.WithCancel(ctx)

	rules, err := e.store.List()
	if err != nil {
		return fmt.Errorf("list aggregation rules: %w", err)
	}

	for _, rule := range rules {
		e.aggregations[rule.ID] = NewAggregationInstance(&rule)
	}

	go e.cleanupOldWindows(ctx)
	utils.Sugar.Info("Aggregation engine started")
	return nil
}

func (e *Engine) Stop() {
	if e.cancel != nil {
		e.cancel()
	}
	utils.Sugar.Info("Aggregation engine stopped")
}

func (e *Engine) cleanupOldWindows(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.mu.Lock()
			for _, agg := range e.aggregations {
				agg.mu.Lock()
				cutoff := time.Now().Add(-24 * time.Hour)
				for key, ws := range agg.windows {
					if ws.endTime.Before(cutoff) {
						delete(agg.windows, key)
					}
				}
				agg.mu.Unlock()
			}
			e.mu.Unlock()
		}
	}
}

func (e *Engine) Process(entry *models.LogEntry) {
	e.mu.RLock()
	aggs := make([]*AggregationInstance, 0, len(e.aggregations))
	for _, agg := range e.aggregations {
		aggs = append(aggs, agg)
	}
	e.mu.RUnlock()

	for _, agg := range aggs {
		agg.Process(entry)
	}
}

func (e *Engine) AddRule(rule *models.AggregationRule) error {
	if err := e.store.Create(rule); err != nil {
		return err
	}

	e.mu.Lock()
	e.aggregations[rule.ID] = NewAggregationInstance(rule)
	e.mu.Unlock()

	return nil
}

func (e *Engine) GetRule(id string) (*models.AggregationRule, error) {
	return e.store.GetByID(id)
}

func (e *Engine) UpdateRule(rule *models.AggregationRule) error {
	if err := e.store.Update(rule); err != nil {
		return err
	}

	e.mu.Lock()
	if agg, exists := e.aggregations[rule.ID]; exists {
		agg.Reload(rule)
	} else {
		e.aggregations[rule.ID] = NewAggregationInstance(rule)
	}
	e.mu.Unlock()

	return nil
}

func (e *Engine) DeleteRule(id string) error {
	if err := e.store.Delete(id); err != nil {
		return err
	}

	e.mu.Lock()
	delete(e.aggregations, id)
	e.mu.Unlock()

	return nil
}

func (e *Engine) GetResults(ruleID string, limit int) []*models.AggregationResult {
	e.mu.RLock()
	agg, exists := e.aggregations[ruleID]
	e.mu.RUnlock()

	if !exists {
		return nil
	}

	return agg.GetResults(limit)
}

func (e *Engine) GetCurrentValue(ruleID string, window string) float64 {
	e.mu.RLock()
	agg, exists := e.aggregations[ruleID]
	e.mu.RUnlock()

	if !exists {
		return 0
	}

	return agg.GetCurrentValue(window)
}

func (e *Engine) ListRules() ([]models.AggregationRule, error) {
	return e.store.List()
}
