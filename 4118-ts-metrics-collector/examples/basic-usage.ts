import {
  metrics,
  MetricType,
  AggregationFunction,
  AlertSeverity,
  AlertOperator,
  AlertStatus,
} from '../src';

async function main() {
  console.log('=== TypeScript Metrics Collector - Basic Usage ===\n');

  const requestCount = metrics.createCounter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status'],
  });

  const activeUsers = metrics.createGauge({
    name: 'active_users',
    help: 'Number of active users',
    labelNames: ['app'],
  });

  const requestDuration = metrics.createHistogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  });

  const apiLatency = metrics.createSummary({
    name: 'api_latency_seconds',
    help: 'API latency in seconds',
    labelNames: ['endpoint'],
    percentiles: [0.5, 0.9, 0.95, 0.99],
    maxAgeSeconds: 300,
  });

  console.log('1. Recording some metrics...\n');

  requestCount.inc(1, { method: 'GET', path: '/api/users', status: '200' });
  requestCount.inc(1, { method: 'GET', path: '/api/users', status: '200' });
  requestCount.inc(1, { method: 'POST', path: '/api/users', status: '201' });
  requestCount.inc(1, { method: 'GET', path: '/api/orders', status: '200' });
  requestCount.inc(1, { method: 'GET', path: '/api/orders', status: '500' });

  activeUsers.set(156, { app: 'web' });
  activeUsers.set(89, { app: 'mobile' });

  const durationTimer = requestDuration.startTimer({ method: 'GET', path: '/api/users' });
  await new Promise((resolve) => setTimeout(resolve, 45));
  durationTimer();

  requestDuration.observe(0.123, { method: 'GET', path: '/api/users' });
  requestDuration.observe(0.067, { method: 'GET', path: '/api/users' });
  requestDuration.observe(0.234, { method: 'POST', path: '/api/users' });
  requestDuration.observe(1.567, { method: 'GET', path: '/api/orders' });

  apiLatency.observe(0.045, { endpoint: '/api/users' });
  apiLatency.observe(0.089, { endpoint: '/api/users' });
  apiLatency.observe(0.156, { endpoint: '/api/users' });
  apiLatency.observe(0.023, { endpoint: '/api/orders' });
  apiLatency.observe(0.078, { endpoint: '/api/orders' });

  console.log('2. Current metric values:');
  console.log('   GET /api/users 200 count:', requestCount.get({ method: 'GET', path: '/api/users', status: '200' }));
  console.log('   Active web users:', activeUsers.get({ app: 'web' }));
  console.log('   Request duration sum:', requestDuration.getSum({ method: 'GET', path: '/api/users' }));
  console.log('   Request duration count:', requestDuration.getCount({ method: 'GET', path: '/api/users' }));
  console.log('   API latency P95:', apiLatency.getQuantiles({ endpoint: '/api/users' }).get(0.95));
  console.log();

  console.log('3. Exporting to Prometheus format:\n');
  const prometheusOutput = metrics.export();
  console.log(prometheusOutput);

  console.log('\n4. Aggregator example:\n');

  const aggregator = new metrics.Aggregator({
    flushIntervalMs: 5000,
    minSampleSize: 2,
  });

  aggregator.addTarget('http_requests_total', {
    function: AggregationFunction.Sum,
    windowMs: 60000,
    slideMs: 10000,
  });

  aggregator.addTarget('http_request_duration_seconds', {
    function: AggregationFunction.Avg,
    windowMs: 60000,
  });

  aggregator.addTarget('http_request_duration_seconds', {
    function: AggregationFunction.Percentile,
    windowMs: 60000,
    percentile: 0.95,
  });

  for (let i = 0; i < 20; i++) {
    aggregator.observe('http_requests_total', 1, { method: 'GET', path: '/api/users' });
    aggregator.observe('http_request_duration_seconds', Math.random() * 0.5, { method: 'GET', path: '/api/users' });
  }

  const aggregated = aggregator.aggregateAll();
  console.log('   Aggregated data points:', aggregated.length);
  for (const data of aggregated) {
    console.log(`   - ${data.metricName} [${data.function}]: ${data.value.toFixed(4)}`);
  }
  console.log();

  console.log('5. Alerter example:\n');

  const alerter = new metrics.Alerter({
    checkIntervalMs: 1000,
    minSampleSize: 2,
  });

  alerter.addHandler('all', (notification) => {
    console.log(`   [ALERT] ${notification.newStatus}: ${notification.alert.name}`);
    console.log(`     Value: ${notification.alert.value}, Threshold: ${notification.alert.threshold}`);
    console.log(`     Severity: ${notification.alert.severity}`);
  });

  alerter.addRule({
    id: 'high_error_rate',
    name: 'High Error Rate',
    description: 'Error rate exceeds 5%',
    severity: AlertSeverity.P1,
    conditions: [
      {
        metricName: 'http_requests_total',
        labels: { method: 'GET', path: '/api/orders', status: '500' },
        operator: AlertOperator.GreaterThan,
        threshold: 5,
      },
    ],
    forMs: 0,
    annotations: {
      summary: 'High error rate detected',
      runbook: 'https://wiki.example.com/runbooks/high-error-rate',
    },
  });

  alerter.addRule({
    id: 'high_latency',
    name: 'High API Latency',
    description: 'API latency P95 exceeds 500ms',
    severity: AlertSeverity.P0,
    conditions: [
      {
        metricName: 'api_latency_seconds',
        labels: { endpoint: '/api/users' },
        operator: AlertOperator.GreaterThan,
        threshold: 0.5,
      },
    ],
    forMs: 0,
  });

  for (let i = 0; i < 10; i++) {
    requestCount.inc(1, { method: 'GET', path: '/api/orders', status: '500' });
  }

  await alerter.checkRules();

  const firingAlerts = alerter.getAlerts(AlertStatus.Firing);
  console.log('   Firing alerts:', firingAlerts.length);
  for (const alert of firingAlerts) {
    console.log(`   - ${alert.name} (${alert.severity})`);
    console.log(`     Value: ${alert.value}, Operator: ${alert.operator}, Threshold: ${alert.threshold}`);
  }
  console.log();

  console.log('6. Registry information:');
  console.log('   Total metrics registered:', metrics.defaultRegistry.getMetricNames().length);
  console.log('   Metric names:', metrics.defaultRegistry.getMetricNames().join(', '));
  console.log();

  console.log('7. Starting HTTP server...\n');
  const server = new metrics.MetricsServer({
    port: 9090,
    alerter,
    aggregator,
  });

  await server.start();

  console.log('\n   Server started! Available endpoints:');
  console.log('   - http://localhost:9090/metrics (Prometheus format)');
  console.log('   - http://localhost:9090/health (Health check)');
  console.log('   - http://localhost:9090/api/status (System status)');
  console.log('   - http://localhost:9090/api/alerts (Alerts)');
  console.log('   - http://localhost:9090/api/alerts/rules (Alert rules)');
  console.log('   - http://localhost:9090/api/metrics/snapshot (JSON snapshot)');
  console.log();

  console.log('   Press Ctrl+C to stop the server...');

  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    alerter.stop();
    aggregator.stop();
    await server.stop();
    console.log('Server stopped.');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
