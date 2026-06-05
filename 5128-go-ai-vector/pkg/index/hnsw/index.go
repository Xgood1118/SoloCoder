package hnsw

import (
	"context"
	"math"
	"math/rand"
	"sort"
	"sync"
	"time"

	"github.com/vector-proxy/pkg/core"
	"github.com/vector-proxy/pkg/similarity"
)

type node struct {
	id       core.VectorID
	vector   core.Vector
	metadata core.Metadata
	layers   [][]int
}

type HNSWIndex struct {
	mu           sync.RWMutex
	nodes        map[core.VectorID]*node
	idToIndex    map[core.VectorID]int
	indexToID    map[int]core.VectorID
	vectors      []core.Vector
	distanceFunc similarity.DistanceFunc
	metricType   core.MetricType
	dimension    int
	M            int
	Mmax         int
	Mmax0        int
	efConstruction int
	efSearch     int
	levelMult    float64
	enterPoint   int
	maxLevel     int
	nextIndex    int
}

type Config struct {
	M               int
	EFConstruction  int
	EFSearch        int
	MetricType      core.MetricType
	Dimension       int
}

func NewDefaultConfig(dimension int, metric core.MetricType) Config {
	return Config{
		M:               16,
		EFConstruction:  100,
		EFSearch:        50,
		MetricType:      metric,
		Dimension:       dimension,
	}
}

func NewIndex(config Config) *HNSWIndex {
	levelMult := 1 / math.Log(float64(config.M))
	
	return &HNSWIndex{
		nodes:          make(map[core.VectorID]*node),
		idToIndex:      make(map[core.VectorID]int),
		indexToID:      make(map[int]core.VectorID),
		vectors:        make([]core.Vector, 0),
		distanceFunc:   similarity.GetDistanceFunc(config.MetricType),
		metricType:     config.MetricType,
		dimension:      config.Dimension,
		M:              config.M,
		Mmax:           config.M,
		Mmax0:          config.M * 2,
		efConstruction: config.EFConstruction,
		efSearch:       config.EFSearch,
		levelMult:      levelMult,
		enterPoint:     -1,
		maxLevel:       -1,
		nextIndex:      0,
	}
}

func (h *HNSWIndex) randomLevel() int {
	r := rand.Float64()
	level := int(-math.Log(r) * h.levelMult)
	return level
}

func (h *HNSWIndex) searchLayer(query core.Vector, ep int, ef int, level int) []int {
	type candidate struct {
		idx  int
		dist float32
	}

	visited := make(map[int]bool)
	visited[ep] = true

	epDist := h.distanceFunc(query, h.vectors[ep])

	candidates := []candidate{{ep, epDist}}
	results := []candidate{{ep, epDist}}

	for len(candidates) > 0 {
		minC := 0
		for i := 1; i < len(candidates); i++ {
			if similarity.IsHigherBetter(h.metricType) {
				if candidates[i].dist > candidates[minC].dist {
					minC = i
				}
			} else {
				if candidates[i].dist < candidates[minC].dist {
					minC = i
				}
			}
		}

		c := candidates[minC]
		candidates = append(candidates[:minC], candidates[minC+1:]...)

		worstR := 0
		for i := 1; i < len(results); i++ {
			if similarity.IsHigherBetter(h.metricType) {
				if results[i].dist < results[worstR].dist {
					worstR = i
				}
			} else {
				if results[i].dist > results[worstR].dist {
					worstR = i
				}
			}
		}

		if similarity.IsHigherBetter(h.metricType) {
			if c.dist < results[worstR].dist {
				break
			}
		} else {
			if c.dist > results[worstR].dist {
				break
			}
		}

		n := h.nodes[h.indexToID[c.idx]]
		if level >= len(n.layers) {
			continue
		}

		for _, neighbor := range n.layers[level] {
			if !visited[neighbor] {
				visited[neighbor] = true
				dist := h.distanceFunc(query, h.vectors[neighbor])

				if len(results) < ef {
					results = append(results, candidate{neighbor, dist})
					candidates = append(candidates, candidate{neighbor, dist})
				} else {
					worstR := 0
					for i := 1; i < len(results); i++ {
						if similarity.IsHigherBetter(h.metricType) {
							if results[i].dist < results[worstR].dist {
								worstR = i
							}
						} else {
							if results[i].dist > results[worstR].dist {
								worstR = i
							}
						}
					}

					shouldInsert := false
					if similarity.IsHigherBetter(h.metricType) {
						shouldInsert = dist > results[worstR].dist
					} else {
						shouldInsert = dist < results[worstR].dist
					}

					if shouldInsert {
						results[worstR] = candidate{neighbor, dist}
						candidates = append(candidates, candidate{neighbor, dist})
					}
				}
			}
		}
	}

	ids := make([]int, len(results))
	for i, r := range results {
		ids[i] = r.idx
	}
	return ids
}

func (h *HNSWIndex) selectNeighbors(query core.Vector, candidates []int, M int, level int) []int {
	type pair struct {
		idx  int
		dist float32
	}
	
	pairs := make([]pair, 0, len(candidates))
	for _, c := range candidates {
		dist := h.distanceFunc(query, h.vectors[c])
		pairs = append(pairs, pair{c, dist})
	}
	
	sort.Slice(pairs, func(i, j int) bool {
		if similarity.IsHigherBetter(h.metricType) {
			return pairs[i].dist > pairs[j].dist
		}
		return pairs[i].dist < pairs[j].dist
	})
	
	result := make([]int, 0, M)
	for i := 0; i < min(M, len(pairs)); i++ {
		result = append(result, pairs[i].idx)
	}
	
	return result
}

