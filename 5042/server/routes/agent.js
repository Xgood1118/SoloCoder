const express = require('express');
const { db, promisifyDb } = require('../database/init');
const { authenticateAgent } = require('../middleware/auth');
const alertService = require('../services/alertService');

const router = express.Router();

router.post('/metrics', authenticateAgent, async (req, res) => {
  const { metrics } = req.body;
  const hostId = req.agentHost._id;
  console.log('Received metrics from host:', hostId, 'count:', metrics?.length);

  if (!Array.isArray(metrics)) {
    return res.status(400).json({ error: 'Metrics must be an array' });
  }

  const validMetrics = metrics.filter(m => m.name && typeof m.value === 'number');
  console.log('Valid metrics:', validMetrics.length);
  
  for (const m of validMetrics) {
    try {
      await promisifyDb(db.metrics, 'insert', {
        host_id: hostId,
        metric_name: m.name,
        metric_value: m.value,
        timestamp: new Date().toISOString()
      });
      await alertService.processMetric(hostId, m.name, m.value);
    } catch (e) {
      console.error('Error inserting metric:', e.message);
    }
  }

  res.json({ success: true, received: validMetrics.length });
});

router.get('/config', authenticateAgent, async (req, res) => {
  const rules = await promisifyDb(db.alertRules, 'find', {
    $or: [{ host_id: req.agentHost._id }, { host_id: null }]
  });
  
  res.json({
    host: req.agentHost,
    rules: rules,
    interval: 60
  });
});

router.post('/heartbeat', authenticateAgent, (req, res) => {
  res.json({ success: true, timestamp: new Date().toISOString() });
});

module.exports = router;
