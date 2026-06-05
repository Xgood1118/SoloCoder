package shard

import (
	"context"
	"crypto/sha256"
	"fmt"
	"hash/fnv"
	"sort"
	"sync"

	"github.com/vector-proxy/pkg/core"
	"github.com/vector-proxy/pkg/index"
	"github.com/vector-proxy/pkg/similarity"
)

type ShardStrategyType string

const (
	StrategyHash      ShardStrategyType = "hash"
	StrategyRange     ShardStrategyType = "range"
	StrategyCategory  ShardStrategyType = "category"
	StrategyCustom    ShardStrategyType = "custom"
)

type ShardConfig struct {
	Strategy       ShardStrategyType
	NumShards      int
	ShardKeyField  string
	IndexConfig    core.IndexConfig
	CustomSharder  func(record core.VectorRecord) string
}

type ShardManager struct {
	mu           sync.RWMutex
	shards       map[string]core.Index
	strategy     ShardStrategyType
	numShards    int
	shardKeyField string
	indexConfig  core.IndexConfig
	customSharder func(record core.VectorRecord) string
	factory      *index.IndexFactory
	metricType   core.MetricType
}

func NewShardManager(config ShardConfig) (*ShardManager, error) {
	manager := &ShardManager{
		shards:        make(map[string]core.Index),
		strategy:      config.Strategy,
		numShards:     config.NumShards,
		shardKeyField: config.ShardKeyField,
		indexConfig:   config.IndexConfig,
		customSharder: config.CustomSharder,
		factory:       index.NewIndexFactory(),
		metricType:    config.IndexConfig.MetricType,
	}

	if err := manager.initializeShards(); err != nil {
		return nil, err
	}

	return manager, nil
}

func (m *ShardManager) initializeShards() error {
	for i := 0; i < m.numShards; i++ {
		shardKey := fmt.Sprintf("shard_%d", i)
		idx, err := m.factory.Create(m.indexConfig)
		if err != nil {
			return err
		}
		m.shards[shardKey] = idx
	}
	return nil
}

func (m *ShardManager) GetShardKey(record core.VectorRecord) string {
	switch m.strategy {
	case StrategyHash:
		return m.hashShardKey(record)
	case StrategyRange:
		return m.rangeShardKey(record)
	case StrategyCategory:
		return m.categoryShardKey(record)
	case StrategyCustom:
		if m.customSharder != nil {
			return m.customSharder(record)
		}
		return m.hashShardKey(record)
	default:
		return m.hashShardKey(record)
	}
}

func (m *ShardManager) hashShardKey(record core.VectorRecord) string {
	var key string

	if m.shardKeyField != "" && record.Metadata != nil {
		if val, ok := record.Metadata[m.shardKeyField]; ok {
			key = fmt.Sprintf("%v", val)
		}
	}

	if key == "" {
		key = string(record.ID)
	}

	h := fnv.New32a()
	h.Write([]byte(key))
	shardNum := h.Sum32() % uint32(m.numShards)
	return fmt.Sprintf("shard_%d", shardNum)
}

func (m *ShardManager) rangeShardKey(record core.VectorRecord) string {
	if m.shardKeyField != "" && record.Metadata != nil {
		if val, ok := record.Metadata[m.shardKeyField].(int); ok {
			shardSize := 1000 / m.numShards
			shardNum := val / shardSize
			if shardNum >= m.numShards {
				shardNum = m.numShards - 1
			}
			return fmt.Sprintf("shard_%d", shardNum)
		}
	}
	return m.hashShardKey(record)
}

func (m *ShardManager) categoryShardKey(record core.VectorRecord) string {
	if m.shardKeyField != "" && record.Metadata != nil {
		if category, ok := record.Metadata[m.shardKeyField].(string); ok {
			h := fnv.New32a()
			h.Write([]byte(category))
			shardNum := h.Sum32() % uint32(m.numShards)
			return fmt.Sprintf("shard_%d", shardNum)
		}
	}
	return m.hashShardKey(record)
}

func (m *ShardManager) Add(ctx context.Context, records []core.VectorRecord) error {
	shardRecords := make(map[string][]core.VectorRecord)

	for _, record := range records {
		shardKey := m.GetShardKey(record)
		record.ShardKey = shardKey
		shardRecords[shardKey] = append(shardRecords[shardKey], record)
	}

	var wg sync.WaitGroup
	errChan := make(chan error, len(shardRecords))

	for shardKey, recs := range shardRecords {
		wg.Add(1)
		go func(key string, r []core.VectorRecord) {
			defer wg.Done()
			m.mu.RLock()
			shard := m.shards[key]
			m.mu.RUnlock()
			if shard != nil {
				if err := shard.Add(ctx, r); err != nil {
					errChan <- err
				}
			}
		}(shardKey, recs)
	}

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil {
			return err
		}
	}

	return nil
}

