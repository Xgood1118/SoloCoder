package faiss

import (
	"context"
	"errors"
	"sync"

	"github.com/vector-proxy/pkg/core"
	"github.com/vector-proxy/pkg/similarity"
)

var (
	ErrFaissNotAvailable = errors.New("faiss not available (CGO disabled or Faiss library not found")
)

type FaissIndexType string

const (
	IndexFlatL2       FaissIndexType = "FlatL2"
	IndexFlatIP       FaissIndexType = "FlatIP"
	IndexIVFFlat       FaissIndexType = "IVFFlat"
	IndexIVFPQ        FaissIndexType = "IVFPQ"
	IndexHNSWFlat      FaissIndexType = "HNSWFlat"
	IndexHNSWSQ8      FaissIndexType = "HNSWSQ8"
)

type FaissConfig struct {
	IndexType      FaissIndexType
	Dimension      int
	MetricType     core.MetricType
	NList          int
	NProbe          int
	M               int
	EFConstruction  int
	EFSearch        int
	UseGPU          bool
	AutoTrain       bool
	TrainThreshold  int
}

func NewDefaultConfig(dimension int, metric core.MetricType) FaissConfig {
	return FaissConfig{
		IndexType:     IndexFlatIP,
		Dimension:     dimension,
		MetricType:    metric,
		NList:         100,
		NProbe:        10,
		M:             16,
		EFConstruction: 200,
		EFSearch:       50,
		UseGPU:        false,
		AutoTrain:     true,
		TrainThreshold: 1000,
	}
}

type FaissIndex struct {
	mu           sync.RWMutex
	config       FaissConfig
	records      map[core.VectorID]core.VectorRecord
	idMap        map[core.VectorID]int
	vectors      []core.Vector
	nextID       int
	trained      bool
	distanceFunc similarity.DistanceFunc
	metricType   core.MetricType
	needsRebuild bool
	rebuildCount int
}

type scorePair struct {
	idx   int
	score float32
}

func NewIndex(config FaissConfig) (*FaissIndex, error) {
	return &FaissIndex{
		config:       config,
		records:      make(map[core.VectorID]core.VectorRecord),
		idMap:        make(map[core.VectorID]int),
		vectors:      make([]core.Vector, 0),
		nextID:       0,
		trained:      false,
		distanceFunc: similarity.GetDistanceFunc(config.MetricType),
		metricType:   config.MetricType,
		needsRebuild: false,
		rebuildCount: 0,
	}, nil
}

func (f *FaissIndex) Add(ctx context.Context, records []core.VectorRecord) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, record := range records {
		if len(record.Vector) != f.config.Dimension {
			continue
		}

		if _, exists := f.records[record.ID]; exists {
			continue
		}

		idx := f.nextID
		f.nextID++

		f.records[record.ID] = record
		f.idMap[record.ID] = idx
		f.vectors = append(f.vectors, append(core.Vector(nil), record.Vector...))
	}

	if f.config.AutoTrain && !f.trained && len(f.vectors) >= f.config.TrainThreshold {
		f.train()
	}

	f.needsRebuild = true

	return nil
}

func (f *FaissIndex) train() {
	f.trained = true
}

func (f *FaissIndex) Search(ctx context.Context, query core.Vector, topK int) ([]core.SearchResult, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	scores := make([]scorePair, 0, len(f.vectors))

	for i, vec := range f.vectors {
		score := f.distanceFunc(query, vec)
		scores = append(scores, scorePair{i, score})
	}

	f.sortScores(scores)

	k := min(topK, len(scores))
	results := make([]core.SearchResult, 0, k)

	for i := 0; i < k; i++ {
		idx := scores[i].idx
		var record core.VectorRecord
		for id, mapIdx := range f.idMap {
			if mapIdx == idx {
				record = f.records[id]
				results = append(results, core.SearchResult{
					ID:       id,
					Vector:   record.Vector,
					Score:    scores[i].score,
					Metadata: record.Metadata,
				})
				break
			}
		}
	}

	return results, nil
}

func (f *FaissIndex) Delete(ctx context.Context, ids []core.VectorID) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	for _, id := range ids {
		if _, exists := f.records[id]; exists {
			delete(f.records, id)
			delete(f.idMap, id)
			f.needsRebuild = true
		}
	}

	return nil
}

func (f *FaissIndex) Update(ctx context.Context, records []core.VectorRecord) error {
	if err := f.Delete(ctx, getRecordIDs(records)); err != nil {
		return err
	}
	return f.Add(ctx, records)
}

func (f *FaissIndex) Get(ctx context.Context, ids []core.VectorID) ([]core.VectorRecord, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	results := make([]core.VectorRecord, 0, len(ids))
	for _, id := range ids {
		if record, exists := f.records[id]; exists {
			results = append(results, record)
		}
	}

	return results, nil
}

func (f *FaissIndex) Count(ctx context.Context) (int64, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return int64(len(f.records)), nil
}

func (f *FaissIndex) Rebuild() error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.rebuildCount++
	f.needsRebuild = false

	return nil
}

func (f *FaissIndex) NeedsRebuild() bool {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.needsRebuild
}

func (f *FaissIndex) Close() error {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.records = nil
	f.idMap = nil
	f.vectors = nil

	return nil
}

func (f *FaissIndex) sortScores(scores []scorePair) {
	for i := range scores {
		for j := i + 1; j < len(scores); j++ {
			shouldSwap := false
			if similarity.IsHigherBetter(f.metricType) {
				if scores[j].score > scores[i].score {
					shouldSwap = true
				}
			} else {
				if scores[j].score < scores[i].score {
					shouldSwap = true
				}
			}
			if shouldSwap {
				scores[i], scores[j] = scores[j], scores[i]
			}
		}
	}
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
