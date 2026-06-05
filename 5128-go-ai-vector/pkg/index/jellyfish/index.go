package jellyfish

import (
	"context"
	"sort"
	"sync"

	"github.com/vector-proxy/pkg/core"
)

type StringMetric string

const (
	MetricLevenshtein    StringMetric = "levenshtein"
	MetricJaroWinkler    StringMetric = "jaro_winkler"
	MetricHamming        StringMetric = "hamming"
	MetricJaccard        StringMetric = "jaccard"
	MetricCosineText     StringMetric = "cosine_text"
)

type JellyfishIndex struct {
	mu           sync.RWMutex
	records      map[core.VectorID]core.VectorRecord
	metric       StringMetric
	stringField  string
}

func NewIndex(metric StringMetric, stringField string) *JellyfishIndex {
	return &JellyfishIndex{
		records:     make(map[core.VectorID]core.VectorRecord),
		metric:      metric,
		stringField: stringField,
	}
}

func (j *JellyfishIndex) Add(ctx context.Context, records []core.VectorRecord) error {
	j.mu.Lock()
	defer j.mu.Unlock()

	for _, record := range records {
		j.records[record.ID] = record
	}

	return nil
}

func (j *JellyfishIndex) Search(ctx context.Context, query core.Vector, topK int) ([]core.SearchResult, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()

	queryStr := vectorToString(query)

	type pair struct {
		id    core.VectorID
		score float32
	}

	scores := make([]pair, 0, len(j.records))

	for id, record := range j.records {
		targetStr := j.getString(record)
		score := j.calculateScore(queryStr, targetStr)
		scores = append(scores, pair{id, score})
	}

	sort.Slice(scores, func(i, k int) bool {
		return scores[i].score > scores[k].score
	})

	k := min(topK, len(scores))
	results := make([]core.SearchResult, 0, k)
	for i := 0; i < k; i++ {
		record := j.records[scores[i].id]
		results = append(results, core.SearchResult{
			ID:       record.ID,
			Vector:   record.Vector,
			Score:    scores[i].score,
			Metadata: record.Metadata,
		})
	}

	return results, nil
}

func (j *JellyfishIndex) SearchByString(ctx context.Context, query string, topK int) ([]core.SearchResult, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()

	type pair struct {
		id    core.VectorID
		score float32
	}

	scores := make([]pair, 0, len(j.records))

	for id, record := range j.records {
		targetStr := j.getString(record)
		score := j.calculateScore(query, targetStr)
		scores = append(scores, pair{id, score})
	}

	sort.Slice(scores, func(i, k int) bool {
		return scores[i].score > scores[k].score
	})

	k := min(topK, len(scores))
	results := make([]core.SearchResult, 0, k)
	for i := 0; i < k; i++ {
		record := j.records[scores[i].id]
		results = append(results, core.SearchResult{
			ID:       record.ID,
			Vector:   record.Vector,
			Score:    scores[i].score,
			Metadata: record.Metadata,
		})
	}

	return results, nil
}

func (j *JellyfishIndex) Delete(ctx context.Context, ids []core.VectorID) error {
	j.mu.Lock()
	defer j.mu.Unlock()

	for _, id := range ids {
		delete(j.records, id)
	}

	return nil
}

func (j *JellyfishIndex) Update(ctx context.Context, records []core.VectorRecord) error {
	j.mu.Lock()
	defer j.mu.Unlock()

	for _, record := range records {
		j.records[record.ID] = record
	}

	return nil
}

func (j *JellyfishIndex) Get(ctx context.Context, ids []core.VectorID) ([]core.VectorRecord, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()

	results := make([]core.VectorRecord, 0, len(ids))
	for _, id := range ids {
		if record, exists := j.records[id]; exists {
			results = append(results, record)
		}
	}

	return results, nil
}

func (j *JellyfishIndex) Count(ctx context.Context) (int64, error) {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return int64(len(j.records)), nil
}

func (j *JellyfishIndex) Close() error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.records = nil
	return nil
}

func (j *JellyfishIndex) getString(record core.VectorRecord) string {
	if j.stringField != "" && record.Metadata != nil {
		if val, ok := record.Metadata[j.stringField]; ok {
			if s, ok := val.(string); ok {
				return s
			}
		}
	}
	return vectorToString(record.Vector)
}

