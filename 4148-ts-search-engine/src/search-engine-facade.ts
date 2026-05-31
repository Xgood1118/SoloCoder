import { SearchEngineConfig, DEFAULT_CONFIG, createConfig } from './config';
import { FieldConfig, Document, SearchRequest, SearchResponse } from './core/types';
import { AnalyzerRegistry } from './analyzer/analyzer';
import { InvertedIndex } from './index/inverted-index';
import { IndexBuilder, DataSource } from './index/index-builder';
import { QueryParser } from './query/query-parser';
import { TFIDFScorer } from './scoring/scorer';
import { Highlighter } from './search/highlighter';
import { SearchEngine } from './search/search-engine';
import { Suggester } from './suggest/suggest';
import { PinyinSpellChecker } from './correction/spell-checker';
import { SearchCache } from './cache/search-cache';
import { SearchHistory } from './history/search-history';
import { MetricsRegistry, SearchMonitor } from './monitor/metrics';
import { IndexShardManager } from './distributed/index-shard';
import { FileStorage, MemoryStorage, IndexPersistence } from './storage/storage';
import { SearchEngineAPI } from './api/server';

export class SearchEngineFacade {
  private config: SearchEngineConfig;
  private fieldConfigs: Map<string, FieldConfig>;
  private analyzerRegistry: AnalyzerRegistry;
  private invertedIndex: InvertedIndex;
  private indexBuilder: IndexBuilder;
  private queryParser: QueryParser;
  private scorer: TFIDFScorer;
  private highlighter: Highlighter;
  private searchEngine: SearchEngine;
  private suggester: Suggester;
  private spellChecker: PinyinSpellChecker;
  private searchCache: SearchCache | null;
  private searchHistory: SearchHistory | null;
  private metrics: MetricsRegistry;
  private monitor: SearchMonitor;
  private shardManager: IndexShardManager | null;
  private storage: FileStorage | MemoryStorage;
  private persistence: IndexPersistence;
  private apiServer: SearchEngineAPI | null;

  constructor(fieldConfigs: FieldConfig[], configOverrides?: Partial<SearchEngineConfig>) {
    this.config = createConfig(configOverrides);
    this.fieldConfigs = new Map();
    for (const config of fieldConfigs) {
      this.fieldConfigs.set(config.name, config);
    }
    this.analyzerRegistry = new AnalyzerRegistry();
    this.indexBuilder = new IndexBuilder(fieldConfigs, this.analyzerRegistry);
    this.invertedIndex = this.indexBuilder.getIndex();
    this.queryParser = new QueryParser({
      defaultField: this.config.defaultField,
      defaultOperator: this.config.defaultOperator,
    });
    this.scorer = new TFIDFScorer(this.getFieldWeights());
    this.highlighter = new Highlighter(this.fieldConfigs);
    this.searchEngine = new SearchEngine({
      maxPaginationDepth: this.config.maxPaginationDepth,
    });
    (this.searchEngine as any).invertedIndex = this.invertedIndex;
    (this.searchEngine as any).queryParser = this.queryParser;
    (this.searchEngine as any).scorer = this.scorer;
    (this.searchEngine as any).highlighter = this.highlighter;
    (this.searchEngine as any).fieldConfigs = this.fieldConfigs;
    this.suggester = new Suggester();
    this.spellChecker = new PinyinSpellChecker();
    this.searchCache = this.config.enableCache
      ? new SearchCache(this.config.cacheCapacity, this.config.cacheTTL)
      : null;
    this.searchHistory = this.config.enableHistory
      ? new SearchHistory(this.config.maxHotWords, this.config.maxHistoryItems)
      : null;
    this.metrics = new MetricsRegistry();
    this.monitor = new SearchMonitor(this.metrics);
    this.shardManager = this.config.numShards > 1
      ? new IndexShardManager(this.config.numShards, this.config.numReplicas)
      : null;
    this.storage = this.config.useFileStorage
      ? new FileStorage(this.config.dataDir)
      : new MemoryStorage();
    this.persistence = new IndexPersistence(this.storage);
    this.apiServer = null;
    this.init().catch(() => {});
  }

