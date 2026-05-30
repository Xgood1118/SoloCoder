import { MetricType, GaugeOptions, MetricSnapshot, MetricValue, Labels } from '../types';
import { now } from '../utils';
import { Metric } from './Metric';

interface GaugeEntry {
  value: number;
  timestamp: number;
  labels: Labels;
}

export class Gauge extends Metric<GaugeOptions> {
  private values: Map<string, GaugeEntry>;

  constructor(options: Omit<GaugeOptions, 'type'>) {
    super({ ...options, type: MetricType.Gauge });
    this.values = new Map();
  }

  private getOrCreate(labels: Labels): GaugeEntry {
    const key = this.getKey(labels);
    let entry = this.values.get(key);
    if (!entry) {
      entry = { value: 0, timestamp: now(), labels: { ...labels } };
      this.values.set(key, entry);
    }
    return entry;
  }

  inc(delta: number = 1, labels: Labels = {}): void {
    const entry = this.getOrCreate(labels);
    entry.value += delta;
    entry.timestamp = now();
  }

  dec(delta: number = 1, labels: Labels = {}): void {
    const entry = this.getOrCreate(labels);
    entry.value -= delta;
    entry.timestamp = now();
  }

  set(value: number, labels: Labels = {}): void {
    const entry = this.getOrCreate(labels);
    entry.value = value;
    entry.timestamp = now();
  }

  setToCurrentTime(labels: Labels = {}): void {
    this.set(Date.now() / 1000, labels);
  }

  startTimer(labels: Labels = {}): () => number {
    const start = process.hrtime();
    return (): number => {
      const delta = process.hrtime(start);
      const elapsed = delta[0] + delta[1] / 1e9;
      this.set(elapsed, labels);
      return elapsed;
    };
  }

  reset(): void {
    this.values.clear();
  }

  get(labels: Labels = {}): number {
    const key = this.getKey(labels);
    return this.values.get(key)?.value || 0;
  }

  getWithTimestamp(labels: Labels = {}): { value: number; timestamp: number } | null {
    const key = this.getKey(labels);
    const entry = this.values.get(key);
    if (!entry) return null;
    return { value: entry.value, timestamp: entry.timestamp };
  }

  getAllValues(): MetricValue[] {
    const result: MetricValue[] = [];
    for (const entry of this.values.values()) {
      result.push({
        value: entry.value,
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
      type: MetricType.Gauge,
      unit: this.unit,
      values: this.getAllValues(),
    };
  }

  collect(): MetricSnapshot {
    return this.getSnapshot();
  }
}
