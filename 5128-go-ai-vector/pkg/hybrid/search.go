package hybrid

import (
	"context"
	"sort"
	"strings"
	"sync"

	"github.com/vector-proxy/pkg/core"
	"github.com/vector-proxy/pkg/index/jellyfish"
	"github.com/vector-proxy/pkg/similarity"
)

type MergeType string

const (
	MergeUnion        MergeType = "union"
	MergeIntersection MergeType = "intersection"
	MergeWeighted     MergeType = "weighted"
)

type HybridSearcher struct {
	vectorIndex    core.Index
	textIndex      *jellyfish.JellyfishIndex
	textFields     []string
	mergeType      MergeType
	vectorWeight   float32
	textWeight     float32
	metricType     core.MetricType
}

type HybridConfig struct {
	VectorIndex   core.Index
	TextIndex     *jellyfish.JellyfishIndex
	TextFields    []string
	MergeType     MergeType
	VectorWeight  float32
	TextWeight    float32
	MetricType    core.MetricType
}

func NewHybridSearcher(config HybridConfig) *HybridSearcher {
	if config.VectorWeight == 0 {
		config.VectorWeight = 0.7
	}
	if config.TextWeight == 0 {
		config.TextWeight = 0.3
	}
	if config.MetricType == "" {
		config.MetricType = core.MetricCosine
	}

	return &HybridSearcher{
		vectorIndex:  config.VectorIndex,
		textIndex:    config.TextIndex,
		textFields:   config.TextFields,
		mergeType:    config.MergeType,
		vectorWeight: config.VectorWeight,
		textWeight:   config.TextWeight,
		metricType:   config.MetricType,
	}
}

type Query struct {
	Vector    core.Vector
	Text      string
	TopK      int
	MergeType MergeType
}

func (h *HybridSearcher) Search(ctx context.Context, query Query) ([]core.SearchResult, error) {
	var vectorResults, textResults []core.SearchResult
	var vectorErr, textErr error

	var wg sync.WaitGroup

	if query.Vector != nil && h.vectorIndex != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			vectorResults, vectorErr = h.vectorIndex.Search(ctx, query.Vector, query.TopK*2)
		}()
	}

	if query.Text != "" && h.textIndex != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			textResults, textErr = h.textIndex.SearchByString(ctx, query.Text, query.TopK*2)
		}()
	}

	wg.Wait()

	if vectorErr != nil {
		return nil, vectorErr
	}
	if textErr != nil {
		return nil, textErr
	}

	mergeType := query.MergeType
	if mergeType == "" {
		mergeType = h.mergeType
	}

	var results []core.SearchResult
	switch mergeType {
	case MergeUnion:
		results = h.mergeUnion(vectorResults, textResults, query.TopK)
	case MergeIntersection:
		results = h.mergeIntersection(vectorResults, textResults, query.TopK)
	case MergeWeighted:
		results = h.mergeWeighted(vectorResults, textResults, query.TopK)
	default:
		results = h.mergeWeighted(vectorResults, textResults, query.TopK)
	}

	return results, nil
}

func (h *HybridSearcher) mergeUnion(vectorResults, textResults []core.SearchResult, topK int) []core.SearchResult {
	combined := make(map[core.VectorID]core.SearchResult)

	for _, r := range vectorResults {
		combined[r.ID] = r
	}

	for _, r := range textResults {
		if existing, ok := combined[r.ID]; ok {
			avgScore := (existing.Score + r.Score) / 2
			combined[r.ID] = core.SearchResult{
				ID:       r.ID,
				Vector:   r.Vector,
				Score:    avgScore,
				Metadata: r.Metadata,
			}
		} else {
			combined[r.ID] = r
		}
	}

	results := make([]core.SearchResult, 0, len(combined))
	for _, r := range combined {
		results = append(results, r)
	}

	h.sortResults(results)

	return results[:min(topK, len(results))]
}

