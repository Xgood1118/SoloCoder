import {
  AggregationFunction,
  AggregationConfig,
  AggregatedData,
  Labels,
  TimeSeriesPoint,
  SlidingWindowOptions,
} from './types';
import { labelsToKey, now, percentile, floatEqual } from './utils';
import { StorageAdapter } from './types';

interface WindowState {
  start: number;
  end: number;
  points: TimeSeriesPoint[];
  lastSlide: number;
}

interface AggregationTarget {
  metricName: string;
  config: AggregationConfig;
  windows: Map<string, WindowState>;
  lastFlush: number;
}

export interface AggregatorOptions {
  maxMemoryBytes?: number;
  flushIntervalMs?: number;
  storage?: StorageAdapter;
  checkpointPath?: string;
  minSampleSize?: number;
}

export interface AggregatorStats {
  totalPoints: number;
  totalAggregations: number;
  memoryUsageBytes: number;
  activeTargets: number;
}

export class Aggregator {
  private targets: Map<string, AggregationTarget>;
  private maxMemoryBytes: number;
  private flushIntervalMs: number;
  private storage?: StorageAdapter;
  private checkpointPath?: string;
  private minSampleSize: number;
  private totalPoints: number = 0;
  private totalAggregations: number = 0;
  private flushTimer?: NodeJS.Timeout;
  private slideTimer?: NodeJS.Timeout;
  private onAlert?: (type: string, message: string) => void;

  constructor(options: AggregatorOptions = {}) {
    this.targets = new Map();
    this.maxMemoryBytes = options.maxMemoryBytes || 100 * 1024 * 1024;
    this.flushIntervalMs = options.flushIntervalMs || 60000;
    this.storage = options.storage;
    this.checkpointPath = options.checkpointPath;
    this.minSampleSize = options.minSampleSize || 10;
  }

  setAlertHandler(handler: (type: string, message: string) => void): void {
    this.onAlert = handler;
  }

  addTarget(metricName: string, config: AggregationConfig): void {
    const key = `${metricName}:${config.function}:${config.windowMs}`;
    if (this.targets.has(key)) return;

    this.targets.set(key, {
      metricName,
      config,
      windows: new Map(),
      lastFlush: now(),
    });
  }

  removeTarget(metricName: string, config: AggregationConfig): void {
    const key = `${metricName}:${config.function}:${config.windowMs}`;
    this.targets.delete(key);
  }

  observe(metricName: string, value: number, labels: Labels = {}, timestamp?: number): void {
    if (this.isMemoryExceeded()) {
      this.handleMemoryPressure();
    }

    const point: TimeSeriesPoint = {
      value,
      labels,
      timestamp: timestamp || now(),
    };

    for (const target of this.targets.values()) {
      if (target.metricName !== metricName) continue;

      const labelKey = labelsToKey(labels);
      let window = target.windows.get(labelKey);

      if (!window) {
        const nowTime = point.timestamp;
        window = this.createWindow(nowTime, target.config);
        target.windows.set(labelKey, window);
      }

      const windowAdjusted = this.adjustWindow(window, point, target.config);
      if (!windowAdjusted) {
        window.points.push(point);
      }
      this.totalPoints++;
    }
  }

  private createWindow(startTime: number, config: AggregationConfig): WindowState {
    const windowStart = Math.floor(startTime / config.windowMs) * config.windowMs;
    return {
      start: windowStart,
      end: windowStart + config.windowMs,
      points: [],
      lastSlide: windowStart,
    };
  }

