import { Labels, EPSILON } from './types';

export function labelsToKey(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join(',');
}

export function keyToLabels(key: string): Labels {
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

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

export function floatEqual(a: number, b: number, epsilon: number = EPSILON): boolean {
  return Math.abs(a - b) < epsilon;
}

export function formatNumber(n: number): string {
  if (Number.isInteger(n)) {
    return n.toString();
  }
  return n.toFixed(12).replace(/\.?0+$/, '');
}

export function escapeLabelValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

export function escapeMetricName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_:]/g, '_');
}

export function validateMetricName(name: string): boolean {
  return /^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name);
}

export function validateLabelName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && !name.startsWith('__');
}

export function formatLabels(labels: Labels): string {
  const parts: string[] = [];
  const keys = Object.keys(labels).sort();
  for (const key of keys) {
    const value = escapeLabelValue(labels[key]);
    parts.push(`${key}="${value}"`);
  }
  return parts.join(',');
}

export function now(): number {
  return Date.now();
}

export function monotonicNow(): number {
  const hrtime = process.hrtime();
  return hrtime[0] * 1000 + hrtime[1] / 1e6;
}

export class AtomicNumber {
  private value: number = 0;

  inc(delta: number = 1): number {
    this.value += delta;
    return this.value;
  }

  dec(delta: number = 1): number {
    this.value -= delta;
    return this.value;
  }

  set(value: number): void {
    this.value = value;
  }

  get(): number {
    return this.value;
  }
}

export class ExponentialBackoff {
  private attempt: number = 0;
  private readonly baseMs: number;
  private readonly maxMs: number;
  private readonly factor: number;

  constructor(baseMs: number = 1000, maxMs: number = 60000, factor: number = 2) {
    this.baseMs = baseMs;
    this.maxMs = maxMs;
    this.factor = factor;
  }

  nextDelay(): number {
    const delay = Math.min(this.baseMs * Math.pow(this.factor, this.attempt), this.maxMs);
    this.attempt++;
    return delay;
  }

  reset(): void {
    this.attempt = 0;
  }
}

export class HighCardinalityDetector {
  private labelCounts: Map<string, Map<string, number>> = new Map();
  private readonly maxCardinality: number;

  constructor(maxCardinality: number = 1000) {
    this.maxCardinality = maxCardinality;
  }

  observe(metricName: string, labelValue: string): boolean {
    let metricLabels = this.labelCounts.get(metricName);
    if (!metricLabels) {
      metricLabels = new Map();
      this.labelCounts.set(metricName, metricLabels);
    }
    const count = (metricLabels.get(labelValue) || 0) + 1;
    metricLabels.set(labelValue, count);
    return metricLabels.size > this.maxCardinality;
  }

  getCardinality(metricName: string): number {
    return this.labelCounts.get(metricName)?.size || 0;
  }

  getHighCardinalityMetrics(): string[] {
    const result: string[] = [];
    for (const [name, labels] of this.labelCounts.entries()) {
      if (labels.size > this.maxCardinality) {
        result.push(name);
      }
    }
    return result;
  }

  reset(): void {
    this.labelCounts.clear();
  }
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  if (p <= 0) return Math.min(...values);
  if (p >= 1) return Math.max(...values);

  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
