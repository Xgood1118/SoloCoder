package core

import (
	"context"
	"time"
)

type Vector []float32

type VectorID string

type Metadata map[string]interface{}

type IndexType string

const (
	IndexTypeHNSW      IndexType = "hnsw"
	IndexTypeFaiss     IndexType = "faiss"
	IndexTypeJellyfish IndexType = "jellyfish"
)

type MetricType string

const (
	MetricCosine    MetricType = "cosine"
	MetricEuclidean MetricType = "euclidean"
	MetricIP        MetricType = "inner_product"
)

type SearchResult struct {
	ID       VectorID
	Vector   Vector
	Score    float32
	Metadata Metadata
}

type IndexConfig struct {
	IndexType  IndexType
	MetricType MetricType
	Dimension  int
	Normalize  bool
	Extra      map[string]interface{}
}

type VectorRecord struct {
	ID        VectorID
	Vector    Vector
	Metadata  Metadata
	ExpiresAt time.Time
	CreatedAt time.Time
	ShardKey  string
}

type Index interface {
	Add(ctx context.Context, records []VectorRecord) error
	Search(ctx context.Context, query Vector, topK int) ([]SearchResult, error)
	Delete(ctx context.Context, ids []VectorID) error
	Update(ctx context.Context, records []VectorRecord) error
	Get(ctx context.Context, ids []VectorID) ([]VectorRecord, error)
	Count(ctx context.Context) (int64, error)
	Close() error
}

type IndexFactory interface {
	Create(config IndexConfig) (Index, error)
}

type ShardStrategy interface {
	GetShardKey(record VectorRecord) string
	GetShards() []string
}
