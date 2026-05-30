import { MetricType, CounterOptions, MetricSnapshot, MetricValue, Labels } from '../types';
import { now } from '../utils';
import { Metric } from './Metric';

interface CounterEntry {
  value: number;
  timestamp: number;
  labels: Labels;
}

export class Counter extends Metric<CounterOptions> {
  private values: Map<string, CounterEntry>;

  constructor(options: Omit<CounterOptions, 'type'>) {
    super({ ...options, type: MetricType.Counter });
    this.values = new Map();
  }

  private getOrCreate(labels: Labels): CounterEntry {
    const key = this.getKey(labels);
    let entry = this.values.get(key);
    if (!entry) {
      entry = { value: 0, timestamp: now(), labels: { ...labels } };
      this.values.set(key, entry);
    }
    return entry;
  }

  inc(delta: number = 1, labels: Labels = {}): void {
    if (delta < 0) {
      throw new Error(`Counter cannot be decreased. Use Gauge instead for metric ${this.name}`);
    }
    const entry = this.getOrCreate(labels);
    entry.value += delta;
    entry.timestamp = now();
  }

  set(value: number, labels: Labels = {}): void {
    if (value < this.get(labels)) {
      throw new Error(`Counter value cannot be decreased. Use Gauge instead for metric ${this.name}`);
    }
    const entry = this.getOrCreate(labels);
    entry.value = value;
    entry.timestamp = now();
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
      type: MetricType.Counter,
      unit: this.unit,
      values: this.getAllValues(),
    };
  }

  collect(): MetricSnapshot {
    return this.getSnapshot();
  }
}
