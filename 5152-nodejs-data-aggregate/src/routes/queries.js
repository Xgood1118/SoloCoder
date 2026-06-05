const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

function createQueryRouter(queryEngine, errorTracker, concurrencyController) {
  router.post('/', async (req, res) => {
    try {
      const { queryString, subQueries, joinConfig, fieldOrder, groupBy } = req.body;

      if (!subQueries || !Array.isArray(subQueries) || subQueries.length === 0) {
        return res.status(400).json({ error: 'subQueries must be a non-empty array' });
      }

      if (!joinConfig || !joinConfig.joinFields) {
        return res.status(400).json({ error: 'joinConfig with joinFields is required' });
      }

      for (const sq of subQueries) {
        if (!sq.datasourceId || !sq.query) {
          return res.status(400).json({ error: 'Each subQuery must have datasourceId and query' });
        }
      }

      const result = await queryEngine.execute({
        queryString: queryString || JSON.stringify(subQueries),
        subQueries,
        joinConfig,
        fieldOrder,
        groupBy,
      });

      res.json(result);
    } catch (err) {
      logger.error('Query execution failed', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/cache/stats', (req, res) => {
    const stats = queryEngine.getCacheStats();
    res.json(stats);
  });

  router.delete('/cache', (req, res) => {
    queryEngine.clearCache();
    res.json({ message: 'Cache cleared' });
  });

  router.get('/concurrency/stats', (req, res) => {
    const stats = concurrencyController.getStats();
    res.json(stats);
  });

  router.get('/errors/:datasourceId', (req, res) => {
    const { datasourceId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 50;
    const errors = errorTracker.getErrors(datasourceId, limit);
    const stats = errorTracker.getStats(datasourceId);
    res.json({ datasourceId, errors, stats });
  });

  return router;
}

module.exports = { createQueryRouter };