func (m *ShardManager) Search(ctx context.Context, query core.Vector, topK int) ([]core.SearchResult, error) {
	var wg sync.WaitGroup
	resultChan := make(chan []core.SearchResult, m.numShards)

	m.mu.RLock()
	shards := make([]core.Index, 0, len(m.shards))
	for _, shard := range m.shards {
		shards = append(shards, shard)
	}
	m.mu.RUnlock()

	for _, shard := range shards {
		wg.Add(1)
		go func(s core.Index) {
			defer wg.Done()
			results, err := s.Search(ctx, query, topK)
			if err == nil {
				resultChan <- results
			}
		}(shard)
	}

	wg.Wait()
	close(resultChan)

	allResults := make([]core.SearchResult, 0)
	for results := range resultChan {
		allResults = append(allResults, results...)
	}

	m.mergeResults(allResults, topK)

	return allResults[:min(topK, len(allResults))], nil
}

func (m *ShardManager) SearchSpecificShards(ctx context.Context, query core.Vector, topK int, shardKeys []string) ([]core.SearchResult, error) {
	var wg sync.WaitGroup
	resultChan := make(chan []core.SearchResult, len(shardKeys))

	for _, shardKey := range shardKeys {
		wg.Add(1)
		go func(key string) {
			defer wg.Done()
			m.mu.RLock()
			shard := m.shards[key]
			m.mu.RUnlock()
			if shard != nil {
				results, err := shard.Search(ctx, query, topK)
				if err == nil {
					resultChan <- results
				}
			}
		}(shardKey)
	}

	wg.Wait()
	close(resultChan)

	allResults := make([]core.SearchResult, 0)
	for results := range resultChan {
		allResults = append(allResults, results...)
	}

	m.mergeResults(allResults, topK)

	return allResults[:min(topK, len(allResults))], nil
}

func (m *ShardManager) mergeResults(results []core.SearchResult, topK int) {
	sort.Slice(results, func(i, j int) bool {
		if similarity.IsHigherBetter(m.metricType) {
			return results[i].Score > results[j].Score
		}
		return results[i].Score < results[j].Score
	})
}

func (m *ShardManager) Delete(ctx context.Context, ids []core.VectorID) error {
	m.mu.RLock()
	shards := make([]core.Index, 0, len(m.shards))
	for _, shard := range m.shards {
		shards = append(shards, shard)
	}
	m.mu.RUnlock()

	var wg sync.WaitGroup
	errChan := make(chan error, len(shards))

	for _, shard := range shards {
		wg.Add(1)
		go func(s core.Index) {
			defer wg.Done()
			if err := s.Delete(ctx, ids); err != nil {
				errChan <- err
			}
		}(shard)
	}

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil {
			return err
		}
	}

	return nil
}

func (m *ShardManager) Update(ctx context.Context, records []core.VectorRecord) error {
	if err := m.Delete(ctx, getRecordIDs(records)); err != nil {
		return err
	}
	return m.Add(ctx, records)
}

func (m *ShardManager) Get(ctx context.Context, ids []core.VectorID) ([]core.VectorRecord, error) {
	m.mu.RLock()
	shards := make([]core.Index, 0, len(m.shards))
	for _, shard := range m.shards {
		shards = append(shards, shard)
	}
	m.mu.RUnlock()

	var wg sync.WaitGroup
	resultChan := make(chan []core.VectorRecord, len(shards))

	for _, shard := range shards {
		wg.Add(1)
		go func(s core.Index) {
			defer wg.Done()
			records, err := s.Get(ctx, ids)
			if err == nil {
				resultChan <- records
			}
		}(shard)
	}

	wg.Wait()
	close(resultChan)

	allRecords := make([]core.VectorRecord, 0)
	for records := range resultChan {
		allRecords = append(allRecords, records...)
	}

	return allRecords, nil
}

func (m *ShardManager) Count(ctx context.Context) (int64, error) {
	m.mu.RLock()
	shards := make([]core.Index, 0, len(m.shards))
	for _, shard := range m.shards {
		shards = append(shards, shard)
	}
	m.mu.RUnlock()

	var wg sync.WaitGroup
	countChan := make(chan int64, len(shards))

	for _, shard := range shards {
		wg.Add(1)
		go func(s core.Index) {
			defer wg.Done()
			count, err := s.Count(ctx)
			if err == nil {
				countChan <- count
			}
		}(shard)
	}

	wg.Wait()
	close(countChan)

	var total int64
	for count := range countChan {
		total += count
	}

	return total, nil
}

func (m *ShardManager) GetShardCount(ctx context.Context, shardKey string) (int64, error) {
	m.mu.RLock()
	shard := m.shards[shardKey]
	m.mu.RUnlock()

	if shard == nil {
		return 0, nil
	}

	return shard.Count(ctx)
}

func (m *ShardManager) GetShardKeys() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	keys := make([]string, 0, len(m.shards))
	for k := range m.shards {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func (m *ShardManager) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, shard := range m.shards {
		shard.Close()
	}
	m.shards = nil

	return nil
}

func (m *ShardManager) HashString(s string) string {
	h := sha256.Sum256([]byte(s))
	return fmt.Sprintf("%x", h)
}

func getRecordIDs(records []core.VectorRecord) []core.VectorID {
	ids := make([]core.VectorID, len(records))
	for i, r := range records {
		ids[i] = r.ID
	}
	return ids
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
