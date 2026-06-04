const express = require('express');
const { db, promisifyDb } = require('../database/init');
const { authenticateApi } = require('../middleware/auth');
const alertService = require('../services/alertService');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticateApi);

router.get('/hosts', async (req, res) => {
  const rows = await promisifyDb(db.hosts, 'find', {});
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(rows.map(r => ({ ...r, id: r._id })));
});

router.post('/hosts', async (req, res) => {
  const { hostname, ip, os } = req.body;
  const agentKey = crypto.randomBytes(32).toString('hex');
  
  const host = await promisifyDb(db.hosts, 'insert', {
    hostname,
    ip: ip || '',
    os: os || 'unknown',
    agent_key: agentKey,
    status: 'online',
    created_at: new Date().toISOString(),
    last_heartbeat: null
  });
  
  res.json({ id: host._id, hostname, agent_key: agentKey });
});

router.delete('/hosts/:id', async (req, res) => {
  const result = await promisifyDb(db.hosts, 'remove', { _id: req.params.id }, {});
  res.json({ deleted: result });
});

router.get('/metrics/:hostId', async (req, res) => {
  const { hostId } = req.params;
  const { metric, start, end } = req.query;
  
  let query = { host_id: hostId };
  
  if (metric) {
    query.metric_name = metric;
  }
  if (start) {
    query.timestamp = { ...query.timestamp, $gte: start };
  }
  if (end) {
    query.timestamp = { ...query.timestamp, $lte: end };
  }
  
  const rows = await promisifyDb(db.metrics, 'find', query);
  rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const limited = rows.slice(0, 1000).map(r => ({ ...r, id: r._id }));
  
  res.json(limited);
});

router.get('/metrics/latest/:hostId', async (req, res) => {
  const { hostId } = req.params;
  
  const allMetrics = await promisifyDb(db.metrics, 'find', { host_id: hostId });
  
  const latestMap = new Map();
  allMetrics.forEach(m => {
    const existing = latestMap.get(m.metric_name);
    if (!existing || new Date(m.timestamp) > new Date(existing.timestamp)) {
      latestMap.set(m.metric_name, { ...m, id: m._id });
    }
  });
  
  res.json(Array.from(latestMap.values()));
});

router.get('/alerts', async (req, res) => {
  const { status } = req.query;
  let query = {};
  
  if (status) {
    query.status = status;
  }
  
  const alerts = await promisifyDb(db.alerts, 'find', query);
  const hosts = await promisifyDb(db.hosts, 'find', {});
  const hostMap = new Map(hosts.map(h => [h._id, h]));
  
  const result = alerts.map(a => ({
    ...a,
    id: a._id,
    hostname: hostMap.get(a.host_id)?.hostname || 'Unknown'
  }));
  
  result.sort((a, b) => new Date(b.triggered_at) - new Date(a.triggered_at));
  
  res.json(result.slice(0, 100));
});

router.post('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const success = await alertService.acknowledgeAlert(req.params.id, 'admin');
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/alerts/:id/resolve', async (req, res) => {
  const { note } = req.body;
  try {
    const success = await alertService.resolveAlertById(req.params.id, 'admin', note || '');
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/rules', async (req, res) => {
  const rows = await promisifyDb(db.alertRules, 'find', {});
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(rows.map(r => ({ ...r, id: r._id })));
});

router.post('/rules', async (req, res) => {
  const { host_id, metric_name, threshold, operator, duration, consecutive_count } = req.body;
  
  const rule = await promisifyDb(db.alertRules, 'insert', {
    host_id: host_id || null,
    metric_name,
    threshold,
    operator: operator || '>',
    duration: duration || 300,
    consecutive_count: consecutive_count || 3,
    enabled: 1,
    created_at: new Date().toISOString()
  });
  
  res.json({ id: rule._id });
});

router.delete('/rules/:id', async (req, res) => {
  const result = await promisifyDb(db.alertRules, 'remove', { _id: req.params.id }, {});
  res.json({ deleted: result });
});

router.get('/templates', async (req, res) => {
  const rows = await promisifyDb(db.templates, 'find', {});
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(rows.map(r => ({ ...r, id: r._id })));
});

router.post('/templates', async (req, res) => {
  const { name, description, config } = req.body;
  
  const template = await promisifyDb(db.templates, 'insert', {
    name,
    description: description || '',
    config,
    created_at: new Date().toISOString()
  });
  
  res.json({ id: template._id });
});

router.post('/templates/:id/apply/:hostId', async (req, res) => {
  const template = await promisifyDb(db.templates, 'findOne', { _id: req.params.id });
  
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  let count = 0;
  for (const rule of template.config.rules) {
    await promisifyDb(db.alertRules, 'insert', {
      host_id: req.params.hostId,
      template_id: req.params.id,
      metric_name: rule.metric_name,
      threshold: rule.threshold,
      operator: rule.operator || '>',
      duration: rule.duration || 300,
      consecutive_count: rule.consecutive_count || 3,
      enabled: 1,
      created_at: new Date().toISOString()
    });
    count++;
  }
  
  res.json({ applied: count });
});

router.get('/dashboards', async (req, res) => {
  const rows = await promisifyDb(db.dashboards, 'find', {});
  rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  res.json(rows.map(r => ({ ...r, id: r._id })));
});

router.post('/dashboards', async (req, res) => {
  const { name, layout } = req.body;
  
  const dashboard = await promisifyDb(db.dashboards, 'insert', {
    name,
    layout,
    user_id: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  
  res.json({ id: dashboard._id });
});

router.put('/dashboards/:id', async (req, res) => {
  const { name, layout } = req.body;
  const result = await promisifyDb(db.dashboards, 'update', 
    { _id: req.params.id },
    { $set: { name, layout, updated_at: new Date().toISOString() } }
  );
  res.json({ updated: result });
});

module.exports = router;