func (j *JellyfishIndex) calculateScore(a, b string) float32 {
	switch j.metric {
	case MetricLevenshtein:
		return levenshteinSimilarity(a, b)
	case MetricJaroWinkler:
		return jaroWinklerSimilarity(a, b)
	case MetricHamming:
		return hammingSimilarity(a, b)
	case MetricJaccard:
		return jaccardSimilarity(a, b)
	case MetricCosineText:
		return cosineTextSimilarity(a, b)
	default:
		return levenshteinSimilarity(a, b)
	}
}

func vectorToString(v core.Vector) string {
	runes := make([]rune, len(v))
	for i, val := range v {
		runes[i] = rune(int(val))
	}
	return string(runes)
}

func levenshteinDistance(a, b string) int {
	if len(a) == 0 {
		return len(b)
	}
	if len(b) == 0 {
		return len(a)
	}

	matrix := make([][]int, len(a)+1)
	for i := range matrix {
		matrix[i] = make([]int, len(b)+1)
		matrix[i][0] = i
	}
	for j := 1; j <= len(b); j++ {
		matrix[0][j] = j
	}

	for i := 1; i <= len(a); i++ {
		for j := 1; j <= len(b); j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			matrix[i][j] = min3(
				matrix[i-1][j]+1,
				matrix[i][j-1]+1,
				matrix[i-1][j-1]+cost,
			)
		}
	}

	return matrix[len(a)][len(b)]
}

func levenshteinSimilarity(a, b string) float32 {
	if a == b {
		return 1.0
	}
	maxLen := max(len(a), len(b))
	if maxLen == 0 {
		return 1.0
	}
	distance := levenshteinDistance(a, b)
	return 1.0 - float32(distance)/float32(maxLen)
}

func jaroWinklerSimilarity(s1, s2 string) float32 {
	if s1 == s2 {
		return 1.0
	}

	len1 := len(s1)
	len2 := len(s2)

	if len1 == 0 || len2 == 0 {
		return 0
	}

	matchDistance := max(len1, len2)/2 - 1
	if matchDistance < 0 {
		matchDistance = 0
	}

	matches1 := make([]bool, len1)
	matches2 := make([]bool, len2)

	matches := 0
	transpositions := 0

	for i := 0; i < len1; i++ {
		start := max(0, i-matchDistance)
		end := min(len2-1, i+matchDistance)

		for j := start; j <= end; j++ {
			if matches2[j] {
				continue
			}
			if s1[i] != s2[j] {
				continue
			}
			matches1[i] = true
			matches2[j] = true
			matches++
			break
		}
	}

	if matches == 0 {
		return 0
	}

	k := 0
	for i := 0; i < len1; i++ {
		if !matches1[i] {
			continue
		}
		for !matches2[k] {
			k++
		}
		if s1[i] != s2[k] {
			transpositions++
		}
		k++
	}

	jaro := (float32(matches)/float32(len1) +
		float32(matches)/float32(len2) +
		float32(matches-transpositions/2)/float32(matches)) / 3.0

	prefix := 0
	maxPrefix := min(4, min(len1, len2))
	for i := 0; i < maxPrefix; i++ {
		if s1[i] == s2[i] {
			prefix++
		} else {
			break
		}
	}

	return jaro + float32(prefix)*0.1*(1.0-jaro)
}

func hammingSimilarity(a, b string) float32 {
	if len(a) != len(b) {
		return 0
	}
	differences := 0
	for i := 0; i < len(a); i++ {
		if a[i] != b[i] {
			differences++
		}
	}
	return 1.0 - float32(differences)/float32(len(a))
}

func jaccardSimilarity(a, b string) float32 {
	setA := make(map[rune]bool)
	setB := make(map[rune]bool)

	for _, c := range a {
		setA[c] = true
	}
	for _, c := range b {
		setB[c] = true
	}

	intersection := 0
	for c := range setA {
		if setB[c] {
			intersection++
		}
	}

	union := len(setA) + len(setB) - intersection
	if union == 0 {
		return 1.0
	}

	return float32(intersection) / float32(union)
}

func cosineTextSimilarity(a, b string) float32 {
	freqA := make(map[rune]int)
	freqB := make(map[rune]int)

	for _, c := range a {
		freqA[c]++
	}
	for _, c := range b {
		freqB[c]++
	}

	var dotProduct, normA, normB float32
	for c, count := range freqA {
		normA += float32(count * count)
		if countB, ok := freqB[c]; ok {
			dotProduct += float32(count * countB)
		}
	}

	for _, count := range freqB {
		normB += float32(count * count)
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return dotProduct / (sqrt(normA) * sqrt(normB))
}

func min3(a, b, c int) int {
	return min(min(a, b), c)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func sqrt(x float32) float32 {
	return float32(1.0)
}
