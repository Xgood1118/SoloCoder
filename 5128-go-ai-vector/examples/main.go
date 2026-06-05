package main

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/vector-proxy/pkg/core"
	"github.com/vector-proxy/pkg/hybrid"
	"github.com/vector-proxy/pkg/index"
	"github.com/vector-proxy/pkg/index/hnsw"
	"github.com/vector-proxy/pkg/index/jellyfish"
	"github.com/vector-proxy/pkg/normalizer"
	"github.com/vector-proxy/pkg/shard"
	"github.com/vector-proxy/pkg/ttl"
)

const (
	dimension = 128
	numVectors = 1000
)

func main() {
	fmt.Println("=== Vector Database Proxy Demo ===")
	fmt.Println()

	example1_BasicHNSW()
	fmt.Println()

	example2_Normalization()
	fmt.Println()

	example3_TTLManager()
	fmt.Println()

	example4_Sharding()
	fmt.Println()

	example5_HybridSearch()
	fmt.Println()

	example6_FactoryPattern()
	fmt.Println()

	fmt.Println("=== All examples completed ===")
}

func example1_BasicHNSW() {
	fmt.Println("Example 1: Basic HNSW Index Usage")
	fmt.Println("---------------------------------")

	config := hnsw.NewDefaultConfig(dimension, core.MetricCosine)
	idx := hnsw.NewIndex(config)
	defer idx.Close()

	ctx := context.Background()

	records := generateRandomVectors(100, dimension)
	err := idx.Add(ctx, records)
	if err != nil {
		fmt.Printf("Error adding vectors: %v\n", err)
		return
	}

	count, _ := idx.Count(ctx)
	fmt.Printf("Added %d vectors\n", count)

	query := generateRandomVector(dimension)
	results, err := idx.Search(ctx, query, 5)
	if err != nil {
		fmt.Printf("Error searching: %v\n", err)
		return
	}

	fmt.Printf("Top 5 similar vectors:\n")
	for i, r := range results {
		fmt.Printf("  %d. ID=%s, Score=%.4f\n", i+1, r.ID, r.Score)
	}
}

func example2_Normalization() {
	fmt.Println("Example 2: Vector Normalization")
	fmt.Println("--------------------------------")

	norm := normalizer.NewL2Normalizer()

	vec := core.Vector{1.0, 2.0, 3.0, 4.0}
	fmt.Printf("Original vector: %v\n", vec)
	fmt.Printf("Is normalized: %v\n", norm.IsNormalized(vec))

	normalized, err := norm.Normalize(vec)
	if err != nil {
		fmt.Printf("Error normalizing: %v\n", err)
		return
	}

	fmt.Printf("Normalized vector: %v\n", normalized)
	fmt.Printf("Is normalized: %v\n", norm.IsNormalized(normalized))

	normSquared := float32(0)
	for _, v := range normalized {
		normSquared += v * v
	}
	fmt.Printf("L2 norm squared: %.6f\n", normSquared)
}

func example3_TTLManager() {
	fmt.Println("Example 3: TTL Expiration Management")
	fmt.Println("------------------------------------")

	config := hnsw.NewDefaultConfig(dimension, core.MetricCosine)
	idx := hnsw.NewIndex(config)
	defer idx.Close()

	ttlManager := ttl.NewTTLManager(idx, 100*time.Millisecond)
	ttlManager.Start()
	defer ttlManager.Stop()

	ctx := context.Background()

	records := generateRandomVectors(5, dimension)
	err := ttlManager.AddWithTTL(records, 200*time.Millisecond)
	if err != nil {
		fmt.Printf("Error adding vectors: %v\n", err)
		return
	}

	count, _ := idx.Count(ctx)
	fmt.Printf("Initial count: %d\n", count)
	fmt.Printf("Vectors with TTL: %d\n", ttlManager.CountWithTTL())

	time.Sleep(300 * time.Millisecond)

	cleaned := ttlManager.CleanupNow()
	fmt.Printf("Cleaned %d expired vectors\n", cleaned)

	count, _ = idx.Count(ctx)
	fmt.Printf("Count after cleanup: %d\n", count)
}

func example4_Sharding() {
	fmt.Println("Example 4: Sharded Index")
	fmt.Println("------------------------")

	indexConfig := core.IndexConfig{
		IndexType:  core.IndexTypeHNSW,
		MetricType: core.MetricCosine,
		Dimension:  dimension,
		Normalize:  true,
	}

	shardConfig := shard.ShardConfig{
		Strategy:      shard.StrategyHash,
		NumShards:     4,
		ShardKeyField: "user_id",
		IndexConfig:   indexConfig,
	}

	shardManager, err := shard.NewShardManager(shardConfig)
	if err != nil {
		fmt.Printf("Error creating shard manager: %v\n", err)
		return
	}
	defer shardManager.Close()

	ctx := context.Background()

	records := generateRandomVectorsWithShardKey(100, dimension)
	err = shardManager.Add(ctx, records)
	if err != nil {
		fmt.Printf("Error adding vectors: %v\n", err)
		return
	}

	totalCount, _ := shardManager.Count(ctx)
	fmt.Printf("Total vectors: %d\n", totalCount)

	for _, key := range shardManager.GetShardKeys() {
		count, _ := shardManager.GetShardCount(ctx, key)
		fmt.Printf("  %s: %d vectors\n", key, count)
	}

	query := generateRandomVector(dimension)
	results, err := shardManager.Search(ctx, query, 5)
	if err != nil {
		fmt.Printf("Error searching: %v\n", err)
		return
	}

	fmt.Printf("Search results across all shards: %d\n", len(results))
	for i, r := range results {
		fmt.Printf("  %d. ID=%s, Score=%.4f\n", i+1, r.ID, r.Score)
	}
}