  private adjustWindow(window: WindowState, point: TimeSeriesPoint, config: AggregationConfig): boolean {
    const slideMs = config.slideMs || config.windowMs;
    const timestamp = point.timestamp;

    if (timestamp < window.start) {
      // Returns true if point was inserted by handleOutOfOrder, false if dropped (too old)
      return this.handleOutOfOrder(window, point, config);
    }

    if (timestamp >= window.end) {
      const newStart = Math.floor(timestamp / config.windowMs) * config.windowMs;
      window.start = newStart;
      window.end = newStart + config.windowMs;
      window.points = window.points.filter((p) => p.timestamp >= window.start);
      window.lastSlide = newStart;
    }

    if (timestamp - window.lastSlide >= slideMs) {
      window.lastSlide = Math.floor(timestamp / slideMs) * slideMs;
    }

    return false;
  }

  private handleOutOfOrder(window: WindowState, point: TimeSeriesPoint, config: AggregationConfig): boolean {
    const timestamp = point.timestamp;
    const windowStart = Math.floor(timestamp / config.windowMs) * config.windowMs;

    if (windowStart < window.start - config.windowMs * 2) {
      if (this.onAlert) {
        this.onAlert('out_of_order', `Data point too old: ${new Date(timestamp).toISOString()}`);
      }
      return true; // too old — point dropped, caller should NOT add
    }

    if (windowStart < window.start) {
      window.start = windowStart;
      window.end = windowStart + config.windowMs;
      window.lastSlide = windowStart;
    }

    const targetPoints = window.points;
    let insertIndex = 0;
    while (insertIndex < targetPoints.length && targetPoints[insertIndex].timestamp < timestamp) {
      insertIndex++;
    }

    targetPoints.splice(insertIndex, 0, point);
    return false; // inserted via splice — caller should NOT add again
  }

  aggregate(metricName: string, labels?: Labels): AggregatedData[] {
    const results: AggregatedData[] = [];

    for (const target of this.targets.values()) {
      if (target.metricName !== metricName) continue;

      if (labels && Object.keys(labels).length > 0) {
        const labelKey = labelsToKey(labels);
        const window = target.windows.get(labelKey);
        if (window && window.points.length >= this.minSampleSize) {
          const data = this.calculateAggregation(window, target.config, metricName, labels);
          if (data) {
            results.push(data);
            this.totalAggregations++;
          }
        }
      } else {
        for (const [labelKey, window] of target.windows.entries()) {
          if (window.points.length < this.minSampleSize) continue;
          const entryLabels = this.keyToLabels(labelKey);
          const data = this.calculateAggregation(window, target.config, metricName, entryLabels);
          if (data) {
            results.push(data);
            this.totalAggregations++;
          }
        }
      }
    }

    return results;
  }

  aggregateAll(): AggregatedData[] {
    const results: AggregatedData[] = [];

    for (const target of this.targets.values()) {
      for (const [labelKey, window] of target.windows.entries()) {
        if (window.points.length < this.minSampleSize) continue;

        const labels = this.keyToLabels(labelKey);
        const data = this.calculateAggregation(window, target.config, target.metricName, labels);
        if (data) {
          results.push(data);
          this.totalAggregations++;
        }
      }
    }

    return results;
  }

  private calculateAggregation(
    window: WindowState,
    config: AggregationConfig,
    metricName: string,
    labels: Labels,
  ): AggregatedData | null {
    const values = window.points.map((p) => p.value);
    const currentTime = now();

    let value: number;
    switch (config.function) {
      case AggregationFunction.Sum:
        value = values.reduce((a, b) => a + b, 0);
        break;
      case AggregationFunction.Avg:
        value = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case AggregationFunction.Min:
        value = Math.min(...values);
        break;
      case AggregationFunction.Max:
        value = Math.max(...values);
        break;
      case AggregationFunction.Count:
        value = values.length;
        break;
      case AggregationFunction.Percentile:
        value = percentile(values, config.percentile || 0.95);
        break;
      default:
        return null;
    }

    if (isNaN(value) && !floatEqual(value, NaN)) return null;

    return {
      metricName,
      labels,
      function: config.function,
      value,
      timestamp: currentTime,
      windowStart: window.start,
      windowEnd: window.end,
    };
  }