func (h *HybridSearcher) mergeIntersection(vectorResults, textResults []core.SearchResult, topK int) []core.SearchResult {
	vectorMap := make(map[core.VectorID]core.SearchResult)
	for _, r := range vectorResults {
		vectorMap[r.ID] = r
	}

	results := make([]core.SearchResult, 0)
	for _, r := range textResults {
		if vectorR, ok := vectorMap[r.ID]; ok {
			avgScore := (vectorR.Score + r.Score) / 2
			results = append(results, core.SearchResult{
				ID:       r.ID,
				Vector:   r.Vector,
				Score:    avgScore,
				Metadata: r.Metadata,
			})
		}
	}

	h.sortResults(results)

	return results[:min(topK, len(results))]
}

func (h *HybridSearcher) mergeWeighted(vectorResults, textResults []core.SearchResult, topK int) []core.SearchResult {
	combined := make(map[core.VectorID]*weightedResult)

	for _, r := range vectorResults {
		combined[r.ID] = &weightedResult{
			result:      r,
			vectorScore: r.Score,
			textScore:   -1,
		}
	}

	for _, r := range textResults {
		if wr, ok := combined[r.ID]; ok {
			wr.textScore = r.Score
			wr.result = r
		} else {
			combined[r.ID] = &weightedResult{
				result:      r,
				vectorScore: -1,
				textScore:   r.Score,
			}
		}
	}

	results := make([]core.SearchResult, 0, len(combined))
	for _, wr := range combined {
		score := h.calculateWeightedScore(wr.vectorScore, wr.textScore)
		results = append(results, core.SearchResult{
			ID:       wr.result.ID,
			Vector:   wr.result.Vector,
			Score:    score,
			Metadata: wr.result.Metadata,
		})
	}

	h.sortResults(results)

	return results[:min(topK, len(results))]
}

type weightedResult struct {
	result      core.SearchResult
	vectorScore float32
	textScore   float32
}

func (h *HybridSearcher) calculateWeightedScore(vectorScore, textScore float32) float32 {
	hasVector := vectorScore >= 0
	hasText := textScore >= 0

	if hasVector && hasText {
		return vectorScore*h.vectorWeight + textScore*h.textWeight
	}

	if hasVector {
		return vectorScore
	}

	if hasText {
		return textScore
	}

	return 0
}

func (h *HybridSearcher) sortResults(results []core.SearchResult) {
	sort.Slice(results, func(i, j int) bool {
		if similarity.IsHigherBetter(h.metricType) {
			return results[i].Score > results[j].Score
		}
		return results[i].Score < results[j].Score
	})
}

func (h *HybridSearcher) Add(ctx context.Context, records []core.VectorRecord) error {
	var wg sync.WaitGroup
	errChan := make(chan error, 2)

	if h.vectorIndex != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := h.vectorIndex.Add(ctx, records); err != nil {
				errChan <- err
			}
		}()
	}

	if h.textIndex != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := h.textIndex.Add(ctx, records); err != nil {
				errChan <- err
			}
		}()
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

func (h *HybridSearcher) Delete(ctx context.Context, ids []core.VectorID) error {
	var wg sync.WaitGroup
	errChan := make(chan error, 2)

	if h.vectorIndex != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := h.vectorIndex.Delete(ctx, ids); err != nil {
				errChan <- err
			}
		}()
	}

	if h.textIndex != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := h.textIndex.Delete(ctx, ids); err != nil {
				errChan <- err
			}
		}()
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

func (h *HybridSearcher) ExtractKeywords(text string) []string {
	text = strings.ToLower(text)
	words := strings.Fields(text)

	stopwords := map[string]bool{
		"the": true, "a": true, "an": true, "and": true,
		"or": true, "but": true, "in": true, "on": true,
		"at": true, "to": true, "for": true, "of": true,
		"with": true, "by": true, "from": true, "is": true,
		"are": true, "was": true, "were": true, "be": true,
	}

	keywords := make([]string, 0)
	for _, word := range words {
		if !stopwords[word] && len(word) > 2 {
			keywords = append(keywords, word)
		}
	}

	return keywords
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