  private async init(): Promise<void> {
    const indexStats = this.invertedIndex.getStats();
    this.monitor.setDocCount(indexStats.docCount);
    this.monitor.setTermCount(indexStats.termCount);
  }

  private getFieldWeights(): Record<string, number> {
    const weights: Record<string, number> = {};
    for (const [name, config] of this.fieldConfigs) {
      weights[name] = config.weight ?? 1;
    }
    return weights;
  }

  private indexTermsForSuggest(): void {
    const termFrequencies = new Map<string, number>();
    for (const [fieldName] of this.fieldConfigs) {
      const terms = this.invertedIndex.getAllTerms(fieldName);
      for (const term of terms) {
        const df = this.invertedIndex.getDocFrequency(fieldName, term);
        const existing = termFrequencies.get(term) || 0;
        termFrequencies.set(term, existing + df);
        this.spellChecker.addWord(term);
      }
    }
    const termsArray = Array.from(termFrequencies.entries()).map(([term, frequency]) => ({
      term,
      frequency,
    }));
    this.suggester.indexTerms(termsArray);
  }

  async addDocuments(documents: Document[]): Promise<{ indexed: number; failed: number }> {
    let indexed = 0;
    let failed = 0;
    const startTime = Date.now();
    for (const doc of documents) {
      try {
        const start = Date.now();
        this.indexBuilder.addDocument(doc);
        this.monitor.recordIndexAdd(Date.now() - start);
        if (this.shardManager) {
          this.shardManager.addDocument(doc);
        }
        indexed++;
      } catch (e) {
        failed++;
      }
    }
    const stats = this.invertedIndex.getStats();
    this.monitor.setDocCount(stats.docCount);
    this.monitor.setTermCount(stats.termCount);
    if (this.config.enableSuggest || this.config.enableSpellCheck) {
      this.indexTermsForSuggest();
    }
    if (this.searchCache) {
      this.searchCache.invalidate();
    }
    this.metrics.recordHistogram('bulkIndexLatency', Date.now() - startTime);
    return { indexed, failed };
  }

  async addDocument(doc: Document): Promise<void> {
    const start = Date.now();
    this.indexBuilder.addDocument(doc);
    this.monitor.recordIndexAdd(Date.now() - start);
    if (this.shardManager) {
      this.shardManager.addDocument(doc);
    }
    const stats = this.invertedIndex.getStats();
    this.monitor.setDocCount(stats.docCount);
    this.monitor.setTermCount(stats.termCount);
    if (this.config.enableSuggest || this.config.enableSpellCheck) {
      this.indexTermsForSuggest();
    }
    if (this.searchCache) {
      this.searchCache.invalidate();
    }
  }

  async removeDocument(docId: string): Promise<boolean> {
    const start = Date.now();
    const result = this.indexBuilder.removeDocument(docId);
    this.monitor.recordIndexRemove(Date.now() - start);
    if (this.shardManager) {
      this.shardManager.removeDocument(docId);
    }
    const stats = this.invertedIndex.getStats();
    this.monitor.setDocCount(stats.docCount);
    this.monitor.setTermCount(stats.termCount);
    if (this.searchCache) {
      this.searchCache.invalidate();
    }
    return result;
  }

  async updateDocument(doc: Document): Promise<void> {
    await this.removeDocument(doc.id);
    await this.addDocument(doc);
  }

  async buildFromDataSource(dataSource: DataSource, incremental?: boolean): Promise<number> {
    const count = await this.indexBuilder.buildFromDataSource(dataSource, incremental);
    const stats = this.invertedIndex.getStats();
    this.monitor.setDocCount(stats.docCount);
    this.monitor.setTermCount(stats.termCount);
    if (this.config.enableSuggest || this.config.enableSpellCheck) {
      this.indexTermsForSuggest();
    }
    if (this.searchCache) {
      this.searchCache.invalidate();
    }
    return count;
  }

