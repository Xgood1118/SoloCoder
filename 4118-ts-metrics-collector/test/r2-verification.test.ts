import request from 'supertest';
import { MetricsServer } from '../src/server';
import { Counter, Gauge, Histogram, Summary } from '../src/metrics';
import { defaultRegistry } from '../src/Registry';
import { Aggregator } from '../src/Aggregator';
import { AggregationFunction } from '../src/types';

let server: MetricsServer;
let baseUrl: string;

beforeAll(async () => {
  // Use port 0 to let the OS pick an available port, avoiding conflicts
  server = new MetricsServer({ port: 0 });
  await server.start();
  baseUrl = `http://localhost:${server.getPort()}`;
});

afterAll(async () => {
  await server.stop();
});

beforeEach(() => {
  defaultRegistry.clear();
});

// ===== Issue 1: /api/metrics vs /api/status consistency =====
describe('R1 Issue 1: /api/metrics vs /api/status consistency', () => {
  it('should show same metric count in /api/status and /api/metrics', async () => {
    // Register 4 metrics
    defaultRegistry.createCounter({ name: 'counter_a', help: 'Counter A', labelNames: ['label'] });
    defaultRegistry.createGauge({ name: 'gauge_b', help: 'Gauge B' });
    defaultRegistry.createHistogram({ name: 'histogram_c', help: 'Histogram C', buckets: [0.1, 0.5, 1] });
    defaultRegistry.createSummary({ name: 'summary_d', help: 'Summary D', percentiles: [0.5, 0.9] });

    const statusRes = await request(baseUrl).get('/api/status');
    expect(statusRes.status).toBe(200);
    const statusMetricCount = statusRes.body.registry.metricCount;
    expect(statusMetricCount).toBe(4);

    const metricsRes = await request(baseUrl).get('/api/metrics');
    expect(metricsRes.status).toBe(200);
    const apiMetrics = metricsRes.body.metrics as unknown[];
    expect(apiMetrics.length).toBe(4);

    // The key assertion: same registry, same count
    expect(apiMetrics.length).toBe(statusMetricCount);

    // Verify all metric names are present in both
    const statusNames = statusRes.body.registry.metrics as string[];
    const apiNames = apiMetrics.map((m: any) => m.name);
    expect(apiNames.sort()).toEqual(statusNames.sort());
  });

  it('should return empty array from both when registry is empty', async () => {
    defaultRegistry.clear();

    const statusRes = await request(baseUrl).get('/api/status');
    expect(statusRes.body.registry.metricCount).toBe(0);

    const metricsRes = await request(baseUrl).get('/api/metrics');
    expect(metricsRes.body.metrics).toEqual([]);
  });
});

// ===== Issue 2: handleOutOfOrder does actual splice =====
describe('R1 Issue 2: handleOutOfOrder inserts data', () => {
  it('should insert out-of-order point into correct position', () => {
    const agg = new Aggregator({ minSampleSize: 1 });
    agg.addTarget('out_of_order_test', {
      function: AggregationFunction.Sum,
      windowMs: 60000,
    });

    const baseTime = 1000000;
    // Insert points in order first
    agg.observe('out_of_order_test', 10, {}, baseTime + 100);
    agg.observe('out_of_order_test', 30, {}, baseTime + 300);
    agg.observe('out_of_order_test', 50, {}, baseTime + 500);

    // Now insert out-of-order point (timestamp between first and second)
    agg.observe('out_of_order_test', 20, {}, baseTime + 200);

    // Verify the point was inserted at correct position
    const values = agg.getValues('out_of_order_test', {});
    expect(values.length).toBe(4);
    const timestamps = values.map((v) => v.timestamp);
    expect(timestamps.sort()).toEqual([
      baseTime + 100,
      baseTime + 200,
      baseTime + 300,
      baseTime + 500,
    ]);

    const result = agg.aggregate('out_of_order_test');
    expect(result.length).toBe(1);
    // Sum = 10 + 20 + 30 + 50 = 110
    expect(result[0].value).toBe(110);
  });

  it('should NOT insert point that is truly too old (exceeds 2-window tolerance)', () => {
    const agg = new Aggregator({ minSampleSize: 1 });
    agg.addTarget('too_old_test', {
      function: AggregationFunction.Sum,
      windowMs: 60000,
    });

    const baseTime = 1000000;
    // Add a valid point at baseTime + 60000 (window: [1000000, 1060000))
    agg.observe('too_old_test', 10, {}, baseTime + 60000);

    // Point from baseTime - 280000 = 720000
    // windowStart = floor(720000/60000)*60000 = 720000
    // window.start = 1000000
    // windowStart < window.start - 2*windowMs = 1000000 - 120000 = 880000?
    // 720000 < 880000? YES -> drop (return false)
    agg.observe('too_old_test', 5, {}, baseTime - 280000);

    const values = agg.getValues('too_old_test', {});
    // Should only have the one valid point (the too-old one must be dropped)
    expect(values.length).toBe(1);
    expect(values[0].value).toBe(10);
  });

  it('should expand window and insert point when within 2-window tolerance', () => {
    const agg = new Aggregator({ minSampleSize: 1 });
    agg.addTarget('expand_window_test', {
      function: AggregationFunction.Sum,
      windowMs: 60000,
    });

    const baseTime = Date.now();
    // First point: current time
    agg.observe('expand_window_test', 10, {}, baseTime);
    // Second point: 30 seconds ago (within 2-window tolerance of 120s)
    agg.observe('expand_window_test', 5, {}, baseTime - 30000);

    const values = agg.getValues('expand_window_test', {});
    expect(values.length).toBe(2);
    expect(values.map(v => v.value).sort((a, b) => a - b)).toEqual([5, 10]);
  });
});

