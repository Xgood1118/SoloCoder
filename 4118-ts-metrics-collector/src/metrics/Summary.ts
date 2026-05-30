import {
  MetricType,
  SummaryOptions,
  MetricSnapshot,
  SummaryValue,
  Labels,
  DEFAULT_PERCENTILES,
} from '../types';
import { now, percentile } from '../utils';
import { Metric } from './Metric';

interface SummaryEntry {
  count: number;
  sum: number;
  samples: number[];
  timestamps: number[];
  labels: Labels;
  timestamp: number;
}

export class Summary extends Metric<SummaryOptions> {
  private readonly percentiles: number[];
  private readonly maxAgeMs: number;
  private readonly ageBuckets: number;
  private readonly maxSamples: number;
  private values: Map<string, SummaryEntry>;

  constructor(options: Omit<SummaryOptions, 'type'>) {
    super({ ...options, type: MetricType.Summary });
    this.percentiles = options.percentiles || DEFAULT_PERCENTILES;
    this.maxAgeMs = (options.maxAgeSeconds || 600) * 1000;
    this.ageBuckets = options.ageBuckets || 5;
    this.maxSamples = 10000;
    this.values = new Map();
  }

  getPercentiles(): number[] {
    return [...this.percentiles];
  }

  private cleanupOldSamples(entry: SummaryEntry): void {
    const cutoff = now() - this.maxAgeMs;
    while (entry.timestamps.length > 0 && entry.timestamps[0] < cutoff) {
      entry.timestamps.shift();
      entry.samples.shift();
    }
    if (entry.samples.length > this.maxSamples) {
      const toRemove = entry.samples.length - this.maxSamples;
      entry.samples.splice(0, toRemove);
      entry.timestamps.splice(0, toRemove);
    }
  }

  observe(value: number, labels: Labels = {}): void {
    const key = this.getKey(labels);
    let entry = this.values.get(key);
    const currentTime = now();
    if (!entry) {
      entry = {
        count: 0,
        sum: 0,
        samples: [],
        timestamps: [],
        labels: { ...labels },
        timestamp: currentTime,
      };
      this.values.set(key, entry);
    }

    this.cleanupOldSamples(entry);
    entry.count++;
    entry.sum += value;
    entry.samples.push(value);
    entry.timestamps.push(currentTime);
    entry.timestamp = currentTime;
  }

  startTimer(labels: Labels = {}): () => number {
    const start = process.hrtime();
    return (): number => {
      const delta = process.hrtime(start);
      const elapsed = delta[0] + delta[1] / 1e9;
      this.observe(elapsed, labels);
      return elapsed;
    };
  }

  override reset(): void {
    this.values.clear();
  }

  override get(labels: Labels = {}): number {
    const key = this.getKey(labels);
    const entry = this.values.get(key);
    if (!entry || entry.samples.length === 0) return 0;
    this.cleanupOldSamples(entry);
    return percentile(entry.samples, 0.5);
  }

  getCount(labels: Labels = {}): number {
    const key = this.getKey(labels);
    const entry = this.values.get(key);
    if (!entry) return 0;
    this.cleanupOldSamples(entry);
    return entry.count;
  }

  getSum(labels: Labels = {}): number {
    const key = this.getKey(labels);
    const entry = this.values.get(key);
    if (!entry) return 0;
    this.cleanupOldSamples(entry);
    return entry.sum;
  }

  getQuantiles(labels: Labels = {}): Map<number, number> {
    const key = this.getKey(labels);
    const entry = this.values.get(key);
    const result = new Map<number, number>();

    if (!entry || entry.samples.length === 0) {
      for (const p of this.percentiles) {
        result.set(p, NaN);
      }
      return result;
    }

    this.cleanupOldSamples(entry);
    for (const p of this.percentiles) {
      result.set(p, percentile(entry.samples, p));
    }
    return result;
  }

  getAllSummaryValues(): SummaryValue[] {
    const result: SummaryValue[] = [];
    for (const entry of this.values.values()) {
      this.cleanupOldSamples(entry);
      const quantiles = new Map<number, number>();
      if (entry.samples.length > 0) {
        for (const p of this.percentiles) {
          quantiles.set(p, percentile(entry.samples, p));
        }
      }
      result.push({
        count: entry.count,
        sum: entry.sum,
        quantiles,
        timestamp: entry.timestamp,
        labels: entry.labels,
      });
    }
    return result;
  }

  getSnapshot(): MetricSnapshot {
    return {
      name: this.name,
      help: this.help,
      type: MetricType.Summary,
      unit: this.unit,
      values: this.getAllSummaryValues(),
    };
  }

  collect(): MetricSnapshot {
    return this.getSnapshot();
  }
}
