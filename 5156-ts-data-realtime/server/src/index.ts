import express from 'express';
import http from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import type {
  AggregationConfig,
  AlertRule,
  AlertEvent,
  AggregationResult,
  AlertStatus,
} from './types';
import { SlidingWindowAggregator } from './core/SlidingWindowAggregator';
import { AlertManager } from './core/AlertManager';
import { DataSimulator } from './core/DataSimulator';
import { HistoricalDataStore } from './core/HistoricalDataStore';
import { WebSocketService } from './websocket/WebSocketServer';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

app.use(cors());
app.use(express.json());

const wsService = new WebSocketService(server);
const dataSimulator = new DataSimulator();
const historicalStore = new HistoricalDataStore();

const aggregators: Map<string, SlidingWindowAggregator> = new Map();

const alertManager = new AlertManager((event: AlertEvent) => {
  console.log('Alert event:', event.id, event.status, event.level);
  wsService.broadcastAlertEvent(event);
});

const defaultAggregations: AggregationConfig[] = [
  {
    metricName: 'cpu_usage',
    windowSize: 60000,
    slideStep: 10000,
    aggregationType: 'avg',
    windowStartMode: 'dynamic',
  },
  {
    metricName: 'memory_usage',
    windowSize: 60000,
    slideStep: 10000,
    aggregationType: 'avg',
    windowStartMode: 'dynamic',
  },
  {
    metricName: 'request_count',
    windowSize: 60000,
    slideStep: 10000,
    aggregationType: 'sum',
    windowStartMode: 'dynamic',
  },
  {
    metricName: 'error_rate',
    windowSize: 60000,
    slideStep: 10000,
    aggregationType: 'avg',
    windowStartMode: 'dynamic',
  },
];

const initialAlertRules: AlertRule[] = [
  {
    id: uuidv4(),
    name: '高 CPU 使用率告警',
    level: 'warning',
    operator: 'AND',
    enabled: true,
    createdAt: Date.now(),
    conditions: [
      {
        metricName: 'cpu_usage',
        aggregationType: 'avg',
        threshold: 80,
        direction: 'above',
        duration: 30000,
      },
    ],
  },
  {
    id: uuidv4(),
    name: '高内存使用率告警',
    level: 'critical',
    operator: 'AND',
    enabled: true,
    createdAt: Date.now(),
    conditions: [
      {
        metricName: 'memory_usage',
        aggregationType: 'avg',
        threshold: 90,
        direction: 'above',
        duration: 30000,
      },
    ],
  },
  {
    id: uuidv4(),
    name: 'CPU 和内存同时过高',
    level: 'critical',
    operator: 'AND',
    enabled: true,
    createdAt: Date.now(),
    conditions: [
      {
        metricName: 'cpu_usage',
        aggregationType: 'avg',
        threshold: 70,
        direction: 'above',
        duration: 10000,
      },
      {
        metricName: 'memory_usage',
        aggregationType: 'avg',
        threshold: 80,
        direction: 'above',
        duration: 10000,
      },
    ],
  },
  {
    id: uuidv4(),
    name: '高错误率告警',
    level: 'warning',
    operator: 'AND',
    enabled: true,
    createdAt: Date.now(),
    conditions: [
      {
        metricName: 'error_rate',
        aggregationType: 'avg',
        threshold: 5,
        direction: 'above',
        duration: 20000,
      },
    ],
  },
];

for (const config of defaultAggregations) {
  const key = `${config.metricName}-${config.aggregationType}`;
  const aggregator = new SlidingWindowAggregator(config, (results: AggregationResult[]) => {
    wsService.broadcastAggregationResults(results);
    alertManager.processAggregationResults(results);
  });
  aggregators.set(key, aggregator);
}

for (const rule of initialAlertRules) {
  alertManager.addRule(rule);
}

const initialHistory = dataSimulator.generateBatch(60, Date.now() - 60000, 1000);
historicalStore.addDataPoints(initialHistory);

