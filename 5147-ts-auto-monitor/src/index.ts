import express from 'express';
import path from 'path';
import { createModuleLogger } from './utils/logger';
import config from './config/env';
import { MonitorService } from './MonitorService';
import { DownsampleLevel } from './metrics/MetricsStore';

const logger = createModuleLogger('Main');
const app = express();
const monitorService = new MonitorService();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/health', (_req, res) => {
  const status = monitorService.getStatus();
  res.json({
    status: 'ok',
    ...status,
  });
});

app.get('/metrics', async (_req, res) => {
  const exporter = monitorService.getPrometheusExporter();
  if (!exporter.isEnabled()) {
    res.status(404).send('Prometheus metrics are disabled');
    return;
  }

  res.set('Content-Type', exporter.getContentType());
  res.send(await exporter.getMetrics());
});

app.get('/api/metrics/names', (_req, res) => {
  const store = monitorService.getMetricsStore();
  res.json({
    names: store.getMetricNames(),
  });
});

app.get('/api/metrics/query', (req, res) => {
  const { name, start, end, level } = req.query;

  if (!name) {
    res.status(400).json({ error: 'Metric name is required' });
    return;
  }

  function toMs(raw: unknown, fallback: number): number {
    if (!raw) return fallback;
    const n = parseInt(String(raw), 10);
    if (isNaN(n)) return fallback;
    return n < 1e12 ? n * 1000 : n;
  }

  const store = monitorService.getMetricsStore();
  const startTime = toMs(start, Date.now() - 3600000);
  const endTime = toMs(end, Date.now());
  const downsampleLevel = (level as DownsampleLevel) || 'raw';

  const result = store.queryRange(
    name as string,
    startTime,
    endTime,
    downsampleLevel
  );

  res.json({
    metric: name,
    startTime,
    endTime,
    level: downsampleLevel,
    data: result,
  });
});

app.get('/api/alerts/active', (_req, res) => {
  const engine = monitorService.getAlertEngine();
  res.json({
    alerts: engine.getActiveAlerts(),
  });
});

app.get('/api/alerts/rules', (_req, res) => {
  const engine = monitorService.getAlertEngine();
  res.json({
    rules: engine.getRules(),
  });
});

app.get('/api/status', (_req, res) => {
  res.json(monitorService.getStatus());
});

app.post('/api/alerts/rules/reload', (_req, res) => {
  const engine = monitorService.getAlertEngine();
  engine.loadRules();
  res.json({
    success: true,
    ruleCount: engine.getRules().length,
  });
});

async function startServer() {
  try {
    await monitorService.start();

    app.listen(config.port, config.host, () => {
      logger.info(`HTTP服务已启动`, {
        host: config.host,
        port: config.port,
      });
      logger.info(`健康检查: http://${config.host}:${config.port}/health`);
      logger.info(`Prometheus指标: http://${config.host}:${config.port}/metrics`);
      logger.info(`前端仪表盘: http://${config.host}:${config.port}/`);
    });

    process.on('SIGTERM', async () => {
      logger.info('收到SIGTERM信号，正在关闭...');
      monitorService.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('收到SIGINT信号，正在关闭...');
      monitorService.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('启动失败', { error: (error as Error).message });
    process.exit(1);
  }
}

startServer();
