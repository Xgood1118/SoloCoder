const express = require('express');
const dsModel = require('../models/datasource');
const { getCacheStats, clearCache } = require('../cache');

const router = express.Router();

function createOpsRouter(cacheManager, errorTracker, concurrencyController) {
  router.get('/dashboard', (req, res) => {
    const datasources = dsModel.getAllDatasources();
    const cacheStats = cacheManager.getHitRate();
    const concurrencyStats = concurrencyController.getStats();

    const datasourceStats = datasources.map((ds) => ({
      id: ds.id,
      name: ds.name,
      type: ds.type,
      enabled: ds.enabled,
      errorRate: dsModel.getErrorRate(ds.id),
      consecutiveFailures: ds.consecutiveFailures,
      totalQueries: ds.totalQueries,
      totalFailures: ds.totalFailures,
      alertTriggered: errorTracker.shouldAlert(ds.id),
    }));

    res.json({
      datasources: datasourceStats,
      cache: cacheStats,
      concurrency: concurrencyStats,
    });
  });

  router.get('/cache/stats', (req, res) => {
    res.json(cacheManager.getHitRate());
  });

  router.post('/cache/clear', (req, res) => {
    cacheManager.resetStats();
    res.json({ message: 'Cache stats reset' });
  });

  router.get('/concurrency', (req, res) => {
    res.json(concurrencyController.getStats());
  });

  router.get('/errors', (req, res) => {
    const datasources = dsModel.getAllDatasources();
    const errorStats = datasources.map((ds) => ({
      id: ds.id,
      name: ds.name,
      consecutiveFailures: errorTracker.getConsecutiveFailures(ds.id),
      stats: errorTracker.getStats(ds.id),
    }));
    res.json(errorStats);
  });

  return router;
}

module.exports = { createOpsRouter };
