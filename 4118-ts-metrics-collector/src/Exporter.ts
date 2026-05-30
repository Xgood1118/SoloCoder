import {
  MetricType,
  MetricSnapshot,
  MetricValue,
  HistogramValue,
  SummaryValue,
  Labels,
} from './types';
import { Registry } from './Registry';
import { formatNumber, formatLabels } from './utils';

export interface ExporterOptions {
  register?: Registry;
  timestamp?: boolean;
}

export interface ExportFilter {
  includeNames?: string[];
  excludeNames?: string[];
  includeLabels?: Labels;
}

export class PrometheusExporter {
  private register: Registry;
  private includeTimestamp: boolean;

  constructor(options: ExporterOptions = {}) {
    this.register = options.register || Registry.getInstance();
    this.includeTimestamp = options.timestamp !== false;
  }

  export(filter?: ExportFilter): string {
    const snapshots = this.register.collect();
    const filteredSnapshots = this.filterSnapshots(snapshots, filter);
    return this.formatSnapshots(filteredSnapshots);
  }

  private filterSnapshots(snapshots: MetricSnapshot[], filter?: ExportFilter): MetricSnapshot[] {
    if (!filter) return snapshots;

    return snapshots.filter((snapshot) => {
      if (filter.includeNames && !filter.includeNames.includes(snapshot.name)) {
        return false;
      }

      if (filter.excludeNames && filter.excludeNames.includes(snapshot.name)) {
        return false;
      }

      return true;
    });
  }

  private formatSnapshots(snapshots: MetricSnapshot[]): string {
    const lines: string[] = [];

    for (const snapshot of snapshots) {
      const helpLine = this.formatHelp(snapshot);
      const typeLine = this.formatType(snapshot);

      lines.push(helpLine);
      lines.push(typeLine);

      const metricLines = this.formatMetricValues(snapshot);
      lines.push(...metricLines);
    }

    return lines.join('\n') + '\n';
  }

  private formatHelp(snapshot: MetricSnapshot): string {
    const escapedHelp = snapshot.help.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
    return `# HELP ${snapshot.name} ${escapedHelp}`;
  }

  private formatType(snapshot: MetricSnapshot): string {
    const prometheusType = this.mapMetricType(snapshot.type);
    return `# TYPE ${snapshot.name} ${prometheusType}`;
  }

  private mapMetricType(type: MetricType): string {
    switch (type) {
      case MetricType.Counter:
        return 'counter';
      case MetricType.Gauge:
        return 'gauge';
      case MetricType.Histogram:
        return 'histogram';
      case MetricType.Summary:
        return 'summary';
      default:
        return 'untyped';
    }
  }

  private formatMetricValues(snapshot: MetricSnapshot): string[] {
    switch (snapshot.type) {
      case MetricType.Counter:
      case MetricType.Gauge:
        return this.formatSimpleValues(snapshot);
      case MetricType.Histogram:
        return this.formatHistogramValues(snapshot);
      case MetricType.Summary:
        return this.formatSummaryValues(snapshot);
      default:
        return [];
    }
  }

  private formatSimpleValues(snapshot: MetricSnapshot): string[] {
    const lines: string[] = [];
    const values = snapshot.values as MetricValue[];

    for (const value of values) {
      const line = this.formatMetricLine(snapshot.name, value.labels, value.value, value.timestamp);
      lines.push(line);
    }

    return lines;
  }

  private formatHistogramValues(snapshot: MetricSnapshot): string[] {
    const lines: string[] = [];
    const values = snapshot.values as HistogramValue[];

    for (const value of values) {
      for (const [le, count] of value.buckets.entries()) {
        const bucketLabels: Labels = { ...value.labels, le: this.formatLe(le) };
        const line = this.formatMetricLine(
          `${snapshot.name}_bucket`,
          bucketLabels,
          count,
          value.timestamp,
        );
        lines.push(line);
      }

      const sumLine = this.formatMetricLine(
        `${snapshot.name}_sum`,
        value.labels,
        value.sum,
        value.timestamp,
      );
      lines.push(sumLine);

      const countLine = this.formatMetricLine(
        `${snapshot.name}_count`,
        value.labels,
        value.count,
        value.timestamp,
      );
      lines.push(countLine);
    }

    return lines;
  }

  private formatSummaryValues(snapshot: MetricSnapshot): string[] {
    const lines: string[] = [];
    const values = snapshot.values as SummaryValue[];

    for (const value of values) {
      for (const [quantile, quantileValue] of value.quantiles.entries()) {
        if (isNaN(quantileValue)) continue;
        const quantileLabels: Labels = { ...value.labels, quantile: quantile.toString() };
        const line = this.formatMetricLine(
          snapshot.name,
          quantileLabels,
          quantileValue,
          value.timestamp,
        );
        lines.push(line);
      }

      const sumLine = this.formatMetricLine(
        `${snapshot.name}_sum`,
        value.labels,
        value.sum,
        value.timestamp,
      );
      lines.push(sumLine);

      const countLine = this.formatMetricLine(
        `${snapshot.name}_count`,
        value.labels,
        value.count,
        value.timestamp,
      );
      lines.push(countLine);
    }

    return lines;
  }

  private formatLe(le: number): string {
    if (le === Infinity) return '+Inf';
    return formatNumber(le);
  }

  private formatMetricLine(
    metricName: string,
    labels: Labels,
    value: number,
    timestamp: number,
  ): string {
    const labelStr = formatLabels(labels);
    const valueStr = formatNumber(value);

    if (labelStr) {
      if (this.includeTimestamp) {
        return `${metricName}{${labelStr}} ${valueStr} ${timestamp}`;
      }
      return `${metricName}{${labelStr}} ${valueStr}`;
    }

    if (this.includeTimestamp) {
      return `${metricName} ${valueStr} ${timestamp}`;
    }
    return `${metricName} ${valueStr}`;
  }

  exportMetrics(): string {
    return this.export();
  }

  exportAsJSON(): unknown {
    return this.register.getMetricsAsJSON();
  }

  contentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8';
  }

  parse(text: string): { name: string; value: number; labels: Labels; timestamp?: number }[] {
    const result: { name: string; value: number; labels: Labels; timestamp?: number }[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      if (!line || line.startsWith('#')) continue;

      const parsed = this.parseMetricLine(line);
      if (parsed) {
        result.push(parsed);
      }
    }

    return result;
  }

  private parseMetricLine(
    line: string,
  ): { name: string; value: number; labels: Labels; timestamp?: number } | null {
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)({[^}]*})?\s+(-?\d+\.?\d*|\d+\.\d+e[+-]?\d+|NaN|\+Inf|-Inf)(?:\s+(\d+))?\s*$/);
    if (!match) return null;

    const [, name, labelPart, valueStr, timestampStr] = match;

    const labels: Labels = {};
    if (labelPart) {
      const labelContent = labelPart.slice(1, -1);
      const labelMatches = labelContent.match(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g);
      if (labelMatches) {
        for (const lm of labelMatches) {
          const [, key, value] = lm.match(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/) || [];
          if (key && value !== undefined) {
            labels[key] = value.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
          }
        }
      }
    }

    let value: number;
    if (valueStr === 'NaN') value = NaN;
    else if (valueStr === '+Inf') value = Infinity;
    else if (valueStr === '-Inf') value = -Infinity;
    else value = parseFloat(valueStr);

    const timestamp = timestampStr ? parseInt(timestampStr, 10) : undefined;

    return { name, value, labels, timestamp };
  }
}

export const prometheusExporter = new PrometheusExporter();
