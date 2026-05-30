import { StorageAdapter, AggregatedData, Labels, AggregationFunction } from '../types';
import { labelsToKey, now } from '../utils';

interface DataPoint {
  metricName: string;
  labels: Labels;
  function: AggregationFunction;
  value: number;
  timestamp: number;
  windowStart: number;
  windowEnd: number;
}

export class MemoryStorage implements StorageAdapter {
  readonly name: string = 'memory';
  private data: DataPoint[];
  private connected: boolean;
  private maxPoints: number;
  private retentionMs: number;

  constructor(maxPoints: number = 1000000, retentionDays: number = 30) {
    this.data = [];
    this.connected = false;
    this.maxPoints = maxPoints;
    this.retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async write(data: AggregatedData[]): Promise<void> {
    if (!this.connected) {
      throw new Error('Storage not connected');
    }

    for (const point of data) {
      this.data.push({
        metricName: point.metricName,
        labels: { ...point.labels },
        function: point.function,
        value: point.value,
        timestamp: point.timestamp,
        windowStart: point.windowStart,
        windowEnd: point.windowEnd,
      });
    }

    this.cleanup();
  }

  async query(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Labels,
    aggregation?: AggregationFunction,
  ): Promise<AggregatedData[]> {
    if (!this.connected) {
      throw new Error('Storage not connected');
    }

    let filtered = this.data.filter((d) => d.metricName === metricName && d.timestamp >= startTime && d.timestamp <= endTime);

    if (labels) {
      const labelKey = labelsToKey(labels);
      filtered = filtered.filter((d) => labelsToKey(d.labels) === labelKey);
    }

    if (aggregation) {
      filtered = filtered.filter((d) => d.function === aggregation);
    }

    return filtered.map((d) => ({ ...d }));
  }

  async deleteOldData(retentionDays: number): Promise<void> {
    const cutoff = now() - retentionDays * 24 * 60 * 60 * 1000;
    this.data = this.data.filter((d) => d.timestamp >= cutoff);
  }

  isConnected(): boolean {
    return this.connected;
  }

  private cleanup(): void {
    const cutoff = now() - this.retentionMs;
    this.data = this.data.filter((d) => d.timestamp >= cutoff);

    if (this.data.length > this.maxPoints) {
      const toRemove = this.data.length - this.maxPoints;
      this.data.splice(0, toRemove);
    }
  }

  clear(): void {
    this.data = [];
  }

  size(): number {
    return this.data.length;
  }

  getAllData(): AggregatedData[] {
    return [...this.data];
  }
}
