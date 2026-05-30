import {
  MetricType,
  HistogramOptions,
  MetricSnapshot,
  HistogramValue,
  Labels,
  DEFAULT_BUCKETS,
} from '../types';
import { now } from '../utils';
import { Metric } from './Metric';

interface HistogramEntry {
  count: number;
  sum: number;
  buckets: number[];
  timestamp: number;
  labels: Labels;
}

export class Histogram extends Metric<HistogramOptions> {
  private readonly buckets: number[];
  private readonly upperBounds: number[];
  private values: Map<string, HistogramEntry>;

  constructor(options: Omit<HistogramOptions, 'type'>) {
    super({ ...options, type: MetricType.Histogram });
    this.buckets = options.buckets || DEFAULT_BUCKETS;
    this.upperBounds = [...this.buckets, Infinity];
    this.values = new Map();
  }

  getBuckets(): number[] {
    return [...this.buckets];
  }

  observe(value: number, labels: Labels = {}): void {
    const key = this.getKey(labels);
    let entry = this.values.get(key);
    if (!entry) {
      entry = {
        count: 0,
        sum: 0,
        buckets: new Array(this.upperBounds.length).fill(0),
        timestamp: now(),
        labels: { ...labels },
      };
      this.values.set(key, entry);
    }

    entry.count++;
    entry.sum += value;
    entry.timestamp = now();

    for (let i = 0; i < this.upperBounds.length; i++) {
      if (value <= this.upperBounds[i]) {
        entry.buckets[i]++;
      }
    }
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
    return this.values.get(key)?.sum || 0;
  }

  getCount(labels: Labels = {}): number {
    const key = this.getKey(labels);
    return this.values.get(key)?.count || 0;
  }

  getSum(labels: Labels = {}): number {
    const key = this.getKey(labels);
    return this.values.get(key)?.sum || 0;
  }

  getBucketsValue(labels: Labels = {}): Map<number, number> {
    const key = this.getKey(labels);
    const entry = this.values.get(key);
    const result = new Map<number, number>();
    if (!entry) {
      for (const bound of this.upperBounds) {
        result.set(bound, 0);
      }
      return result;
    }

    for (let i = 0; i < this.upperBounds.length; i++) {
      result.set(this.upperBounds[i], entry.buckets[i]);
    }
    return result;
  }

  getAllHistogramValues(): HistogramValue[] {
    const result: HistogramValue[] = [];
    for (const entry of this.values.values()) {
      const buckets = new Map<number, number>();
      for (let i = 0; i < this.upperBounds.length; i++) {
        buckets.set(this.upperBounds[i], entry.buckets[i]);
      }
      result.push({
        count: entry.count,
        sum: entry.sum,
        buckets,
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
      type: MetricType.Histogram,
      unit: this.unit,
      values: this.getAllHistogramValues(),
    };
  }

  collect(): MetricSnapshot {
    return this.getSnapshot();
  }
}
