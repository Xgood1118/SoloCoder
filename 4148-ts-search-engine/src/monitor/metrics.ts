

interface HistogramData {
  values: number[];
  count: number;
  sum: number;
  min: number;
  max: number;
}

export class MetricsRegistry {
  private counters: Map<string, number>;
  private gauges: Map<string, number>;
  private histograms: Map<string, HistogramData>;

  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
  }

  incrementCounter(name: string, value?: number): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + (value ?? 1));
  }

  decrementCounter(name: string, value?: number): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current - (value ?? 1));
  }

  recordGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  recordHistogram(name: string, value: number): void {
    let data = this.histograms.get(name);
    if (!data) {
      data = {
        values: [],
        count: 0,
        sum: 0,
        min: Number.MAX_SAFE_INTEGER,
        max: Number.MIN_SAFE_INTEGER,
      };
      this.histograms.set(name, data);
    }
    data.values.push(value);
    data.count++;
    data.sum += value;
    if (value < data.min) data.min = value;
    if (value > data.max) data.max = value;
  }

  recordTimer(name: string, durationMs: number): void {
    this.recordHistogram(name, durationMs);
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  getGauge(name: string): number {
    return this.gauges.get(name) ?? 0;
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  getHistogramSummary(name: string): { count: number; sum: number; avg: number; min: number; max: number; p50: number; p95: number; p99: number } {
    const data = this.histograms.get(name);
    if (!data || data.count === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }
    const sortedValues = [...data.values].sort((a, b) => a - b);
    return {
      count: data.count,
      sum: data.sum,
      avg: data.sum / data.count,
      min: data.min,
      max: data.max,
      p50: this.calculatePercentile(sortedValues, 50),
      p95: this.calculatePercentile(sortedValues, 95),
      p99: this.calculatePercentile(sortedValues, 99),
    };
  }

  getAllMetrics(): object {
    const counters: Record<string, number> = {};
    for (const [name, value] of this.counters) {
      counters[name] = value;
    }

    const gauges: Record<string, number> = {};
    for (const [name, value] of this.gauges) {
      gauges[name] = value;
    }

    const histograms: Record<string, any> = {};
    for (const [name] of this.histograms) {
      histograms[name] = this.getHistogramSummary(name);
    }

    return {
      counters,
      gauges,
      histograms,
    };
  }
}

export class SearchMonitor {
  private metrics: MetricsRegistry;
  private startTime: number;
  private docCount: number;
  private termCount: number;

  constructor(metrics: MetricsRegistry) {
    this.metrics = metrics;
    this.startTime = Date.now();
    this.docCount = 0;
    this.termCount = 0;
  }

  startQueryTimer(): () => number {
    const startTime = Date.now();
    return () => {
      const durationMs = Date.now() - startTime;
      this.metrics.recordTimer('searchLatency', durationMs);
      return durationMs;
    };
  }

  recordSearch(query: string, numResults: number, durationMs: number): void {
    this.metrics.incrementCounter('searchCount');
    this.metrics.recordHistogram('searchLatency', durationMs);
    this.metrics.recordHistogram('resultsPerSearch', numResults);
  }

  recordIndexAdd(durationMs: number): void {
    this.metrics.incrementCounter('indexCount');
    this.metrics.recordTimer('indexLatency', durationMs);
    this.docCount++;
    this.metrics.recordGauge('docCount', this.docCount);
  }

  recordIndexRemove(durationMs: number): void {
    this.metrics.recordTimer('indexRemoveLatency', durationMs);
    if (this.docCount > 0) {
      this.docCount--;
    }
    this.metrics.recordGauge('docCount', this.docCount);
  }

  recordCacheHit(): void {
    this.metrics.incrementCounter('cacheHits');
  }

  recordCacheMiss(): void {
    this.metrics.incrementCounter('cacheMisses');
  }

  getHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; uptimeMs: number; docCount: number; [key: string]: any } {
    const uptimeMs = Date.now() - this.startTime;
    const searchCount = this.metrics.getCounter('searchCount');
    const cacheHits = this.metrics.getCounter('cacheHits');
    const cacheMisses = this.metrics.getCounter('cacheMisses');
    const totalCacheRequests = cacheHits + cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0;
    const latencySummary = this.metrics.getHistogramSummary('searchLatency');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (latencySummary.p99 > 5000 || cacheHitRate < 0.1) {
      status = 'unhealthy';
    } else if (latencySummary.p95 > 2000 || cacheHitRate < 0.3) {
      status = 'degraded';
    }

    return {
      status,
      uptimeMs,
      docCount: this.docCount,
      termCount: this.termCount,
      searchCount,
      cacheHits,
      cacheMisses,
      cacheHitRate,
      avgSearchLatency: latencySummary.avg,
      p95SearchLatency: latencySummary.p95,
      p99SearchLatency: latencySummary.p99,
    };
  }

  getStats(): object {
    const searchLatency = this.metrics.getHistogramSummary('searchLatency');
    const indexLatency = this.metrics.getHistogramSummary('indexLatency');

    return {
      uptime: Date.now() - this.startTime,
      searchCount: this.metrics.getCounter('searchCount'),
      searchLatency: {
        p50: searchLatency.p50,
        p95: searchLatency.p95,
        p99: searchLatency.p99,
      },
      indexCount: this.metrics.getCounter('indexCount'),
      indexLatency: {
        avg: indexLatency.avg,
        p95: indexLatency.p95,
      },
      cacheHits: this.metrics.getCounter('cacheHits'),
      cacheMisses: this.metrics.getCounter('cacheMisses'),
      docCount: this.docCount,
      termCount: this.termCount,
    };
  }

  setDocCount(count: number): void {
    this.docCount = count;
    this.metrics.recordGauge('docCount', count);
  }

  setTermCount(count: number): void {
    this.termCount = count;
    this.metrics.recordGauge('termCount', count);
  }
}
