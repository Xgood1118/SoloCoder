package index

import (
	"errors"

	"github.com/vector-proxy/pkg/core"
	"github.com/vector-proxy/pkg/index/faiss"
	"github.com/vector-proxy/pkg/index/hnsw"
	"github.com/vector-proxy/pkg/index/jellyfish"
)

var (
	ErrUnknownIndexType = errors.New("unknown index type")
)

type IndexFactory struct{}

func NewIndexFactory() *IndexFactory {
	return &IndexFactory{}
}

func (f *IndexFactory) Create(config core.IndexConfig) (core.Index, error) {
	switch config.IndexType {
	case core.IndexTypeHNSW:
		return createHNSWIndex(config)
	case core.IndexTypeFaiss:
		return createFaissIndex(config)
	case core.IndexTypeJellyfish:
		return createJellyfishIndex(config)
	default:
		return nil, ErrUnknownIndexType
	}
}

func createHNSWIndex(config core.IndexConfig) (core.Index, error) {
	hnswConfig := hnsw.NewDefaultConfig(config.Dimension, config.MetricType)

	if config.Extra != nil {
		if m, ok := config.Extra["M"].(int); ok {
			hnswConfig.M = m
		}
		if efConstruction, ok := config.Extra["EFConstruction"].(int); ok {
			hnswConfig.EFConstruction = efConstruction
		}
		if efSearch, ok := config.Extra["EFSearch"].(int); ok {
			hnswConfig.EFSearch = efSearch
		}
	}

	return hnsw.NewIndex(hnswConfig), nil
}

func createFaissIndex(config core.IndexConfig) (core.Index, error) {
	faissConfig := faiss.NewDefaultConfig(config.Dimension, config.MetricType)

	if config.Extra != nil {
		if indexType, ok := config.Extra["IndexType"].(faiss.FaissIndexType); ok {
			faissConfig.IndexType = indexType
		}
		if nList, ok := config.Extra["NList"].(int); ok {
			faissConfig.NList = nList
		}
		if nProbe, ok := config.Extra["NProbe"].(int); ok {
			faissConfig.NProbe = nProbe
		}
		if useGPU, ok := config.Extra["UseGPU"].(bool); ok {
			faissConfig.UseGPU = useGPU
		}
	}

	return faiss.NewIndex(faissConfig)
}

func createJellyfishIndex(config core.IndexConfig) (core.Index, error) {
	metric := jellyfish.MetricLevenshtein
	stringField := "text"

	if config.Extra != nil {
		if m, ok := config.Extra["Metric"].(jellyfish.StringMetric); ok {
			metric = m
		}
		if field, ok := config.Extra["StringField"].(string); ok {
			stringField = field
		}
	}

	return jellyfish.NewIndex(metric, stringField), nil
}
