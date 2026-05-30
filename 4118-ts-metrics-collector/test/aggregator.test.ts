import { Aggregator, SlidingWindow } from '../src/Aggregator';
import { AggregationFunction } from '../src/types';

describe('Aggregator', () => {
  let aggregator: Aggregator;

  beforeEach(() => {
    aggregator = new Aggregator({
      minSampleSize: 2,
    });
  });

  afterEach(() => {
    aggregator.stop();
    aggregator.clear();
  });

  it('should add target and observe values', () => {
    aggregator.addTarget('test_metric', {
      function: AggregationFunction.Sum,
      windowMs: 60000,
    });

    for (let i = 1; i <= 10; i++) {
      aggregator.observe('test_metric', i);
    }

    const result = aggregator.aggregate('test_metric');
    expect(result.length).toBe(1);
    expect(result[0].value).toBe(55);
    expect(result[0].function).toBe(AggregationFunction.Sum);
  });

  it('should support multiple aggregation functions', () => {
    aggregator.addTarget('test_metric', {
      function: AggregationFunction.Avg,
      windowMs: 60000,
    });

    aggregator.addTarget('test_metric', {
      function: AggregationFunction.Max,
      windowMs: 60000,
    });

    aggregator.addTarget('test_metric', {
      function: AggregationFunction.Min,
      windowMs: 60000,
    });

    for (let i = 1; i <= 10; i++) {
      aggregator.observe('test_metric', i);
    }

    const result = aggregator.aggregate('test_metric');
    expect(result.length).toBe(3);

    const avg = result.find((r) => r.function === AggregationFunction.Avg);
    const max = result.find((r) => r.function === AggregationFunction.Max);
    const min = result.find((r) => r.function === AggregationFunction.Min);

    expect(avg?.value).toBe(5.5);
    expect(max?.value).toBe(10);
    expect(min?.value).toBe(1);
  });

  it('should aggregate by labels', () => {
    aggregator.addTarget('test_metric', {
      function: AggregationFunction.Sum,
      windowMs: 60000,
    });

    aggregator.observe('test_metric', 10, { status: '200' });
    aggregator.observe('test_metric', 20, { status: '200' });
    aggregator.observe('test_metric', 5, { status: '500' });
    aggregator.observe('test_metric', 15, { status: '500' });

    const result = aggregator.aggregate('test_metric');
    expect(result.length).toBe(2);

    const okResult = result.find((r) => r.labels.status === '200');
    const errorResult = result.find((r) => r.labels.status === '500');

    expect(okResult?.value).toBe(30);
    expect(errorResult?.value).toBe(20);
  });

  it('should calculate percentile', () => {
    aggregator.addTarget('test_metric', {
      function: AggregationFunction.Percentile,
      windowMs: 60000,
      percentile: 0.95,
    });

    for (let i = 1; i <= 100; i++) {
      aggregator.observe('test_metric', i);
    }

    const result = aggregator.aggregate('test_metric');
    expect(result.length).toBe(1);
    expect(result[0].value).toBeCloseTo(95.5, 0);
  });

  it('should return stats', () => {
    aggregator.addTarget('metric1', {
      function: AggregationFunction.Sum,
      windowMs: 60000,
    });

    for (let i = 0; i < 100; i++) {
      aggregator.observe('metric1', i);
    }

    aggregator.aggregateAll();

    const stats = aggregator.getStats();
    expect(stats.activeTargets).toBe(1);
    expect(stats.totalPoints).toBe(100);
    expect(stats.totalAggregations).toBeGreaterThan(0);
    expect(stats.memoryUsageBytes).toBeGreaterThan(0);
  });

  it('should reaggregate data', () => {
    const sourceData = [
      {
        metricName: 'test',
        labels: { region: 'us' },
        function: AggregationFunction.Sum,
        value: 10,
        timestamp: Date.now(),
        windowStart: Date.now() - 3600000,
        windowEnd: Date.now(),
      },
      {
        metricName: 'test',
        labels: { region: 'us' },
        function: AggregationFunction.Sum,
        value: 20,
        timestamp: Date.now(),
        windowStart: Date.now() - 7200000,
        windowEnd: Date.now() - 3600000,
      },
      {
        metricName: 'test',
        labels: { region: 'eu' },
        function: AggregationFunction.Sum,
        value: 15,
        timestamp: Date.now(),
        windowStart: Date.now() - 3600000,
        windowEnd: Date.now(),
      },
    ];

    const result = aggregator.reaggregate(sourceData, {
      function: AggregationFunction.Avg,
      windowMs: 7200000,
    });

    expect(result.length).toBe(2);

    const usResult = result.find((r) => r.labels.region === 'us');
    const euResult = result.find((r) => r.labels.region === 'eu');

    expect(usResult?.value).toBe(15);
    expect(euResult?.value).toBe(15);
  });

  it('should handle memory pressure', () => {
    let alertTriggered = false;
    aggregator.setAlertHandler((type) => {
      if (type === 'memory_pressure') {
        alertTriggered = true;
      }
    });

    const smallAggregator = new Aggregator({
      maxMemoryBytes: 100,
      minSampleSize: 2,
    });
    smallAggregator.setAlertHandler((type) => {
      if (type === 'memory_pressure') {
        alertTriggered = true;
      }
    });

    smallAggregator.addTarget('test', {
      function: AggregationFunction.Sum,
      windowMs: 60000,
    });

    for (let i = 0; i < 100; i++) {
      smallAggregator.observe('test', i);
    }

    expect(alertTriggered).toBe(true);
  });
});

describe('SlidingWindow', () => {
  it('should add points and aggregate', () => {
    const window = new SlidingWindow({
      windowSize: 60000,
      slideInterval: 10000,
    });

    for (let i = 1; i <= 10; i++) {
      window.add(i);
    }

    expect(window.size()).toBe(10);
    expect(window.aggregate(AggregationFunction.Sum)).toBe(55);
    expect(window.aggregate(AggregationFunction.Avg)).toBe(5.5);
    expect(window.aggregate(AggregationFunction.Max)).toBe(10);
    expect(window.aggregate(AggregationFunction.Min)).toBe(1);
    expect(window.aggregate(AggregationFunction.Count)).toBe(10);
  });

  it('should expire old points', async () => {
    const window = new SlidingWindow({
      windowSize: 100,
      slideInterval: 50,
    });

    window.add(1);
    window.add(2);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(window.size()).toBe(0);
    expect(window.aggregate(AggregationFunction.Sum)).toBeNaN();
  });

  it('should respect maxPoints', () => {
    const window = new SlidingWindow({
      windowSize: 60000,
      slideInterval: 10000,
      maxPoints: 10,
    });

    for (let i = 0; i < 20; i++) {
      window.add(i);
    }

    expect(window.size()).toBe(10);

    const points = window.getPoints();
    expect(points[0].value).toBe(10);
    expect(points[9].value).toBe(19);
  });

  it('should reset', () => {
    const window = new SlidingWindow({
      windowSize: 60000,
      slideInterval: 10000,
    });

    window.add(1);
    window.add(2);
    expect(window.size()).toBe(2);

    window.reset();
    expect(window.size()).toBe(0);
  });
});