  private keyToLabels(key: string): Labels {
    if (!key) return {};
    const labels: Labels = {};
    key.split(',').forEach((part) => {
      const [k, v] = part.split('=');
      if (k && v !== undefined) {
        labels[k] = v;
      }
    });
    return labels;
  }

  async flush(): Promise<void> {
    const aggregated = this.aggregateAll();
    if (aggregated.length === 0) return;

    if (this.storage && this.storage.isConnected()) {
      await this.storage.write(aggregated);
    }

    for (const target of this.targets.values()) {
      target.lastFlush = now();
      for (const window of target.windows.values()) {
        window.points = window.points.filter((p) => p.timestamp > now() - target.config.windowMs * 2);
      }
    }
  }

  start(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((e) => console.error('Flush error:', e));
    }, this.flushIntervalMs);

    this.slideTimer = setInterval(() => {
      this.slideWindows();
    }, 1000);
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    if (this.slideTimer) {
      clearInterval(this.slideTimer);
      this.slideTimer = undefined;
    }
  }

  private slideWindows(): void {
    const currentTime = now();
    for (const target of this.targets.values()) {
      const slideMs = target.config.slideMs || target.config.windowMs;
      for (const window of target.windows.values()) {
        if (currentTime - window.lastSlide >= slideMs) {
          window.points = window.points.filter((p) => p.timestamp >= currentTime - target.config.windowMs);
          window.lastSlide = Math.floor(currentTime / slideMs) * slideMs;
        }
      }
    }
  }

  private isMemoryExceeded(): boolean {
    const estimatedMemory = this.estimateMemoryUsage();
    return estimatedMemory > this.maxMemoryBytes;
  }

  private estimateMemoryUsage(): number {
    let total = 0;
    for (const target of this.targets.values()) {
      for (const window of target.windows.values()) {
        total += window.points.length * 40;
      }
    }
    return total;
  }

  private handleMemoryPressure(): void {
    if (this.onAlert) {
      this.onAlert('memory_pressure', `Memory usage exceeded ${this.maxMemoryBytes} bytes`);
    }

    let totalPoints = 0;
    for (const target of this.targets.values()) {
      for (const window of target.windows.values()) {
        totalPoints += window.points.length;
      }
    }

    const pointsToRemove = Math.ceil(totalPoints * 0.25);
    let removed = 0;

    for (const target of this.targets.values()) {
      for (const window of target.windows.values()) {
        const removeCount = Math.ceil(window.points.length * 0.25);
        window.points.splice(0, removeCount);
        removed += removeCount;
        if (removed >= pointsToRemove) break;
      }
      if (removed >= pointsToRemove) break;
    }
  }

  getStats(): AggregatorStats {
    return {
      totalPoints: this.totalPoints,
      totalAggregations: this.totalAggregations,
      memoryUsageBytes: this.estimateMemoryUsage(),
      activeTargets: this.targets.size,
    };
  }

  getValues(metricName: string, labels: Labels = {}): TimeSeriesPoint[] {
    const labelKey = labelsToKey(labels);
    for (const target of this.targets.values()) {
      if (target.metricName !== metricName) continue;
      const window = target.windows.get(labelKey);
      if (window) {
        return [...window.points];
      }
    }
    return [];
  }

  clear(): void {
    for (const target of this.targets.values()) {
      target.windows.clear();
    }
    this.totalPoints = 0;
    this.totalAggregations = 0;
  }

  reaggregate(data: AggregatedData[], config: AggregationConfig): AggregatedData[] {
    const result: AggregatedData[] = [];

    const grouped = new Map<string, AggregatedData[]>();
    for (const d of data) {
      const key = labelsToKey(d.labels);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(d);
    }

    for (const [labelKey, group] of grouped.entries()) {
      const labels = this.keyToLabels(labelKey);
      const values = group.map((d) => d.value);
      const timestamps = group.map((d) => d.timestamp);

      let value: number;
      switch (config.function) {
        case AggregationFunction.Sum:
          value = values.reduce((a, b) => a + b, 0);
          break;
        case AggregationFunction.Avg:
          value = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case AggregationFunction.Min:
          value = Math.min(...values);
          break;
        case AggregationFunction.Max:
          value = Math.max(...values);
          break;
        case AggregationFunction.Count:
          value = values.length;
          break;
        default:
          continue;
      }

      result.push({
        metricName: data[0].metricName,
        labels,
        function: config.function,
        value,
        timestamp: Math.max(...timestamps),
        windowStart: Math.min(...group.map((d) => d.windowStart)),
        windowEnd: Math.max(...group.map((d) => d.windowEnd)),
      });
    }

    return result;
  }
}

