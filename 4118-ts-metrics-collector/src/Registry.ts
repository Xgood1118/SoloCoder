import { MetricType, AnyMetricOptions, MetricSnapshot, Labels } from './types';
import { Metric } from './metrics/Metric';
import { Counter } from './metrics/Counter';
import { Gauge } from './metrics/Gauge';
import { Histogram } from './metrics/Histogram';
import { Summary } from './metrics/Summary';

type AnyMetric = Counter | Gauge | Histogram | Summary;

export class Registry {
  private static instance: Registry;
  private metrics: Map<string, AnyMetric>;

  private constructor() {
    this.metrics = new Map();
  }

  static getInstance(): Registry {
    if (!Registry.instance) {
      Registry.instance = new Registry();
    }
    return Registry.instance;
  }

  register<T extends AnyMetric>(metric: T): T {
    const name = metric.getName();
    const existing = this.metrics.get(name);

    if (existing && existing !== metric) {
      if (existing.getType() !== metric.getType()) {
        throw new Error(
          `Metric ${name} already registered with different type: ${existing.getType()} vs ${metric.getType()}`,
        );
      }
      return existing as T;
    }

    this.metrics.set(name, metric);
    return metric;
  }

  unregister(name: string): void {
    this.metrics.delete(name);
  }

  get(name: string): AnyMetric | undefined {
    return this.metrics.get(name);
  }

  getCounter(name: string): Counter | undefined {
    const metric = this.metrics.get(name);
    if (metric instanceof Counter) return metric;
    return undefined;
  }

  getGauge(name: string): Gauge | undefined {
    const metric = this.metrics.get(name);
    if (metric instanceof Gauge) return metric;
    return undefined;
  }

  getHistogram(name: string): Histogram | undefined {
    const metric = this.metrics.get(name);
    if (metric instanceof Histogram) return metric;
    return undefined;
  }

  getSummary(name: string): Summary | undefined {
    const metric = this.metrics.get(name);
    if (metric instanceof Summary) return metric;
    return undefined;
  }

  has(name: string): boolean {
    return this.metrics.has(name);
  }

  getMetrics(): AnyMetric[] {
    return Array.from(this.metrics.values());
  }

  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  getSnapshots(): MetricSnapshot[] {
    const snapshots: MetricSnapshot[] = [];
    for (const metric of this.metrics.values()) {
      snapshots.push(metric.getSnapshot());
    }
    return snapshots;
  }

  collect(): MetricSnapshot[] {
    const snapshots: MetricSnapshot[] = [];
    for (const metric of this.metrics.values()) {
      snapshots.push(metric.collect());
    }
    return snapshots;
  }

  reset(): void {
    for (const metric of this.metrics.values()) {
      metric.reset();
    }
  }

  clear(): void {
    this.metrics.clear();
  }

  createCounter(options: Omit<AnyMetricOptions, 'type'> & { type?: MetricType.Counter }): Counter {
    const existing = this.getCounter(options.name);
    if (existing) return existing;

    const counter = new Counter(options);
    return this.register(counter);
  }

  createGauge(options: Omit<AnyMetricOptions, 'type'> & { type?: MetricType.Gauge }): Gauge {
    const existing = this.getGauge(options.name);
    if (existing) return existing;

    const gauge = new Gauge(options);
    return this.register(gauge);
  }

  createHistogram(
    options: Omit<AnyMetricOptions, 'type'> & { type?: MetricType.Histogram; buckets?: number[] },
  ): Histogram {
    const existing = this.getHistogram(options.name);
    if (existing) return existing;

    const histogram = new Histogram(options);
    return this.register(histogram);
  }

  createSummary(
    options: Omit<AnyMetricOptions, 'type'> & {
      type?: MetricType.Summary;
      percentiles?: number[];
      maxAgeSeconds?: number;
      ageBuckets?: number;
    },
  ): Summary {
    const existing = this.getSummary(options.name);
    if (existing) return existing;

    const summary = new Summary(options);
    return this.register(summary);
  }

  getSingleMetric(name: string, labels: Labels = {}): number {
    const metric = this.metrics.get(name);
    if (!metric) return NaN;
    return metric.get(labels);
  }

  getMetricsAsJSON(): { name: string; type: string; help: string; values: unknown[] }[] {
    return this.getSnapshots().map((s) => ({
      name: s.name,
      type: s.type,
      help: s.help,
      values: s.values.map((v) => JSON.parse(JSON.stringify(v))),
    }));
  }
}

export const register = Registry.getInstance();

export const defaultRegistry = Registry.getInstance();
