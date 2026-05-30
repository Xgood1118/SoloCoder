import { Alerter } from '../src/Alerter';
import { Registry } from '../src/Registry';
import { Counter, Gauge } from '../src/metrics';
import { AlertSeverity, AlertOperator, AlertStatus } from '../src/types';

describe('Alerter', () => {
  let registry: Registry;
  let alerter: Alerter;
  let errorCounter: Counter;
  let latencyGauge: Gauge;

  beforeEach(() => {
    registry = Registry.getInstance();
    registry.clear();
    alerter = new Alerter({
      registry,
      checkIntervalMs: 100,
      minSampleSize: 1,
    });

    errorCounter = registry.createCounter({
      name: 'http_errors_total',
      help: 'HTTP errors',
      labelNames: ['status'],
    });

    latencyGauge = registry.createGauge({
      name: 'http_latency_seconds',
      help: 'HTTP latency',
    });
  });

  afterEach(() => {
    alerter.stop();
    alerter.clear();
    registry.clear();
  });

  it('should add and remove rules', () => {
    const rule = {
      id: 'test_rule',
      name: 'Test Rule',
      severity: AlertSeverity.P1,
      conditions: [
        {
          metricName: 'http_errors_total',
          operator: AlertOperator.GreaterThan,
          threshold: 5,
        },
      ],
    };

    alerter.addRule(rule);
    expect(alerter.getRule('test_rule')).toBeDefined();
    expect(alerter.getAllRules().length).toBe(1);

    alerter.removeRule('test_rule');
    expect(alerter.getRule('test_rule')).toBeUndefined();
    expect(alerter.getAllRules().length).toBe(0);
  });

  it('should fire alert when threshold exceeded', async () => {
    let firedAlert: unknown;
    alerter.addHandler('all', (notification) => {
      if (notification.newStatus === AlertStatus.Firing) {
        firedAlert = notification.alert;
      }
    });

    alerter.addRule({
      id: 'high_errors',
      name: 'High Errors',
      severity: AlertSeverity.P1,
      conditions: [
        {
          metricName: 'http_errors_total',
          labels: { status: '500' },
          operator: AlertOperator.GreaterThan,
          threshold: 3,
        },
      ],
      forMs: 0,
    });

    for (let i = 0; i < 5; i++) {
      errorCounter.inc(1, { status: '500' });
    }

    await alerter.checkRules();

    const alerts = alerter.getAlerts(AlertStatus.Firing);
    expect(alerts.length).toBe(1);
    expect(alerts[0].name).toBe('High Errors');
    expect(alerts[0].value).toBe(5);
    expect(firedAlert).toBeDefined();
  });

  it('should respect forMs duration', async () => {
    alerter.addRule({
      id: 'delayed_alert',
      name: 'Delayed Alert',
      severity: AlertSeverity.P1,
      conditions: [
        {
          metricName: 'http_errors_total',
          labels: { status: '500' },
          operator: AlertOperator.GreaterThan,
          threshold: 1,
        },
      ],
      forMs: 500,
    });

    errorCounter.inc(5, { status: '500' });

    await alerter.checkRules();
    expect(alerter.getAlerts(AlertStatus.Firing).length).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 600));

    await alerter.checkRules();
    expect(alerter.getAlerts(AlertStatus.Firing).length).toBe(1);
  });

  it('should support AND condition operator', async () => {
    alerter.addRule({
      id: 'multi_condition',
      name: 'Multi Condition',
      severity: AlertSeverity.P0,
      conditions: [
        {
          metricName: 'http_errors_total',
          labels: { status: '500' },
          operator: AlertOperator.GreaterThan,
          threshold: 5,
        },
        {
          metricName: 'http_latency_seconds',
          operator: AlertOperator.GreaterThan,
          threshold: 0.5,
        },
      ],
      conditionOperator: 'AND',
      forMs: 0,
    });

    errorCounter.inc(10, { status: '500' });
    await alerter.checkRules();
    expect(alerter.getAlerts(AlertStatus.Firing).length).toBe(0);

    latencyGauge.set(1.0);
    await alerter.checkRules();
    expect(alerter.getAlerts(AlertStatus.Firing).length).toBe(1);
  });

  it('should support OR condition operator', async () => {
    alerter.addRule({
      id: 'or_condition',
      name: 'OR Condition',
      severity: AlertSeverity.P1,
      conditions: [
        {
          metricName: 'http_errors_total',
          labels: { status: '500' },
          operator: AlertOperator.GreaterThan,
          threshold: 5,
        },
        {
          metricName: 'http_latency_seconds',
          operator: AlertOperator.GreaterThan,
          threshold: 0.5,
        },
      ],
      conditionOperator: 'OR',
      forMs: 0,
    });

    latencyGauge.set(1.0);
    await alerter.checkRules();
    expect(alerter.getAlerts(AlertStatus.Firing).length).toBe(1);
  });

  it('should acknowledge alert', async () => {
    alerter.addRule({
      id: 'ack_test',
      name: 'Ack Test',
      severity: AlertSeverity.P1,
      conditions: [
        {
          metricName: 'http_errors_total',
          labels: { status: '500' },
          operator: AlertOperator.GreaterThan,
          threshold: 1,
        },
      ],
      forMs: 0,
    });

    errorCounter.inc(5, { status: '500' });
    await alerter.checkRules();

    const alerts = alerter.getAlerts(AlertStatus.Firing);
    expect(alerts.length).toBe(1);

    const result = alerter.acknowledgeAlert(alerts[0].id, 'user@example.com');
    expect(result).toBe(true);

    const ackAlerts = alerter.getAlerts(AlertStatus.Acknowledged);
    expect(ackAlerts.length).toBe(1);
    expect(ackAlerts[0].acknowledgedBy).toBe('user@example.com');
    expect(ackAlerts[0].acknowledgedAt).toBeDefined();
  });

  it('should resolve alert', async () => {
    alerter.addRule({
      id: 'resolve_test',
      name: 'Resolve Test',
      severity: AlertSeverity.P1,
      conditions: [
        {
          metricName: 'http_errors_total',
          labels: { status: '500' },
          operator: AlertOperator.GreaterThan,
          threshold: 1,
        },
      ],
      forMs: 0,
    });

    errorCounter.inc(5, { status: '500' });
    await alerter.checkRules();

    const alerts = alerter.getAlerts(AlertStatus.Firing);
    const result = alerter.resolveAlert(alerts[0].id);
    expect(result).toBe(true);

    const resolvingAlerts = alerter.getAlerts(AlertStatus.Resolving);
    expect(resolvingAlerts.length).toBe(1);
    expect(resolvingAlerts[0].resolvedAt).toBeDefined();
  });

  it('should detect rate increase', async () => {
    const aggregator = {
      getValues: jest.fn(),
    };

    const alerterWithAgg = new Alerter({
      registry,
      aggregator: aggregator as unknown as never,
      minSampleSize: 1,
    });

    alerterWithAgg.addRule({
      id: 'rate_test',
      name: 'Rate Test',
      severity: AlertSeverity.P1,
      conditions: [
        {
          metricName: 'http_errors_total',
          labels: { status: '500' },
          operator: AlertOperator.RateIncrease,
          threshold: 50,
          lookbackMs: 300000,
        },
      ],
      forMs: 0,
    });

    const now = Date.now();
    aggregator.getValues.mockReturnValue([
      { value: 100, timestamp: now - 200000, labels: { status: '500' } },
      { value: 180, timestamp: now, labels: { status: '500' } },
    ]);

    await alerterWithAgg.checkRules();

    const alerts = alerterWithAgg.getAlerts(AlertStatus.Firing);
    expect(alerts.length).toBe(1);
    expect(alerts[0].value).toBe(80);
  });

  it('should return stats', () => {
    alerter.addRule({
      id: 'stat_test',
      name: 'Stat Test',
      severity: AlertSeverity.P1,
      conditions: [
        {
          metricName: 'http_errors_total',
          operator: AlertOperator.GreaterThan,
          threshold: 1,
        },
      ],
      forMs: 0,
    });

    const stats = alerter.getStats();
    expect(stats.totalRules).toBe(1);
    expect(stats.activeAlerts).toBe(0);
    expect(stats.firingAlerts).toBe(0);
    expect(stats.acknowledgedAlerts).toBe(0);
  });

  it('should handle all comparison operators', async () => {
    const testCases = [
      { operator: AlertOperator.GreaterThan, value: 10, threshold: 5, expected: true },
      { operator: AlertOperator.GreaterThan, value: 5, threshold: 5, expected: false },
      { operator: AlertOperator.LessThan, value: 3, threshold: 5, expected: true },
      { operator: AlertOperator.GreaterThanOrEqual, value: 5, threshold: 5, expected: true },
      { operator: AlertOperator.LessThanOrEqual, value: 5, threshold: 5, expected: true },
      { operator: AlertOperator.Equal, value: 5, threshold: 5, expected: true },
      { operator: AlertOperator.NotEqual, value: 5, threshold: 6, expected: true },
    ];

    for (const tc of testCases) {
      const testRegistry = Registry.getInstance();
      testRegistry.clear();
      const testAlerter = new Alerter({
        registry: testRegistry,
        minSampleSize: 1,
      });

      const counter = testRegistry.createCounter({
        name: 'test_op',
        help: 'Test',
      });

      testAlerter.addRule({
        id: `test_${tc.operator}`,
        name: `Test ${tc.operator}`,
        severity: AlertSeverity.P1,
        conditions: [
          {
            metricName: 'test_op',
            operator: tc.operator,
            threshold: tc.threshold,
          },
        ],
        forMs: 0,
      });

      counter.inc(tc.value);
      await testAlerter.checkRules();

      const alerts = testAlerter.getAlerts(AlertStatus.Firing);
      expect(alerts.length > 0).toBe(tc.expected);

      testAlerter.stop();
    }
  });
});