func (h *HNSWIndex) Add(ctx context.Context, records []core.VectorRecord) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	
	rand.Seed(time.Now().UnixNano())
	
	for _, record := range records {
		if len(record.Vector) != h.dimension {
			continue
		}
		
		if _, exists := h.nodes[record.ID]; exists {
			continue
		}
		
		idx := h.nextIndex
		h.nextIndex++
		
		node := &node{
			id:       record.ID,
			vector:   append(core.Vector(nil), record.Vector...),
			metadata: record.Metadata,
			layers:   make([][]int, 0),
		}
		
		h.nodes[record.ID] = node
		h.idToIndex[record.ID] = idx
		h.indexToID[idx] = record.ID
		h.vectors = append(h.vectors, node.vector)
		
		newLevel := h.randomLevel()
		for i := 0; i <= newLevel; i++ {
			node.layers = append(node.layers, make([]int, 0))
		}
		
		if h.enterPoint == -1 {
			h.enterPoint = idx
			h.maxLevel = newLevel
			continue
		}
		
		ep := h.enterPoint
		for level := h.maxLevel; level > newLevel; level-- {
			eps := h.searchLayer(record.Vector, ep, 1, level)
			if len(eps) > 0 {
				ep = eps[0]
			}
		}
		
		for level := min(newLevel, h.maxLevel); level >= 0; level-- {
			neighbors := h.searchLayer(record.Vector, ep, h.efConstruction, level)
			selected := h.selectNeighbors(record.Vector, neighbors, h.M, level)
			
			node.layers[level] = append(node.layers[level], selected...)
			
			for _, n := range selected {
				neighborNode := h.nodes[h.indexToID[n]]
				neighborNode.layers[level] = append(neighborNode.layers[level], idx)
				
				maxConn := h.Mmax
				if level == 0 {
					maxConn = h.Mmax0
				}
				
				if len(neighborNode.layers[level]) > maxConn {
					newNeighbors := h.selectNeighbors(h.vectors[n], neighborNode.layers[level], maxConn, level)
					neighborNode.layers[level] = newNeighbors
				}
			}
			
			if len(selected) > 0 {
				ep = selected[0]
			}
		}
		
		if newLevel > h.maxLevel {
			h.enterPoint = idx
			h.maxLevel = newLevel
		}
	}
	
	return nil
}

func (h *HNSWIndex) Search(ctx context.Context, query core.Vector, topK int) ([]core.SearchResult, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	
	if h.enterPoint == -1 {
		return []core.SearchResult{}, nil
	}
	
	ep := h.enterPoint
	for level := h.maxLevel; level > 0; level-- {
		eps := h.searchLayer(query, ep, 1, level)
		if len(eps) > 0 {
			ep = eps[0]
		}
	}
	
	candidates := h.searchLayer(query, ep, h.efSearch, 0)
	
	type pair struct {
		idx  int
		dist float32
	}
	pairs := make([]pair, 0, len(candidates))
	for _, c := range candidates {
		dist := h.distanceFunc(query, h.vectors[c])
		pairs = append(pairs, pair{c, dist})
	}
	
	sort.Slice(pairs, func(i, j int) bool {
		if similarity.IsHigherBetter(h.metricType) {
			return pairs[i].dist > pairs[j].dist
		}
		return pairs[i].dist < pairs[j].dist
	})
	
	k := min(topK, len(pairs))
	results := make([]core.SearchResult, 0, k)
	for i := 0; i < k; i++ {
		idx := pairs[i].idx
		id := h.indexToID[idx]
		node := h.nodes[id]
		results = append(results, core.SearchResult{
			ID:       id,
			Vector:   node.vector,
			Score:    pairs[i].dist,
			Metadata: node.metadata,
		})
	}
	
	return results, nil
}

func (h *HNSWIndex) Delete(ctx context.Context, ids []core.VectorID) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	
	for _, id := range ids {
		if _, exists := h.nodes[id]; !exists {
			continue
		}
		delete(h.nodes, id)
	}
	
	return nil
}

func (h *HNSWIndex) Update(ctx context.Context, records []core.VectorRecord) error {
	if err := h.Delete(ctx, getRecordIDs(records)); err != nil {
		return err
	}
	return h.Add(ctx, records)
}

func (h *HNSWIndex) Get(ctx context.Context, ids []core.VectorID) ([]core.VectorRecord, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	
	results := make([]core.VectorRecord, 0, len(ids))
	for _, id := range ids {
		if node, exists := h.nodes[id]; exists {
			results = append(results, core.VectorRecord{
				ID:       node.id,
				Vector:   node.vector,
				Metadata: node.metadata,
			})
		}
	}
	
	return results, nil
}

func (h *HNSWIndex) Count(ctx context.Context) (int64, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return int64(len(h.nodes)), nil
}

func (h *HNSWIndex) Close() error {
	h.mu.Lock()
	defer h.mu.Unlock()
	
	h.nodes = nil
	h.vectors = nil
	h.idToIndex = nil
	h.indexToID = nil
	
	return nil
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
