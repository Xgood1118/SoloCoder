import { Counter, Gauge, Histogram, Summary } from '../src/metrics';
import { Registry, defaultRegistry } from '../src/Registry';
import { PrometheusExporter } from '../src/Exporter';
import { MetricType } from '../src/types';

describe('Metrics', () => {
  beforeEach(() => {
    defaultRegistry.clear();
  });

  describe('Counter', () => {
    it('should increment counter', () => {
      const counter = new Counter({
        name: 'test_counter',
        help: 'Test counter',
      });

      counter.inc();
      expect(counter.get()).toBe(1);

      counter.inc(5);
      expect(counter.get()).toBe(6);
    });

    it('should handle labels', () => {
      const counter = new Counter({
        name: 'test_counter_labels',
        help: 'Test counter with labels',
        labelNames: ['method', 'status'],
      });

      counter.inc(1, { method: 'GET', status: '200' });
      counter.inc(2, { method: 'POST', status: '201' });

      expect(counter.get({ method: 'GET', status: '200' })).toBe(1);
      expect(counter.get({ method: 'POST', status: '201' })).toBe(2);
    });

    it('should throw error when decrementing', () => {
      const counter = new Counter({
        name: 'test_counter_decrement',
        help: 'Test counter',
      });

      expect(() => counter.inc(-1)).toThrow();
    });

    it('should set value correctly', () => {
      const counter = new Counter({
        name: 'test_counter_set',
        help: 'Test counter',
      });

      counter.set(10);
      expect(counter.get()).toBe(10);

      expect(() => counter.set(5)).toThrow();
    });
  });

  describe('Gauge', () => {
    it('should increment and decrement gauge', () => {
      const gauge = new Gauge({
        name: 'test_gauge',
        help: 'Test gauge',
      });

      gauge.inc(10);
      expect(gauge.get()).toBe(10);

      gauge.dec(3);
      expect(gauge.get()).toBe(7);

      gauge.set(100);
      expect(gauge.get()).toBe(100);
    });

    it('should handle negative values', () => {
      const gauge = new Gauge({
        name: 'test_gauge_negative',
        help: 'Test gauge',
      });

      gauge.dec(10);
      expect(gauge.get()).toBe(-10);
    });

    it('should start timer', async () => {
      const gauge = new Gauge({
        name: 'test_gauge_timer',
        help: 'Test gauge timer',
      });

      const timer = gauge.startTimer();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const elapsed = timer();

      expect(elapsed).toBeGreaterThan(0.04);
      expect(elapsed).toBeLessThan(0.2);
    });
  });

  describe('Histogram', () => {
    it('should observe values', () => {
      const histogram = new Histogram({
        name: 'test_histogram',
        help: 'Test histogram',
        buckets: [0.1, 0.5, 1, 5],
      });

      histogram.observe(0.05);
      histogram.observe(0.3);
      histogram.observe(0.7);
      histogram.observe(2);
      histogram.observe(10);

      expect(histogram.getCount()).toBe(5);
      expect(histogram.getSum()).toBeCloseTo(13.05, 5);

      const buckets = histogram.getBucketsValue();
      expect(buckets.get(0.1)).toBe(1);
      expect(buckets.get(0.5)).toBe(2);
      expect(buckets.get(1)).toBe(3);
      expect(buckets.get(5)).toBe(4);
      expect(buckets.get(Infinity)).toBe(5);
    });

    it('should use default buckets', () => {
      const histogram = new Histogram({
        name: 'test_histogram_default_buckets',
        help: 'Test histogram',
      });

      expect(histogram.getBuckets().length).toBeGreaterThan(0);
    });

    it('should start timer', async () => {
      const histogram = new Histogram({
        name: 'test_histogram_timer',
        help: 'Test histogram timer',
      });

      const timer = histogram.startTimer();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const elapsed = timer();

      expect(elapsed).toBeGreaterThan(0.04);
      expect(histogram.getCount()).toBe(1);
    });
  });

  describe('Summary', () => {
    it('should observe values and calculate percentiles', () => {
      const summary = new Summary({
        name: 'test_summary',
        help: 'Test summary',
        percentiles: [0.5, 0.9, 0.95],
        maxAgeSeconds: 60,
      });

      for (let i = 1; i <= 100; i++) {
        summary.observe(i);
      }

      expect(summary.getCount()).toBe(100);
      expect(summary.getSum()).toBe(5050);

      const quantiles = summary.getQuantiles();
      expect(quantiles.get(0.5)).toBeCloseTo(50.5, 0);
      expect(quantiles.get(0.9)).toBeCloseTo(90.5, 0);
      expect(quantiles.get(0.95)).toBeCloseTo(95.5, 0);
    });

    it('should return NaN for empty data', () => {
      const summary = new Summary({
        name: 'test_summary_empty',
        help: 'Test summary',
      });

      const quantiles = summary.getQuantiles();
      expect(Number.isNaN(quantiles.get(0.5))).toBe(true);
    });

    it('should use default percentiles', () => {
      const summary = new Summary({
        name: 'test_summary_default_percentiles',
        help: 'Test summary',
      });

      expect(summary.getPercentiles()).toEqual([0.5, 0.9, 0.95, 0.99]);
    });
  });
});

