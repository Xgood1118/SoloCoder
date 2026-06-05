package normalizer

import (
	"errors"
	"math"

	"github.com/vector-proxy/pkg/core"
)

var (
	ErrZeroVector = errors.New("cannot normalize zero vector")
)

type Normalizer interface {
	Normalize(v core.Vector) (core.Vector, error)
	NormalizeInPlace(v core.Vector) error
	IsNormalized(v core.Vector) bool
}

type L2Normalizer struct{}

func NewL2Normalizer() *L2Normalizer {
	return &L2Normalizer{}
}

func (n *L2Normalizer) Normalize(v core.Vector) (core.Vector, error) {
	norm := float32(0.0)
	for _, val := range v {
		norm += val * val
	}
	norm = float32(math.Sqrt(float64(norm)))

	if norm == 0 {
		return nil, ErrZeroVector
	}

	result := make(core.Vector, len(v))
	for i, val := range v {
		result[i] = val / norm
	}

	return result, nil
}

func (n *L2Normalizer) NormalizeInPlace(v core.Vector) error {
	norm := float32(0.0)
	for _, val := range v {
		norm += val * val
	}
	norm = float32(math.Sqrt(float64(norm)))

	if norm == 0 {
		return ErrZeroVector
	}

	for i := range v {
		v[i] = v[i] / norm
	}

	return nil
}

func (n *L2Normalizer) IsNormalized(v core.Vector) bool {
	norm := float32(0.0)
	for _, val := range v {
		norm += val * val
	}
	return math.Abs(float64(norm)-1.0) < 1e-6
}

func NormalizeRecords(records []core.VectorRecord) error {
	normalizer := NewL2Normalizer()
	for i := range records {
		if err := normalizer.NormalizeInPlace(records[i].Vector); err != nil {
			return err
		}
	}
	return nil
}