// ===== Issue 3: Storage adapter factory returns real adapters =====
describe('R1 Issue 3: Storage adapter factory returns real adapters', () => {
  it('memory type returns MemoryStorage', () => {
    const { StorageAdapterFactory } = require('../src/storage/StorageAdapterFactory');
    const adapter = StorageAdapterFactory.create({ type: 'memory' });
    expect(adapter).toBeDefined();
    expect(typeof adapter.write).toBe('function');
    expect(typeof adapter.query).toBe('function');
    expect(typeof adapter.isConnected).toBe('function');
  });

  it('influxdb throws if options are missing', () => {
    const { StorageAdapterFactory } = require('../src/storage/StorageAdapterFactory');
    expect(() => StorageAdapterFactory.create({ type: 'influxdb' })).toThrow(/url.*token.*org.*bucket/i);
  });

  it('prometheus throws if url is missing', () => {
    const { StorageAdapterFactory } = require('../src/storage/StorageAdapterFactory');
    expect(() => StorageAdapterFactory.create({ type: 'prometheus' })).toThrow(/url/i);
  });

  it('clickhouse throws if host or database missing', () => {
    const { StorageAdapterFactory } = require('../src/storage/StorageAdapterFactory');
    expect(() => StorageAdapterFactory.create({ type: 'clickhouse' })).toThrow(/host.*database/i);
  });

  it('timescaledb throws if required fields missing', () => {
    const { StorageAdapterFactory } = require('../src/storage/StorageAdapterFactory');
    expect(() => StorageAdapterFactory.create({ type: 'timescaledb' })).toThrow(/host.*user.*password.*database/i);
  });

  it('influxdb with valid options returns InfluxDBAdapter instance', () => {
    const { StorageAdapterFactory } = require('../src/storage/StorageAdapterFactory');
    const adapter = StorageAdapterFactory.create({
      type: 'influxdb',
      options: { url: 'http://localhost:8086', token: 'test-token', org: 'test-org', bucket: 'test-bucket' },
    });
    expect(adapter.name).toBe('influxdb');
    expect(adapter.isConnected()).toBe(false); // not connected yet, just created
    expect(typeof adapter.connect).toBe('function');
  });

  it('prometheus with valid options returns PrometheusAdapter instance', () => {
    const { StorageAdapterFactory } = require('../src/storage/StorageAdapterFactory');
    const adapter = StorageAdapterFactory.create({
      type: 'prometheus',
      options: { url: 'http://localhost:9090' },
    });
    expect(adapter.name).toBe('prometheus');
    expect(typeof adapter.connect).toBe('function');
  });

  it('clickhouse with valid options returns ClickHouseAdapter instance', () => {
    const { StorageAdapterFactory } = require('../src/storage/StorageAdapterFactory');
    const adapter = StorageAdapterFactory.create({
      type: 'clickhouse',
      options: { host: 'localhost', database: 'metrics' },
    });
    expect(adapter.name).toBe('clickhouse');
    expect(typeof adapter.connect).toBe('function');
  });

  it('timescaledb with valid options returns TimescaleDBAdapter instance', () => {
    const { StorageAdapterFactory } = require('../src/storage/StorageAdapterFactory');
    const adapter = StorageAdapterFactory.create({
      type: 'timescaledb',
      options: { host: 'localhost', user: 'user', password: 'pass', database: 'metrics' },
    });
    expect(adapter.name).toBe('timescaledb');
    expect(typeof adapter.connect).toBe('function');
  });
});