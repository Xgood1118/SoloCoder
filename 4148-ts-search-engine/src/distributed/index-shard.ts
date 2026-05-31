import { Document, Query, SearchResult, FieldConfig } from '../core/types';
import { InvertedIndex } from '../index/inverted-index';
import { IndexBuilder } from '../index/index-builder';
import { AnalyzerRegistry } from '../analyzer/analyzer';
import { TFIDFScorer, IScorer } from '../scoring/scorer';

export interface ShardConfig {
  shardId: number;
  nodeId: string;
  primary: boolean;
  replicaOf?: number;
}

export class IndexShard {
  private config: ShardConfig;
  private invertedIndex: InvertedIndex;
  private indexBuilder: IndexBuilder;
  private scorer: IScorer;
  private analyzerRegistry: AnalyzerRegistry;
  private fieldConfigs: FieldConfig[];

  constructor(config: ShardConfig) {
    this.config = config;
    this.fieldConfigs = [];
    this.analyzerRegistry = new AnalyzerRegistry();
    this.invertedIndex = new InvertedIndex(this.fieldConfigs);
    this.indexBuilder = new IndexBuilder(this.fieldConfigs, this.analyzerRegistry);
    this.scorer = new TFIDFScorer();
  }

  addDocument(doc: Document): void {
    this.indexBuilder.addDocument(doc);
  }

  removeDocument(docId: string): boolean {
    return this.indexBuilder.removeDocument(docId);
  }

  search(query: Query, from: number, size: number): SearchResult[] {
    const scoredDocs = this.scorer.score(query, this.invertedIndex);
    const results: SearchResult[] = [];

    for (const [docId, score] of scoredDocs) {
      const storedFields = this.invertedIndex.getDocument(docId);
      const document: Document | null = storedFields
        ? {
            id: docId,
            fields: storedFields,
            timestamp: 0,
            version: 0,
          }
        : null;

      results.push({
        docId,
        score,
        document,
        highlights: {},
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(from, from + size);
  }

  getStats(): object {
    const stats = this.invertedIndex.getStats();
    return {
      shardId: this.config.shardId,
      nodeId: this.config.nodeId,
      primary: this.config.primary,
      replicaOf: this.config.replicaOf,
      docCount: stats.docCount,
      termCount: stats.termCount,
      indexSize: stats.indexSize,
      lastUpdated: stats.lastUpdated,
    };
  }

  serialize(): object {
    return {
      config: this.config,
      index: this.invertedIndex.serialize(),
      fieldConfigs: this.fieldConfigs,
    };
  }

  deserialize(data: any): void {
    this.config = data.config;
    this.fieldConfigs = data.fieldConfigs;
    this.invertedIndex = new InvertedIndex(this.fieldConfigs);
    this.invertedIndex.deserialize(data.index);
    this.indexBuilder = new IndexBuilder(this.fieldConfigs, this.analyzerRegistry);
  }

  getConfig(): ShardConfig {
    return this.config;
  }

  getInvertedIndex(): InvertedIndex {
    return this.invertedIndex;
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export class IndexShardManager {
  private shards: IndexShard[];
  private numShards: number;
  private numReplicas: number;

  constructor(numShards?: number, numReplicas?: number) {
    this.numShards = numShards ?? 3;
    this.numReplicas = numReplicas ?? 0;
    this.shards = [];

    for (let i = 0; i < this.numShards; i++) {
      const primaryShard = new IndexShard({
        shardId: i,
        nodeId: `node-${i}`,
        primary: true,
      });
      this.shards.push(primaryShard);

      for (let r = 0; r < this.numReplicas; r++) {
        const replicaShard = new IndexShard({
          shardId: this.numShards + i * this.numReplicas + r,
          nodeId: `node-${(i + r + 1) % this.numShards}`,
          primary: false,
          replicaOf: i,
        });
        this.shards.push(replicaShard);
      }
    }
  }

  addDocument(doc: Document): void {
    const shard = this.getShardForDoc(doc.id);
    shard.addDocument(doc);

    if (this.numReplicas > 0) {
      const primaryShardId = shard.getConfig().shardId;
      for (const replica of this.shards) {
        if (replica.getConfig().replicaOf === primaryShardId) {
          replica.addDocument(doc);
        }
      }
    }
  }

  removeDocument(docId: string): boolean {
    const shard = this.getShardForDoc(docId);
    const result = shard.removeDocument(docId);

    if (result && this.numReplicas > 0) {
      const primaryShardId = shard.getConfig().shardId;
      for (const replica of this.shards) {
        if (replica.getConfig().replicaOf === primaryShardId) {
          replica.removeDocument(docId);
        }
      }
    }

    return result;
  }

  search(query: Query, from: number, size: number): SearchResult[] {
    const allResults: Map<string, SearchResult> = new Map();

    for (const shard of this.shards) {
      if (!shard.getConfig().primary) continue;

      const shardResults = shard.search(query, 0, Number.MAX_SAFE_INTEGER);
      for (const result of shardResults) {
        const existing = allResults.get(result.docId);
        if (!existing || result.score > existing.score) {
          allResults.set(result.docId, result);
        }
      }
    }

    const mergedResults = Array.from(allResults.values());
    mergedResults.sort((a, b) => b.score - a.score);
    return mergedResults.slice(from, from + size);
  }

  addShard(shard: IndexShard): void {
    this.shards.push(shard);
  }

  getShardForDoc(docId: string): IndexShard {
    const hash = hashString(docId);
    const shardId = hash % this.numShards;
    const shard = this.shards.find(s => s.getConfig().shardId === shardId && s.getConfig().primary);
    if (!shard) {
      throw new Error(`Shard not found for docId: ${docId}`);
    }
    return shard;
  }

  getAllShards(): IndexShard[] {
    return [...this.shards];
  }

  getStats(): object {
    const shardStats = this.shards.map(s => s.getStats());
    const totalDocCount = shardStats.reduce((sum: number, s: any) => sum + s.docCount, 0);
    const totalTermCount = shardStats.reduce((sum: number, s: any) => sum + s.termCount, 0);
    const totalIndexSize = shardStats.reduce((sum: number, s: any) => sum + s.indexSize, 0);

    return {
      numShards: this.numShards,
      numReplicas: this.numReplicas,
      totalShards: this.shards.length,
      totalDocCount,
      totalTermCount,
      totalIndexSize,
      shards: shardStats,
    };
  }
}
