const express = require('express');
const db = require('./database');
const queue = require('./queue');
const state = require('./state');
const scheduler = require('./scheduler');
const workerModule = require('./worker');

const app = express();
app.use(express.json({ limit: '10mb' }));

let initialized = false;

function startServer(port = 3000) {
  if (!initialized) {
    db.init();
    scheduler.start({ pollInterval: 1000 });
    initialized = true;
  }

  const server = app.listen(port, () => {
    console.log(`[server] TaskQueue API running on port ${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] Port ${port} is already in use, trying ${port + 1}`);
      startServer(port + 1);
    } else {
      console.error(`[server] Server error: ${err.message}`);
      process.exit(1);
    }
  });

  return app;
}

app.post('/tasks', (req, res) => {
  try {
    const { task_type, payload, priority, depend_tasks, locked_resources, callback_url, retry_config, batch_id } = req.body;

    if (!task_type) {
      return res.status(400).json({ error: 'task_type is required' });
    }

    const task = queue.enqueue({
      task_type,
      payload: payload || {},
      priority: priority ?? 5,
      depend_tasks: depend_tasks || [],
      locked_resources: locked_resources || [],
      callback_url: callback_url || null,
      retry_config: retry_config || { max_retries: 3, backoff_base: 2 },
      batch_id: batch_id || null
    });

    res.status(201).json(task);
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[server] Error creating task: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/tasks/batch', (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'tasks array is required and must not be empty' });
    }

    for (const t of tasks) {
      if (!t.task_type) {
        return res.status(400).json({ error: 'Each task must have a task_type' });
      }
    }

    const ids = queue.batchEnqueue(tasks);
    res.status(201).json({ task_ids: ids, count: ids.length });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[server] Error batch creating tasks: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/tasks', (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority_gte) filters.priority_gte = parseInt(req.query.priority_gte, 10);
    if (req.query.batch_id) filters.batch_id = req.query.batch_id;
    if (req.query.limit) filters.limit = parseInt(req.query.limit, 10);
    if (req.query.offset) filters.offset = parseInt(req.query.offset, 10);

    const tasks = db.listTasks(filters);
    res.json(tasks);
  } catch (err) {
    console.error(`[server] Error listing tasks: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/tasks/:id', (req, res) => {
  try {
    const task = queue.getTaskDetail(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    console.error(`[server] Error getting task: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.put('/tasks/:id/cancel', (req, res) => {
  try {
    const task = state.cancelTask(req.params.id);
    res.json(task);
  } catch (err) {
    if (err.message.includes('Cannot cancel')) {
      return res.status(409).json({ error: err.message });
    }
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    console.error(`[server] Error cancelling task: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.put('/tasks/:id/retry', (req, res) => {
  try {
    const task = state.retryTask(req.params.id);
    res.json(task);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    console.error(`[server] Error retrying task: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/tasks/batch/:batch_id', (req, res) => {
  try {
    const cancelledCount = db.cancelBatch(req.params.batch_id);
    res.json({ batch_id: req.params.batch_id, cancelled_count: cancelledCount });
  } catch (err) {
    console.error(`[server] Error batch cancelling: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (err) {
    console.error(`[server] Error getting stats: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/workers', (req, res) => {
  try {
    const pool = workerModule.getPool();
    const poolWorkers = pool.getWorkerList();
    const dbWorkers = db.getActiveWorkers();
    res.json({
      pool_workers: poolWorkers,
      active_db_workers: dbWorkers,
      running_tasks: pool.getRunningCount()
    });
  } catch (err) {
    console.error(`[server] Error getting workers: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

function gracefulShutdown() {
  console.log('[server] Graceful shutdown initiated');
  scheduler.stop();
  db.close();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  startServer(port);
}

module.exports = { app, startServer };