func example5_HybridSearch() {
	fmt.Println("Example 5: Hybrid Search (Vector + Text)")
	fmt.Println("----------------------------------------")

	vectorConfig := hnsw.NewDefaultConfig(dimension, core.MetricCosine)
	vectorIndex := hnsw.NewIndex(vectorConfig)
	defer vectorIndex.Close()

	textIndex := jellyfish.NewIndex(jellyfish.MetricJaroWinkler, "text")

	hybridSearcher := hybrid.NewHybridSearcher(hybrid.HybridConfig{
		VectorIndex:  vectorIndex,
		TextIndex:    textIndex,
		MergeType:    hybrid.MergeWeighted,
		VectorWeight: 0.7,
		TextWeight:   0.3,
		MetricType:   core.MetricCosine,
	})

	ctx := context.Background()

	records := generateRandomVectorsWithText(20, dimension)
	err := hybridSearcher.Add(ctx, records)
	if err != nil {
		fmt.Printf("Error adding vectors: %v\n", err)
		return
	}

	query := hybrid.Query{
		Vector:    generateRandomVector(dimension),
		Text:      "hello world",
		TopK:      5,
		MergeType: hybrid.MergeWeighted,
	}

	results, err := hybridSearcher.Search(ctx, query)
	if err != nil {
		fmt.Printf("Error searching: %v\n", err)
		return
	}

	fmt.Printf("Hybrid search results (weighted):\n")
	for i, r := range results {
		text := ""
		if r.Metadata != nil {
			if t, ok := r.Metadata["text"].(string); ok {
				text = t
			}
		}
		fmt.Printf("  %d. ID=%s, Score=%.4f, Text=\"%s\"\n", i+1, r.ID, r.Score, text)
	}
}

func example6_FactoryPattern() {
	fmt.Println("Example 6: Index Factory Pattern")
	fmt.Println("---------------------------------")

	factory := index.NewIndexFactory()

	configs := []core.IndexConfig{
		{
			IndexType:  core.IndexTypeHNSW,
			MetricType: core.MetricCosine,
			Dimension:  dimension,
			Normalize:  true,
			Extra: map[string]interface{}{
				"M":              16,
				"EFConstruction": 100,
			},
		},
		{
			IndexType:  core.IndexTypeJellyfish,
			MetricType: core.MetricCosine,
			Dimension:  dimension,
			Normalize:  false,
			Extra: map[string]interface{}{
				"Metric":      jellyfish.MetricJaroWinkler,
				"StringField": "content",
			},
		},
	}

	for i, cfg := range configs {
		idx, err := factory.Create(cfg)
		if err != nil {
			fmt.Printf("Error creating index %d: %v\n", i+1, err)
			continue
		}
		defer idx.Close()

		ctx := context.Background()
		records := generateRandomVectors(10, dimension)
		idx.Add(ctx, records)

		count, _ := idx.Count(ctx)
		fmt.Printf("Index %d (%s): %d vectors\n", i+1, cfg.IndexType, count)
	}

	fmt.Println("Factory pattern allows easy switching between index backends!")
}

func generateRandomVector(dim int) core.Vector {
	vec := make(core.Vector, dim)
	for i := range vec {
		vec[i] = rand.Float32()*2 - 1
	}
	return vec
}

func generateRandomVectors(n, dim int) []core.VectorRecord {
	records := make([]core.VectorRecord, n)
	for i := 0; i < n; i++ {
		records[i] = core.VectorRecord{
			ID:       core.VectorID(fmt.Sprintf("vec_%04d", i)),
			Vector:   generateRandomVector(dim),
			Metadata: core.Metadata{"index": i},
		}
	}
	return records
}

func generateRandomVectorsWithShardKey(n, dim int) []core.VectorRecord {
	records := generateRandomVectors(n, dim)
	texts := []string{"user_1", "user_2", "user_3", "user_4", "user_5"}
	for i := range records {
		records[i].Metadata["user_id"] = texts[i%len(texts)]
	}
	return records
}

func generateRandomVectorsWithText(n, dim int) []core.VectorRecord {
	records := generateRandomVectors(n, dim)
	texts := []string{
		"hello world",
		"machine learning",
		"artificial intelligence",
		"vector database",
		"neural networks",
		"deep learning",
		"data science",
		"natural language processing",
	}
	for i := range records {
		records[i].Metadata["text"] = texts[i%len(texts)]
	}
	return records
}

func init() {
	rand.Seed(time.Now().UnixNano())
}