  async search(request: SearchRequest | string): Promise<SearchResponse> {
    const startTime = Date.now();
    const endTimer = this.monitor.startQueryTimer();

    let searchRequest: SearchRequest;
    let queryStr: string;

    if (typeof request === 'string') {
      queryStr = request;
      searchRequest = {
        query: request,
        highlight: {
          fields: Array.from(this.fieldConfigs.keys()),
          preTag: this.config.highlightPreTag,
          postTag: this.config.highlightPostTag,
          fragmentSize: this.config.fragmentSize,
        },
      };
    } else {
      queryStr = typeof request.query === 'string' ? request.query : JSON.stringify(request.query);
      searchRequest = {
        ...request,
        highlight: request.highlight ?? {
          fields: Array.from(this.fieldConfigs.keys()),
          preTag: this.config.highlightPreTag,
          postTag: this.config.highlightPostTag,
          fragmentSize: this.config.fragmentSize,
        },
      };
    }

    if (this.searchCache) {
      const cached = this.searchCache.get(queryStr, searchRequest);
      if (cached) {
        this.monitor.recordCacheHit();
        endTimer();
        return cached;
      }
      this.monitor.recordCacheMiss();
    }

    const response = this.searchEngine.search(searchRequest);

    if (this.searchHistory) {
      this.searchHistory.record(queryStr);
    }

    if (this.searchCache) {
      this.searchCache.set(queryStr, response, searchRequest);
    }

    const duration = endTimer();
    this.monitor.recordSearch(queryStr, response.total, duration);

    return response;
  }

  async suggest(prefix: string, limit?: number): Promise<Array<{suggestion: string, score: number}>> {
    if (!this.config.enableSuggest) {
      return [];
    }
    const actualLimit = limit ?? this.config.suggestLimit;
    return this.suggester.suggest(prefix, actualLimit);
  }

  async correct(query: string): Promise<{ original: string; corrected: string | null; suggestions: string[] }> {
    if (!this.config.enableSpellCheck) {
      return { original: query, corrected: null, suggestions: [] };
    }
    const suggestions = this.spellChecker.suggest(query, this.config.correctLimit);
    const corrected = suggestions.length > 0 && suggestions[0].toLowerCase() !== query.toLowerCase()
      ? suggestions[0]
      : null;
    return { original: query, corrected, suggestions };
  }

  async pinyinSearch(query: string, limit?: number): Promise<string[]> {
    if (!this.config.enableSpellCheck) {
      return [];
    }
    const actualLimit = limit ?? this.config.suggestLimit;
    return this.spellChecker.pinyinFuzzySearch(query, actualLimit);
  }

  async getHistory(limit?: number): Promise<Array<{query: string, timestamp: number}>> {
    if (!this.searchHistory) {
      return [];
    }
    return this.searchHistory.getHistory(limit);
  }

  async getHotWords(limit?: number): Promise<Array<{query: string, count: number, lastSearched: number}>> {
    if (!this.searchHistory) {
      return [];
    }
    return this.searchHistory.getHotWords(limit);
  }

  async getStats(): Promise<object> {
    const indexStats = this.invertedIndex.getStats();
    const monitorStats = this.monitor.getStats();
    const cacheStats = this.searchCache ? this.searchCache.getStats() : null;
    const shardStats = this.shardManager ? this.shardManager.getStats() : null;

    return {
      ...monitorStats,
      index: indexStats,
      cache: cacheStats,
      shards: shardStats,
      config: this.config,
    };
  }

  async getHealth(): Promise<object> {
    return this.monitor.getHealth();
  }

  async load(): Promise<void> {
    await this.persistence.loadAll(
      this.invertedIndex,
      this.suggester,
      this.spellChecker,
      this.searchHistory ?? new SearchHistory()
    );
    const stats = this.invertedIndex.getStats();
    this.monitor.setDocCount(stats.docCount);
    this.monitor.setTermCount(stats.termCount);
  }

  async save(): Promise<void> {
    await this.persistence.saveAll(
      this.invertedIndex,
      this.suggester,
      this.spellChecker,
      this.searchHistory ?? new SearchHistory(),
      this.metrics
    );
  }

  async startAPI(): Promise<void> {
    if (this.apiServer) {
      await this.stopAPI();
    }
    this.apiServer = new SearchEngineAPI(this, this.config.port, this.config.host);
    await this.apiServer.start();
  }

  async stopAPI(): Promise<void> {
    if (this.apiServer) {
      await this.apiServer.stop();
      this.apiServer = null;
    }
  }
}