describe('Registry', () => {
  beforeEach(() => {
    defaultRegistry.clear();
  });

  it('should be singleton', () => {
    const r1 = Registry.getInstance();
    const r2 = Registry.getInstance();
    expect(r1).toBe(r2);
  });

  it('should register metrics', () => {
    const counter = new Counter({
      name: 'registry_test_counter',
      help: 'Test counter',
    });

    defaultRegistry.register(counter);
    expect(defaultRegistry.has('registry_test_counter')).toBe(true);
    expect(defaultRegistry.get('registry_test_counter')).toBe(counter);
  });

  it('should prevent duplicate registration of different metric types', () => {
    const counter = new Counter({
      name: 'duplicate_test',
      help: 'Test counter',
    });

    defaultRegistry.register(counter);

    const gauge = new Gauge({
      name: 'duplicate_test',
      help: 'Test gauge',
    });

    expect(() => defaultRegistry.register(gauge)).toThrow();
  });

  it('should return existing metric on duplicate registration of same type', () => {
    const counter1 = new Counter({
      name: 'duplicate_same_test',
      help: 'Test counter',
    });

    const counter2 = new Counter({
      name: 'duplicate_same_test',
      help: 'Test counter',
    });

    const registered1 = defaultRegistry.register(counter1);
    const registered2 = defaultRegistry.register(counter2);

    expect(registered1).toBe(registered2);
  });

  it('should create metrics via helper methods', () => {
    const counter = defaultRegistry.createCounter({
      name: 'helper_counter',
      help: 'Helper counter',
    });

    const gauge = defaultRegistry.createGauge({
      name: 'helper_gauge',
      help: 'Helper gauge',
    });

    const histogram = defaultRegistry.createHistogram({
      name: 'helper_histogram',
      help: 'Helper histogram',
    });

    const summary = defaultRegistry.createSummary({
      name: 'helper_summary',
      help: 'Helper summary',
    });

    expect(counter.getType()).toBe(MetricType.Counter);
    expect(gauge.getType()).toBe(MetricType.Gauge);
    expect(histogram.getType()).toBe(MetricType.Histogram);
    expect(summary.getType()).toBe(MetricType.Summary);

    expect(defaultRegistry.getMetricNames()).toEqual([
      'helper_counter',
      'helper_gauge',
      'helper_histogram',
      'helper_summary',
    ]);
  });

  it('should get snapshots', () => {
    const counter = defaultRegistry.createCounter({
      name: 'snapshot_test',
      help: 'Snapshot test',
      labelNames: ['label1'],
    });

    counter.inc(5, { label1: 'value1' });
    counter.inc(10, { label1: 'value2' });

    const snapshots = defaultRegistry.getSnapshots();
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].name).toBe('snapshot_test');
    expect(snapshots[0].values.length).toBe(2);
  });
});