let dataInterval: NodeJS.Timeout | null = null;

function startDataGeneration(): void {
  if (dataInterval) return;

  dataInterval = setInterval(() => {
    const batch = dataSimulator.generateBatch(1, Date.now(), 1000);
    historicalStore.addDataPoints(batch);
    wsService.broadcastDataPoints(batch);

    for (const aggregator of aggregators.values()) {
      aggregator.addDataPoints(batch);
    }
  }, 1000);
}

function stopDataGeneration(): void {
  if (dataInterval) {
    clearInterval(dataInterval);
    dataInterval = null;
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    clients: wsService.getClientCount(),
    historyStats: historicalStore.getStats(),
  });
});

app.get('/api/metrics', (req, res) => {
  res.json({
    metrics: dataSimulator.getMetricNames(),
    servers: dataSimulator.getServers(),
    environments: dataSimulator.getEnvironments(),
  });
});

app.get('/api/historical', (req, res) => {
  const { metricName, startTime, endTime, aggregationType, downsample, server } = req.query;

  if (!metricName || !startTime || !endTime || !aggregationType) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const dimensions: Record<string, string> = {};
  if (server) {
    dimensions.server = server as string;
  }

  const data = historicalStore.query(
    metricName as string,
    parseInt(startTime as string, 10),
    parseInt(endTime as string, 10),
    aggregationType as 'sum' | 'avg' | 'max' | 'min' | 'count',
    downsample as '1m' | '5m' | '1h' | '1d' | undefined,
    dimensions
  );

  res.json({ data });
});

app.get('/api/alert-rules', (req, res) => {
  res.json({ rules: alertManager.getAllRules() });
});

app.post('/api/alert-rules', (req, res) => {
  const rule: AlertRule = {
    ...req.body,
    id: uuidv4(),
    createdAt: Date.now(),
  };
  alertManager.addRule(rule);
  res.json({ rule });
});

app.put('/api/alert-rules/:id', (req, res) => {
  const existing = alertManager.getRule(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  const rule: AlertRule = { ...existing, ...req.body, id: req.params.id };
  alertManager.updateRule(rule);
  res.json({ rule });
});

app.delete('/api/alert-rules/:id', (req, res) => {
  alertManager.removeRule(req.params.id);
  res.json({ success: true });
});

app.get('/api/alert-events', (req, res) => {
  const status = req.query.status as AlertStatus | undefined;
  res.json({ events: alertManager.getAlertEvents(status) });
});

app.post('/api/alert-events/:id/acknowledge', (req, res) => {
  const { notes } = req.body;
  alertManager.acknowledgeAlert(req.params.id, notes);
  const event = alertManager.getAlertEvent(req.params.id);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  res.json({ event });
});

app.post('/api/generate-anomaly', (req, res) => {
  const { metricName, factor } = req.body;
  const anomaly = dataSimulator.generateAnomaly(metricName || 'cpu_usage', factor || 3);
  historicalStore.addDataPoint(anomaly);
  wsService.broadcastDataPoints([anomaly]);

  for (const aggregator of aggregators.values()) {
    aggregator.addDataPoints([anomaly]);
  }

  res.json({ anomaly });
});

app.post('/api/data/start', (req, res) => {
  startDataGeneration();
  res.json({ started: true });
});

app.post('/api/data/stop', (req, res) => {
  stopDataGeneration();
  res.json({ stopped: true });
});

app.post('/api/data/refresh', (req, res) => {
  const count = parseInt(req.body.count || '60', 10);
  const batch = dataSimulator.generateBatch(count, Date.now() - count * 1000, 1000);
  historicalStore.addDataPoints(batch);
  wsService.broadcastDataPoints(batch);
  res.json({ refreshed: count });
});

startDataGeneration();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`API: http://localhost:${PORT}/api`);
});

process.on('SIGTERM', () => {
  stopDataGeneration();
  wsService.close();
  server.close();
  process.exit(0);
});
