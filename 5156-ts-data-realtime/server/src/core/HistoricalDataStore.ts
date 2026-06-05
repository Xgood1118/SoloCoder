import type { DataPoint, AggregationType } from '../types';
import { createAggregator, type Aggregator } from '../utils/aggregators';

export type DownsampleInterval = '1m' | '5m' | '1h' | '1d';

const INTERVAL_MS: Record<DownsampleInterval, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

export class HistoricalDataStore {
  private data: Map<string, DataPoint[]> = new Map();
  private maxRetention: number = 24 * 60 * 60 * 1000;

  addDataPoint(point: DataPoint): void {
    const key = this.getKey(point.metricName, point.dimensions);
    let points = this.data.get(key);
    if (!points) {
      points = [];
      this.data.set(key, points);
    }
    points.push(point);
    this.cleanupOldData(key);
  }

  addDataPoints(points: DataPoint[]): void {
    for (const point of points) {
      this.addDataPoint(point);
    }
  }

  query(
    metricName: string,
    startTime: number,
    endTime: number,
    aggregationType: AggregationType,
    downsample?: DownsampleInterval,
    dimensions?: Record<string, string>
  ): DataPoint[] {
    const results: DataPoint[] = [];
    const interval = downsample ? INTERVAL_MS[downsample] : 1000;

    for (const [key, points] of this.data.entries()) {
      const [keyMetricName, keyDimensions] = this.parseKey(key);
      
      if (keyMetricName !== metricName) continue;
      if (dimensions && !this.matchDimensions(keyDimensions, dimensions)) continue;

      const filtered = points.filter(
        (p) => p.timestamp >= startTime && p.timestamp < endTime
      );

      if (downsample) {
        const downsampled = this.downsampleData(filtered, interval, aggregationType, metricName, keyDimensions);
        results.push(...downsampled);
      } else {
        results.push(...filtered);
      }
    }

    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  private downsampleData(
    points: DataPoint[],
    interval: number,
    aggregationType: AggregationType,
    metricName: string,
    dimensions: Record<string, string>
  ): DataPoint[] {
    if (points.length === 0) return [];

    const buckets: Map<number, Aggregator> = new Map();
    const firstTs = points[0].timestamp;
    const lastTs = points[points.length - 1].timestamp;

    for (let ts = Math.floor(firstTs / interval) * interval; ts <= lastTs; ts += interval) {
      buckets.set(ts, createAggregator(aggregationType));
    }

    for (const point of points) {
      const bucketTs = Math.floor(point.timestamp / interval) * interval;
      const aggregator = buckets.get(bucketTs);
      if (aggregator) {
        aggregator.add(point.value);
      }
    }

    const result: DataPoint[] = [];
    for (const [timestamp, aggregator] of buckets.entries()) {
      result.push({
        timestamp,
        metricName,
        value: aggregator.getResult(),
        dimensions,
      });
    }

    return result;
  }

  private matchDimensions(
    pointDimensions: Record<string, string>,
    filterDimensions: Record<string, string>
  ): boolean {
    for (const [key, value] of Object.entries(filterDimensions)) {
      if (pointDimensions[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private cleanupOldData(key: string): void {
    const points = this.data.get(key);
    if (!points) return;

    const threshold = Date.now() - this.maxRetention;
    const filtered = points.filter((p) => p.timestamp >= threshold);
    
    if (filtered.length !== points.length) {
      this.data.set(key, filtered);
    }
  }

  private getKey(metricName: string, dimensions: Record<string, string>): string {
    const dimStr = Object.entries(dimensions)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join('|');
    return `${metricName}|${dimStr}`;
  }

  private parseKey(key: string): [string, Record<string, string>] {
    const parts = key.split('|');
    const metricName = parts[0];
    const dimensions: Record<string, string> = {};

    for (let i = 1; i < parts.length; i++) {
      const [k, v] = parts[i].split('=');
      if (k) {
        dimensions[k] = v || '';
      }
    }

    return [metricName, dimensions];
  }

  clear(): void {
    this.data.clear();
  }

  getStats(): { totalPoints: number; uniqueKeys: number } {
    let totalPoints = 0;
    for (const points of this.data.values()) {
      totalPoints += points.length;
    }
    return {
      totalPoints,
      uniqueKeys: this.data.size,
    };
  }
}
