import type { DataPoint, AggregationConfig, AggregationResult } from '../types';
import { createAggregator, type Aggregator } from '../utils/aggregators';

interface WindowKey {
  metricName: string;
  dimensions: string;
  windowStart: number;
}

interface WindowState {
  dataPoints: DataPoint[];
  aggregator: Aggregator;
}

export interface AggregationCallback {
  (results: AggregationResult[]): void;
}

export class SlidingWindowAggregator {
  private config: AggregationConfig;
  private windows: Map<string, WindowState> = new Map();
  private latestTimestamps: Map<string, number> = new Map();
  private callback: AggregationCallback;

  constructor(config: AggregationConfig, callback: AggregationCallback) {
    this.config = config;
    this.callback = callback;
  }

  addDataPoint(point: DataPoint): void {
    if (point.metricName !== this.config.metricName) return;

    const dimensionKey = this.getDimensionKey(point.dimensions);
    const latestTs = this.latestTimestamps.get(dimensionKey) || 0;
    this.latestTimestamps.set(dimensionKey, Math.max(latestTs, point.timestamp));

    const windowStarts = this.getAffectedWindows(point.timestamp, dimensionKey);

    for (const windowStart of windowStarts) {
      const windowEnd = windowStart + this.config.windowSize;
      if (point.timestamp >= windowStart && point.timestamp < windowEnd) {
        const windowKey = this.getWindowKey(point.metricName, dimensionKey, windowStart);
        this.addToWindow(windowKey, point, windowStart, windowEnd);
      }
    }
  }

  addDataPoints(points: DataPoint[]): void {
    for (const point of points) {
      this.addDataPoint(point);
    }
    this.purgeOldWindows();
    this.emitResults();
  }

  private getAffectedWindows(timestamp: number, dimensionKey: string): number[] {
    const windows: number[] = [];
    const slideStep = this.config.slideStep;
    const windowSize = this.config.windowSize;

    if (this.config.windowStartMode === 'fixed') {
      const firstWindowStart = Math.floor(timestamp / slideStep) * slideStep;
      const earliestWindowStart = Math.max(0, firstWindowStart - windowSize + slideStep);
      
      for (let start = earliestWindowStart; start <= firstWindowStart; start += slideStep) {
        const end = start + windowSize;
        if (timestamp >= start && timestamp < end) {
          windows.push(start);
        }
      }
    } else {
      const latestTs = this.latestTimestamps.get(dimensionKey) || timestamp;
      const currentWindowEnd = Math.ceil(latestTs / slideStep) * slideStep;
      const currentWindowStart = currentWindowEnd - windowSize;
      
      if (timestamp >= currentWindowStart && timestamp < currentWindowEnd) {
        windows.push(currentWindowStart);
      }
    }

    return windows;
  }

  private addToWindow(
    windowKey: string,
    point: DataPoint,
    windowStart: number,
    windowEnd: number
  ): void {
    let window = this.windows.get(windowKey);
    if (!window) {
      window = {
        dataPoints: [],
        aggregator: createAggregator(this.config.aggregationType),
      };
      this.windows.set(windowKey, window);
    }

    window.dataPoints.push(point);
    window.aggregator.add(point.value);
  }

  private purgeOldWindows(): void {
    const maxWindowSize = this.config.windowSize;
    const now = Date.now();
    const purgeThreshold = now - maxWindowSize * 2;

    for (const [key, window] of this.windows.entries()) {
      const [metricName, dimKey, windowStartStr] = key.split('|');
      const windowStart = parseInt(windowStartStr, 10);
      const windowEnd = windowStart + this.config.windowSize;

      if (windowEnd < purgeThreshold) {
        this.windows.delete(key);
        continue;
      }

      const filtered = window.dataPoints.filter(
        (p) => p.timestamp >= windowStart && p.timestamp < windowEnd
      );

      if (filtered.length !== window.dataPoints.length) {
        window.aggregator.reset();
        window.dataPoints = filtered;
        for (const p of filtered) {
          window.aggregator.add(p.value);
        }
      }
    }
  }

  private emitResults(): void {
    const results: AggregationResult[] = [];

    for (const [key, window] of this.windows.entries()) {
      const [metricName, dimKey, windowStartStr] = key.split('|');
      const windowStart = parseInt(windowStartStr, 10);
      const windowEnd = windowStart + this.config.windowSize;
      const dimensions = this.parseDimensionKey(dimKey);

      results.push({
        windowStart,
        windowEnd,
        metricName,
        aggregationType: this.config.aggregationType,
        value: window.aggregator.getResult(),
        dimensions,
        dataPointCount: window.dataPoints.length,
      });
    }

    if (results.length > 0) {
      this.callback(results);
    }
  }

  private getDimensionKey(dimensions: Record<string, string>): string {
    const groupBy = this.config.groupBy || [];
    if (groupBy.length === 0) {
      return 'all';
    }
    return groupBy
      .map((key) => `${key}=${dimensions[key] || ''}`)
      .sort()
      .join('|');
  }

  private parseDimensionKey(key: string): Record<string, string> {
    if (key === 'all') {
      return {};
    }
    const result: Record<string, string> = {};
    for (const pair of key.split('|')) {
      const [k, v] = pair.split('=');
      if (k) {
        result[k] = v || '';
      }
    }
    return result;
  }

  private getWindowKey(metricName: string, dimensionKey: string, windowStart: number): string {
    return `${metricName}|${dimensionKey}|${windowStart}`;
  }

  getConfig(): AggregationConfig {
    return this.config;
  }

  setConfig(config: AggregationConfig): void {
    this.config = config;
    this.windows.clear();
    this.latestTimestamps.clear();
  }

  clear(): void {
    this.windows.clear();
    this.latestTimestamps.clear();
  }
}
