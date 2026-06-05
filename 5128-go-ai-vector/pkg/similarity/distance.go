package similarity

import (
	"math"

	"github.com/vector-proxy/pkg/core"
)

type DistanceFunc func(a, b core.Vector) float32

func CosineSimilarity(a, b core.Vector) float32 {
	if len(a) != len(b) {
		return 0
	}

	var dotProduct, normA, normB float32
	for i := range a {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return dotProduct / (float32(math.Sqrt(float64(normA))) * float32(math.Sqrt(float64(normB))))
}

func EuclideanDistance(a, b core.Vector) float32 {
	if len(a) != len(b) {
		return float32(math.Inf(1))
	}

	var sum float32
	for i := range a {
		diff := a[i] - b[i]
		sum += diff * diff
	}

	return float32(math.Sqrt(float64(sum)))
}

func InnerProduct(a, b core.Vector) float32 {
	if len(a) != len(b) {
		return 0
	}

	var sum float32
	for i := range a {
		sum += a[i] * b[i]
	}

	return sum
}

func GetDistanceFunc(metric core.MetricType) DistanceFunc {
	switch metric {
	case core.MetricCosine:
		return CosineSimilarity
	case core.MetricEuclidean:
		return EuclideanDistance
	case core.MetricIP:
		return InnerProduct
	default:
		return CosineSimilarity
	}
}

func IsHigherBetter(metric core.MetricType) bool {
	switch metric {
	case core.MetricEuclidean:
		return false
	case core.MetricCosine, core.MetricIP:
		return true
	default:
		return true
	}
}
