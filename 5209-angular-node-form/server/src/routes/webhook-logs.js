const express = require('express');
const router = express.Router();
const storage = require('../storage');
const { replayWebhook } = require('../webhook');

router.get('/', (req, res) => {
  const { formId } = req.query;
  const logs = storage.getWebhookLogs(formId || null);
  res.json(logs);
});

router.post('/:logId/replay', async (req, res) => {
  const logs = storage.getWebhookLogs();
  const log = logs.find(l => l.id === req.params.logId);
  if (!log) {
    return res.status(404).json({ error: 'Webhook log not found' });
  }

  const result = await replayWebhook(log.submissionId);
  res.json(result);
});

module.exports = router;
