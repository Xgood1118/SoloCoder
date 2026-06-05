const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { processingQueue } = require('./processing-queue');
const { directoryWatcher } = require('./directory-watcher');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const sseClients = new Set();

app.get('/api/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const clientId = Date.now() + '_' + Math.random();
  sseClients.add(res);

  const queueInfo = processingQueue.getQueueInfo();
  res.write(`data: ${JSON.stringify({ type: 'queue', data: queueInfo })}\n\n`);

  try {
    const dirs = await directoryWatcher.getDirectories();
    res.write(`data: ${JSON.stringify({ type: 'directories', data: dirs })}\n\n`);
  } catch (err) {
    console.error('Failed to get directories:', err);
  }

  req.on('close', () => {
    sseClients.delete(res);
  });
});

function broadcastEvent(type, data) {
  const message = `data: ${JSON.stringify({ type, data })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

processingQueue.on('queueUpdate', (info) => {
  broadcastEvent('queue', info);
});

processingQueue.on('processingComplete', ({ item, result }) => {
  broadcastEvent('record', {
    file_path: item.filePath,
    file_name: item.fileName,
    file_size: item.fileSize,
    result: result.result,
    reason: result.reason,
    duration_ms: result.duration,
    rule_name: item.ruleName,
    retry_count: item.retryCount,
    md5: result.md5,
    created_at: new Date().toISOString(),
  });
});

processingQueue.on('record', (record) => {
  broadcastEvent('record', {
    ...record,
    created_at: new Date().toISOString(),
  });
});

directoryWatcher.on = (event, callback) => {};

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
