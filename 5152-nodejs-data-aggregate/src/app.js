const express = require('express');
const config = require('./config');
const logger = require('./utils/logger');

const dsModel = require('./models/datasource');
const { getAdapter } = require('./datasource');
const { createCacheManager } = require('./cache');
const { createConcurrencyController } = require('./concurrency');
const { createErrorTracker } = require('./error');
const { createQueryEngine } = require('./query/engine');

const datasourceRoutes = require('./routes/datasources');
const { createQueryRouter } = require('./routes/queries');
const { createOpsRouter } = require('./routes/ops');

const app = express();
app.use(express.json());

let serverStatus = {
  ready: false,
  cacheConnected: false,
  startTime: null,
};

app.get('/health', (req, res) => {
  const health = {
    status: serverStatus.ready ? 'ok' : 'degraded',
    cache: {
      connected: serverStatus.cacheConnected,
    },
    uptime: serverStatus.startTime ? Date.now() - serverStatus.startTime : 0,
    datasources: {
      total: dsModel.getAllDatasources().length,
      enabled: dsModel.getEnabledDatasources().length,
    },
  };

  const statusCode = serverStatus.ready || serverStatus.cacheConnected === false ? 200 : 503;
  res.status(statusCode).json(health);
});

const cacheManager = createCacheManager({
  redis: config.redis,
  ttlByDatasourceType: config.cache.ttlByDatasourceType,
});

const concurrencyController = createConcurrencyController({
  globalMaxConcurrent: config.concurrency.globalMaxConcurrent,
  defaultDatasourceMaxConcurrent: config.concurrency.defaultDatasourceMaxConcurrent,
  queryTimeoutMs: config.concurrency.queryTimeoutMs,
});

const errorTracker = createErrorTracker({
  consecutiveFailureThreshold: config.alert.consecutiveFailureThreshold,
  logger,
});
errorTracker.setDatasourceModel(dsModel);

const queryEngine = createQueryEngine({
  datasourceModel: dsModel,
  adapterFactory: { getAdapter },
  cacheManager,
  concurrencyController,
  errorTracker,
  cacheEnabled: config.cache.enabled,
});

app.use('/api/datasources', datasourceRoutes);
app.use('/api/queries', createQueryRouter(queryEngine, errorTracker, concurrencyController));
app.use('/api/ops', createOpsRouter(cacheManager, errorTracker, concurrencyController));

app.use((err, req, res, _next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

async function start() {
  let server;

  try {
    server = app.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port}`);
      serverStatus.startTime = Date.now();
      serverStatus.ready = true;
    });

    server.on('error', (err) => {
      logger.error('Server error', err);
      process.exit(1);
    });
  } catch (err) {
    logger.error('Failed to start HTTP server', err);
    process.exit(1);
  }

  try {
    const result = await cacheManager.init();
    serverStatus.cacheConnected = result.connected;

    if (result.connected) {
      logger.info('Cache manager initialized (Redis connected)');
    } else {
      logger.warn('Cache manager running in degraded mode (Redis not available)');
    }
  } catch (err) {
    logger.warn(`Cache manager init failed, running in degraded mode: ${err.message}`);
    serverStatus.cacheConnected = false;
  }

  try {
    const enabled = dsModel.getEnabledDatasources();
    for (const ds of enabled) {
      if (ds.maxConcurrent) {
        concurrencyController.setDatasourceMaxConcurrent(ds.id, ds.maxConcurrent);
      }
    }
  } catch (err) {
    logger.warn('Failed to set datasource concurrency limits', err);
  }

  return server;
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  try {
    await cacheManager.close();
  } catch (err) {
    logger.warn('Error closing cache manager', err);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  try {
    await cacheManager.close();
  } catch (err) {
    logger.warn('Error closing cache manager', err);
  }
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.warn(`Unhandled rejection at ${promise}: ${reason}`);
});

if (require.main === module) {
  start();
}

module.exports = { app, cacheManager, concurrencyController, errorTracker, queryEngine, start, serverStatus };