describe('PrometheusExporter', () => {
  beforeEach(() => {
    defaultRegistry.clear();
  });

  it('should export counter in Prometheus format', () => {
    const counter = defaultRegistry.createCounter({
      name: 'export_test_counter',
      help: 'Test counter for export',
      labelNames: ['method'],
    });

    counter.inc(1, { method: 'GET' });
    counter.inc(2, { method: 'POST' });

    const exporter = new PrometheusExporter();
    const output = exporter.export();

    expect(output).toContain('# HELP export_test_counter Test counter for export');
    expect(output).toContain('# TYPE export_test_counter counter');
    expect(output).toContain('export_test_counter{method="GET"} 1');
    expect(output).toContain('export_test_counter{method="POST"} 2');
  });

  it('should export histogram with buckets', () => {
    const histogram = defaultRegistry.createHistogram({
      name: 'export_test_histogram',
      help: 'Test histogram for export',
      buckets: [0.1, 0.5, 1],
      labelNames: ['endpoint'],
    });

    histogram.observe(0.05, { endpoint: '/api' });
    histogram.observe(0.3, { endpoint: '/api' });
    histogram.observe(0.7, { endpoint: '/api' });

    const exporter = new PrometheusExporter();
    const output = exporter.export();

    expect(output).toContain('export_test_histogram_bucket{endpoint="/api",le="0.1"} 1');
    expect(output).toContain('export_test_histogram_bucket{endpoint="/api",le="0.5"} 2');
    expect(output).toContain('export_test_histogram_bucket{endpoint="/api",le="1"} 3');
    expect(output).toContain('export_test_histogram_bucket{endpoint="/api",le="+Inf"} 3');
    expect(output).toContain('export_test_histogram_sum{endpoint="/api"} 1.05');
    expect(output).toContain('export_test_histogram_count{endpoint="/api"} 3');
  });

  it('should export summary with quantiles', () => {
    const summary = defaultRegistry.createSummary({
      name: 'export_test_summary',
      help: 'Test summary for export',
      percentiles: [0.5, 0.9],
    });

    for (let i = 1; i <= 10; i++) {
      summary.observe(i);
    }

    const exporter = new PrometheusExporter();
    const output = exporter.export();

    expect(output).toContain('export_test_summary{quantile="0.5"}');
    expect(output).toContain('export_test_summary{quantile="0.9"}');
    expect(output).toContain('export_test_summary_sum');
    expect(output).toContain('export_test_summary_count');
  });

  it('should filter metrics', () => {
    defaultRegistry.createCounter({ name: 'metric_a', help: 'Metric A' });
    defaultRegistry.createCounter({ name: 'metric_b', help: 'Metric B' });
    defaultRegistry.createCounter({ name: 'metric_c', help: 'Metric C' });

    const exporter = new PrometheusExporter();
    const output = exporter.export({ includeNames: ['metric_a', 'metric_b'] });

    expect(output).toContain('metric_a');
    expect(output).toContain('metric_b');
    expect(output).not.toContain('metric_c');

    const output2 = exporter.export({ excludeNames: ['metric_a'] });
    expect(output2).not.toContain('metric_a');
    expect(output2).toContain('metric_b');
    expect(output2).toContain('metric_c');
  });

  it('should parse Prometheus format', () => {
    const exporter = new PrometheusExporter();
    const text = `# HELP test_counter Test counter
# TYPE test_counter counter
test_counter{method="GET"} 10 1234567890
test_counter{method="POST"} 20 1234567890
`;

    const parsed = exporter.parse(text);
    expect(parsed.length).toBe(2);
    expect(parsed[0].name).toBe('test_counter');
    expect(parsed[0].value).toBe(10);
    expect(parsed[0].labels.method).toBe('GET');
    expect(parsed[0].timestamp).toBe(1234567890);
  });
});
