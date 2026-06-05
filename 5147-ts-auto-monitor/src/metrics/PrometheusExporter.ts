import client from 'prom-client';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import config from '../config/env';
import { MetricValue } from '../types/metrics';

export class PrometheusExporter {
  private logger: ModuleLogger;
  private registry: client.Registry;
  private gauges: Map<string, client.Gauge<string>> = new Map();
  private counters: Map<string, client.Counter<string>> = new Map();
  private histograms: Map<string, client.Histogram<string>> = new Map();
  private summaries: Map<string, client.Summary<string>> = new Map();
  private prefix: string;
  private enabled: boolean;

  constructor() {
    this.logger = createModuleLogger('Prometheus');
    this.registry = new client.Registry();
    this.prefix = config.prometheusPrefix || 'monitor_';
    this.enabled = config.prometheusEnabled;

    if (this.enabled) {
      this.registry.setDefaultLabels({
        service: config.serviceName,
        instance: config.instanceId,
        env: config.env,
      });
      client.collectDefaultMetrics({ register: this.registry, prefix: this.prefix });
      this.logger.info('Prometheus指标导出器已初始化');
    }
  }

  registerGauge(name: string, help: string, labelNames: string[] = []): void {
    if (!this.enabled) return;

    const fullName = `${this.prefix}${name}`;
    if (!this.gauges.has(fullName)) {
      const gauge = new client.Gauge({
        name: fullName,
        help,
        labelNames,
      });
      this.gauges.set(fullName, gauge);
      this.registry.registerMetric(gauge);
      this.logger.debug('已注册Gauge指标', { name: fullName });
    }
  }

  registerCounter(name: string, help: string, labelNames: string[] = []): void {
    if (!this.enabled) return;

    const fullName = `${this.prefix}${name}`;
    if (!this.counters.has(fullName)) {
      const counter = new client.Counter({
        name: fullName,
        help,
        labelNames,
      });
      this.counters.set(fullName, counter);
      this.registry.registerMetric(counter);
      this.logger.debug('已注册Counter指标', { name: fullName });
    }
  }

  registerHistogram(
    name: string,
    help: string,
    buckets: number[] = [0.1, 0.5, 1, 5, 10],
    labelNames: string[] = []
  ): void {
    if (!this.enabled) return;

    const fullName = `${this.prefix}${name}`;
    if (!this.histograms.has(fullName)) {
      const histogram = new client.Histogram({
        name: fullName,
        help,
        buckets,
        labelNames,
      });
      this.histograms.set(fullName, histogram);
      this.registry.registerMetric(histogram);
      this.logger.debug('已注册Histogram指标', { name: fullName });
    }
  }

  registerSummary(
    name: string,
    help: string,
    percentiles: number[] = [0.5, 0.9, 0.95, 0.99],
    labelNames: string[] = []
  ): void {
    if (!this.enabled) return;

    const fullName = `${this.prefix}${name}`;
    if (!this.summaries.has(fullName)) {
      const summary = new client.Summary({
        name: fullName,
        help,
        percentiles,
        labelNames,
      });
      this.summaries.set(fullName, summary);
      this.registry.registerMetric(summary);
      this.logger.debug('已注册Summary指标', { name: fullName });
    }
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    const fullName = `${this.prefix}${name}`;
    const gauge = this.gauges.get(fullName);
    if (gauge) {
      gauge.set(labels, value);
    }
  }

  incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    const fullName = `${this.prefix}${name}`;
    const counter = this.counters.get(fullName);
    if (counter) {
      counter.inc(labels, value);
    }
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    const fullName = `${this.prefix}${name}`;
    const histogram = this.histograms.get(fullName);
    if (histogram) {
      histogram.observe(labels, value);
    }
  }

  observeSummary(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.enabled) return;

    const fullName = `${this.prefix}${name}`;
    const summary = this.summaries.get(fullName);
    if (summary) {
      summary.observe(labels, value);
    }
  }

  updateMetrics(metrics: MetricValue[]): void {
    if (!this.enabled) return;

    for (const metric of metrics) {
      const fullName = `${this.prefix}${metric.name}`;

      if (!this.gauges.has(fullName)) {
        this.registerGauge(metric.name, metric.name, Object.keys(metric.labels));
      }

      this.setGauge(metric.name, metric.value, metric.labels);
    }
  }

  async getMetrics(): Promise<string> {
    if (!this.enabled) {
      return '';
    }
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getRegistry(): client.Registry {
    return this.registry;
  }
}