export class SlidingWindow {
  private windowSize: number;
  private slideInterval: number;
  private maxPoints: number;
  private points: TimeSeriesPoint[];
  private lastSlide: number;

  constructor(options: SlidingWindowOptions) {
    this.windowSize = options.windowSize;
    this.slideInterval = options.slideInterval;
    this.maxPoints = options.maxPoints || 10000;
    this.points = [];
    this.lastSlide = now();
  }

  add(value: number, labels: Labels = {}, timestamp?: number): void {
    const point: TimeSeriesPoint = {
      value,
      labels,
      timestamp: timestamp || now(),
    };

    this.points.push(point);
    this.cleanup();

    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }

    if (point.timestamp - this.lastSlide >= this.slideInterval) {
      this.lastSlide = point.timestamp;
    }
  }

  private cleanup(): void {
    const cutoff = now() - this.windowSize;
    while (this.points.length > 0 && this.points[0].timestamp < cutoff) {
      this.points.shift();
    }
  }

  getPoints(): TimeSeriesPoint[] {
    this.cleanup();
    return [...this.points];
  }

  aggregate(fn: AggregationFunction, p?: number): number {
    this.cleanup();
    if (this.points.length === 0) return NaN;

    const values = this.points.map((p) => p.value);

    switch (fn) {
      case AggregationFunction.Sum:
        return values.reduce((a, b) => a + b, 0);
      case AggregationFunction.Avg:
        return values.reduce((a, b) => a + b, 0) / values.length;
      case AggregationFunction.Min:
        return Math.min(...values);
      case AggregationFunction.Max:
        return Math.max(...values);
      case AggregationFunction.Count:
        return values.length;
      case AggregationFunction.Percentile:
        return percentile(values, p || 0.95);
      default:
        return NaN;
    }
  }

  getAggregatedWindows(fn: AggregationFunction, p?: number): AggregatedData[] {
    this.cleanup();
    const result: AggregatedData[] = [];
    if (this.points.length === 0) return result;

    const windowStart = Math.floor(this.points[0].timestamp / this.slideInterval) * this.slideInterval;
    const windowEnd = windowStart + this.slideInterval;

    const windowValues = this.points
      .filter((p) => p.timestamp >= windowStart && p.timestamp < windowEnd)
      .map((p) => p.value);

    if (windowValues.length > 0) {
      let value: number;
      switch (fn) {
        case AggregationFunction.Sum:
          value = windowValues.reduce((a, b) => a + b, 0);
          break;
        case AggregationFunction.Avg:
          value = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
          break;
        case AggregationFunction.Min:
          value = Math.min(...windowValues);
          break;
        case AggregationFunction.Max:
          value = Math.max(...windowValues);
          break;
        case AggregationFunction.Count:
          value = windowValues.length;
          break;
        case AggregationFunction.Percentile:
          value = percentile(windowValues, p || 0.95);
          break;
        default:
          return result;
      }

      result.push({
        metricName: 'sliding_window',
        labels: {},
        function: fn,
        value,
        timestamp: now(),
        windowStart,
        windowEnd,
      });
    }

    return result;
  }

  reset(): void {
    this.points = [];
    this.lastSlide = now();
  }

  size(): number {
    this.cleanup();
    return this.points.length;
  }
}
