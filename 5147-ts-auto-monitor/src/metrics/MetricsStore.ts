import fs from 'fs';
import path from 'path';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import config from '../config/env';
import { MetricValue, MetricLabels } from '../types/metrics';

export type DownsampleLevel = 'raw' | '1m' | '5m' | '1h';

interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

interface MetricData {
  [key: string]: TimeSeriesPoint[];
}

export interface MetricQueryResult {
  metricName: string;
  labels: MetricLabels;
  data: TimeSeriesPoint[];
}

export class MetricsStore {
  private logger: ModuleLogger;
  private rawData: Map<string, MetricData> = new Map();
  private downsampledData: Map<DownsampleLevel, Map<string, MetricData>> = new Map();
  private dataDir: string;
  private retentionDays: number;
  private lastDownsample: number = 0;
  private downsampleInterval: number = 60000;

  constructor() {
    this.logger = createModuleLogger('MetricsStore');
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.retentionDays = config.metricRetentionDays;
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getMetricKey(metricName: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${metricName}:${labelStr}`;
  }

  addMetric(metric: MetricValue): void {
    const key = this.getMetricKey(metric.name, metric.labels);

    if (!this.rawData.has(metric.name)) {
      this.rawData.set(metric.name, {});
    }

    const metricData = this.rawData.get(metric.name)!;
    if (!metricData[key]) {
      metricData[key] = [];
    }

    metricData[key].push({
      timestamp: metric.timestamp,
      value: metric.value,
    });

    const now = Date.now();
    if (now - this.lastDownsample > this.downsampleInterval) {
      this.performDownsample();
      this.lastDownsample = now;
    }
  }

  addMetrics(metrics: MetricValue[]): void {
    for (const metric of metrics) {
      this.addMetric(metric);
    }
  }

  private performDownsample(): void {
    this.downsampleLevel('1m', 60000);
    this.downsampleLevel('5m', 300000);
    this.downsampleLevel('1h', 3600000);
    this.cleanupOldData();
  }

  private downsampleLevel(level: DownsampleLevel, interval: number): void {
    if (!this.downsampledData.has(level)) {
      this.downsampledData.set(level, new Map());
    }

    const levelData = this.downsampledData.get(level)!;
    const now = Date.now();

    for (const [metricName, metricData] of this.rawData.entries()) {
      if (!levelData.has(metricName)) {
        levelData.set(metricName, {});
      }

      const downsampledMetric = levelData.get(metricName)!;

      for (const [key, points] of Object.entries(metricData)) {
        if (!downsampledMetric[key]) {
          downsampledMetric[key] = [];
        }

        const buckets: Map<number, number[]> = new Map();

        for (const point of points) {
          const bucket = Math.floor(point.timestamp / interval) * interval;
          if (!buckets.has(bucket)) {
            buckets.set(bucket, []);
          }
          buckets.get(bucket)!.push(point.value);
        }

        const result: TimeSeriesPoint[] = [];
        for (const [bucket, values] of buckets) {
          const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
          result.push({ timestamp: bucket, value: avgValue });
        }

        downsampledMetric[key] = result;
      }
    }

    this.logger.debug('降采样完成', { level, duration: Date.now() - now });
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;

    for (const metricData of this.rawData.values()) {
      for (const key of Object.keys(metricData)) {
        metricData[key] = metricData[key].filter((p) => p.timestamp > cutoffTime);
      }
    }

    for (const levelData of this.downsampledData.values()) {
      for (const metricData of levelData.values()) {
        for (const key of Object.keys(metricData)) {
          metricData[key] = metricData[key].filter((p) => p.timestamp > cutoffTime);
        }
      }
    }
  }

  query(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: MetricLabels,
    downsampleLevel: DownsampleLevel = 'raw'
  ): MetricQueryResult | null {
    let dataSource: MetricData | undefined;

    if (downsampleLevel === 'raw') {
      dataSource = this.rawData.get(metricName);
    } else {
      const levelData = this.downsampledData.get(downsampleLevel);
      dataSource = levelData?.get(metricName);
    }

    if (!dataSource) {
      return null;
    }

    const key = this.getMetricKey(metricName, labels || {});
    const points = dataSource[key] || [];

    const filtered = points.filter(
      (p) => p.timestamp >= startTime && p.timestamp <= endTime
    );

    return {
      metricName,
      labels: labels || {},
      data: filtered,
    };
  }

  queryRange(
    metricName: string,
    startTime: number,
    endTime: number,
    downsampleLevel: DownsampleLevel = 'raw'
  ): MetricQueryResult[] {
    const results: MetricQueryResult[] = [];
    let dataSource: MetricData | undefined;

    if (downsampleLevel === 'raw') {
      dataSource = this.rawData.get(metricName);
    } else {
      const levelData = this.downsampledData.get(downsampleLevel);
      dataSource = levelData?.get(metricName);
    }

    if (!dataSource) {
      return results;
    }

    for (const [key, points] of Object.entries(dataSource)) {
      const filtered = points.filter(
        (p) => p.timestamp >= startTime && p.timestamp <= endTime
      );

      if (filtered.length > 0) {
        const labels = this.parseLabelsFromKey(key, metricName);
        results.push({
          metricName,
          labels,
          data: filtered,
        });
      }
    }

    return results;
  }

  private parseLabelsFromKey(key: string, metricName: string): MetricLabels {
    const labels: MetricLabels = {};
    const labelPart = key.substring(metricName.length + 1);

    if (labelPart) {
      const pairs = labelPart.split(',');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (k && v) {
          labels[k] = v;
        }
      }
    }

    return labels;
  }

  getMetricNames(): string[] {
    return Array.from(this.rawData.keys());
  }

  getStoredMetricsCount(): number {
    let count = 0;
    for (const metricData of this.rawData.values()) {
      count += Object.keys(metricData).length;
    }
    return count;
  }

  getTotalPoints(): number {
    let count = 0;
    for (const metricData of this.rawData.values()) {
      for (const points of Object.values(metricData)) {
        count += points.length;
      }
    }
    return count;
  }
}
