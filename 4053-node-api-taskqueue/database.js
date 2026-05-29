const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function init(dbPath) {
  if (db) return db;
  db = new Database(dbPath || path.join(__dirname, 'taskqueue.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  createTables();
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      task_type TEXT NOT NULL,
      payload TEXT DEFAULT '{}',
      priority INTEGER DEFAULT 5 CHECK(priority >= 0 AND priority <= 9),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','scheduled','running','completed','failed','cancelled')),
      depend_tasks TEXT DEFAULT '[]',
      locked_resources TEXT DEFAULT '[]',
      retry_config TEXT DEFAULT '{"max_retries":3,"backoff_base":2}',
      retry_count INTEGER DEFAULT 0,
      progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
      worker_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      callback_url TEXT
    );

    CREATE TABLE IF NOT EXISTS resource_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      locked_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS webhook_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      callback_url TEXT NOT NULL,
      payload TEXT NOT NULL,
      error_message TEXT,
      attempt_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workers (
      worker_id TEXT PRIMARY KEY,
      last_heartbeat TEXT DEFAULT (datetime('now')),
      active INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status_priority_created
      ON tasks(status, priority DESC, created_at ASC);

    CREATE INDEX IF NOT EXISTS idx_tasks_batch_id ON tasks(batch_id);
    CREATE INDEX IF NOT EXISTS idx_resource_locks_resource_id ON resource_locks(resource_id);
    CREATE INDEX IF NOT EXISTS idx_resource_locks_task_id ON resource_locks(task_id);
    CREATE INDEX IF NOT EXISTS idx_workers_last_heartbeat ON workers(last_heartbeat);
  `);
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call init() first.');
  return db;
}

function createTask(taskData) {
  const { v4: uuidv4 } = require('uuid');
  const id = taskData.id || uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO tasks (id, batch_id, task_type, payload, priority, status, depend_tasks, locked_resources, retry_config, callback_url, created_at)
    VALUES (@id, @batch_id, @task_type, @payload, @priority, @status, @depend_tasks, @locked_resources, @retry_config, @callback_url, @created_at)
  `);

  const row = {
    id,
    batch_id: taskData.batch_id || null,
    task_type: taskData.task_type,
    payload: JSON.stringify(taskData.payload || {}),
    priority: taskData.priority ?? 5,
    status: 'pending',
    depend_tasks: JSON.stringify(taskData.depend_tasks || []),
    locked_resources: JSON.stringify(taskData.locked_resources || []),
    retry_config: JSON.stringify(taskData.retry_config || { max_retries: 3, backoff_base: 2 }),
    callback_url: taskData.callback_url || null,
    created_at: now
  };

  stmt.run(row);
  return getTaskById(id);
}

function getTaskById(id) {
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  return deserializeTask(row);
}

function updateTask(id, updates) {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  if (fields.length === 0) return null;
  values.push(id);
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getTaskById(id);
}

function deleteTask(id) {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

function listTasks(filters = {}) {
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const values = [];

  if (filters.status) {
    sql += ' AND status = ?';
    values.push(filters.status);
  }
  if (filters.priority_gte !== undefined) {
    sql += ' AND priority >= ?';
    values.push(filters.priority_gte);
  }
  if (filters.batch_id) {
    sql += ' AND batch_id = ?';
    values.push(filters.batch_id);
  }

  sql += ' ORDER BY priority DESC, created_at ASC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    values.push(filters.limit);
  }
  if (filters.offset) {
    sql += ' OFFSET ?';
    values.push(filters.offset);
  }

  const rows = db.prepare(sql).all(...values);
  return rows.map(deserializeTask);
}

function getScheduledTasks(limit = 10) {
  const rows = db.prepare(
    "SELECT * FROM tasks WHERE status = 'scheduled' ORDER BY priority DESC, created_at ASC LIMIT ?"
  ).all(limit);
  return rows.map(deserializeTask);
}

function getPendingTasksWithMetDeps() {
  const rows = db.prepare(`
    SELECT t.* FROM tasks t
    WHERE t.status = 'pending'
    AND t.depend_tasks = '[]'
  `).all();
  const result = [...rows.map(deserializeTask)];

  const pendingRows = db.prepare(
    "SELECT * FROM tasks WHERE status = 'pending' AND depend_tasks != '[]'"
  ).all();

  for (const row of pendingRows) {
    const task = deserializeTask(row);
    if (task.depend_tasks.length === 0) {
      result.push(task);
      continue;
    }
    const deps = task.depend_tasks;
    const placeholders = deps.map(() => '?').join(',');
    const completedCount = db.prepare(
      `SELECT COUNT(*) as cnt FROM tasks WHERE id IN (${placeholders}) AND status = 'completed'`
    ).get(...deps);
    if (completedCount.cnt === deps.length) {
      result.push(task);
    }
  }
  return result;
}

function findDependentTasks(taskId) {
  const rows = db.prepare(
    "SELECT * FROM tasks WHERE status = 'pending' AND depend_tasks != '[]'"
  ).all();
  const result = [];
  for (const row of rows) {
    const task = deserializeTask(row);
    if (task.depend_tasks.includes(taskId)) {
      result.push(task);
    }
  }
  return result;
}

function acquireResourceLock(taskId, resourceId, workerId, expiresAt) {
  try {
    db.prepare(
      'INSERT INTO resource_locks (resource_id, task_id, worker_id, expires_at) VALUES (?, ?, ?, ?)'
    ).run(resourceId, taskId, workerId, expiresAt);
    return true;
  } catch (err) {
    if (err.message.includes('UNIQUE constraint') || err.message.includes('unique')) {
      return false;
    }
    throw err;
  }
}

function releaseResourceLocksForTask(taskId) {
  db.prepare('DELETE FROM resource_locks WHERE task_id = ?').run(taskId);
}

function isResourceLocked(resourceId) {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM resource_locks WHERE expires_at < ?').run(now);
  const row = db.prepare('SELECT * FROM resource_locks WHERE resource_id = ?').get(resourceId);
  return !!row;
}

function getLockedResources() {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM resource_locks WHERE expires_at < ?').run(now);
  return db.prepare('SELECT * FROM resource_locks').all();
}

function registerWorker(workerId) {
  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR REPLACE INTO workers (worker_id, last_heartbeat, active) VALUES (?, ?, 1)'
  ).run(workerId, now);
}

function updateWorkerHeartbeat(workerId) {
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE workers SET last_heartbeat = ?, active = 1 WHERE worker_id = ?'
  ).run(now, workerId);
}

function getActiveWorkers() {
  const cutoff = new Date(Date.now() - 60 * 1000).toISOString();
  return db.prepare(
    'SELECT * FROM workers WHERE active = 1 AND last_heartbeat > ?'
  ).all(cutoff);
}

function getDeadWorkers() {
  const cutoff = new Date(Date.now() - 60 * 1000).toISOString();
  return db.prepare(
    'SELECT * FROM workers WHERE active = 1 AND last_heartbeat <= ?'
  ).all(cutoff);
}

function deactivateWorker(workerId) {
  db.prepare('UPDATE workers SET active = 0 WHERE worker_id = ?').run(workerId);
}

function recoverTasksForWorker(workerId) {
  db.prepare(
    "UPDATE tasks SET status = 'scheduled', worker_id = NULL, started_at = NULL WHERE worker_id = ? AND status = 'running'"
  ).run(workerId);
  db.prepare('DELETE FROM resource_locks WHERE worker_id = ?').run(workerId);
  db.prepare('UPDATE workers SET active = 0 WHERE worker_id = ?').run(workerId);
}

function batchCreateTasks(tasksData) {
  const stmt = db.prepare(`
    INSERT INTO tasks (id, batch_id, task_type, payload, priority, status, depend_tasks, locked_resources, retry_config, callback_url, created_at)
    VALUES (@id, @batch_id, @task_type, @payload, @priority, @status, @depend_tasks, @locked_resources, @retry_config, @callback_url, @created_at)
  `);

  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();
  const ids = [];
  const insertMany = db.transaction((items) => {
    for (const taskData of items) {
      const id = taskData.id || uuidv4();
      const row = {
        id,
        batch_id: taskData.batch_id || null,
        task_type: taskData.task_type,
        payload: JSON.stringify(taskData.payload || {}),
        priority: taskData.priority ?? 5,
        status: 'pending',
        depend_tasks: JSON.stringify(taskData.depend_tasks || []),
        locked_resources: JSON.stringify(taskData.locked_resources || []),
        retry_config: JSON.stringify(taskData.retry_config || { max_retries: 3, backoff_base: 2 }),
        callback_url: taskData.callback_url || null,
        created_at: now
      };
      stmt.run(row);
      ids.push(id);
    }
  });
  insertMany(tasksData);
  return ids;
}

function cancelBatch(batchId) {
  const result = db.prepare(
    "UPDATE tasks SET status = 'cancelled' WHERE batch_id = ? AND status IN ('pending', 'scheduled')"
  ).run(batchId);
  return result.changes;
}

function getStats() {
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM tasks GROUP BY status
  `).all();

  const avgTimes = db.prepare(`
    SELECT
      AVG(CASE WHEN scheduled_at IS NOT NULL AND created_at IS NOT NULL
        THEN (julianday(scheduled_at) - julianday(created_at)) * 86400 ELSE NULL END) as avg_wait_seconds,
      AVG(CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
        THEN (julianday(completed_at) - julianday(started_at)) * 86400 ELSE NULL END) as avg_exec_seconds
    FROM tasks
    WHERE status IN ('completed', 'failed')
  `).get();

  const counts = {};
  for (const row of statusCounts) {
    counts[row.status] = row.count;
  }

  return {
    pending: counts.pending || 0,
    scheduled: counts.scheduled || 0,
    running: counts.running || 0,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
    cancelled: counts.cancelled || 0,
    avg_wait_seconds: avgTimes.avg_wait_seconds ? Math.round(avgTimes.avg_wait_seconds * 100) / 100 : 0,
    avg_exec_seconds: avgTimes.avg_exec_seconds ? Math.round(avgTimes.avg_exec_seconds * 100) / 100 : 0
  };
}

function recordWebhookFailure(taskId, callbackUrl, payload, errorMessage, attemptCount) {
  db.prepare(
    'INSERT INTO webhook_failures (task_id, callback_url, payload, error_message, attempt_count) VALUES (?, ?, ?, ?, ?)'
  ).run(taskId, callbackUrl, JSON.stringify(payload), errorMessage, attemptCount);
}

function checkCycle(taskId, dependTasks, virtualDeps) {
  if (!dependTasks || dependTasks.length === 0) return false;

  const visited = new Set();
  const stack = new Set();

  function getDepsForTask(id) {
    if (virtualDeps && virtualDeps[id]) {
      return virtualDeps[id];
    }
    const task = db.prepare('SELECT depend_tasks FROM tasks WHERE id = ?').get(id);
    if (task) {
      return JSON.parse(task.depend_tasks || '[]');
    }
    return [];
  }

  function hasCycleFrom(currentId) {
    visited.add(currentId);
    stack.add(currentId);

    const deps = getDepsForTask(currentId);
    for (const depId of deps) {
      if (!visited.has(depId)) {
        if (hasCycleFrom(depId)) return true;
      } else if (stack.has(depId)) {
        return true;
      }
    }

    stack.delete(currentId);
    return false;
  }

  for (const depId of dependTasks) {
    visited.clear();
    stack.clear();
    stack.add(taskId);
    visited.add(taskId);
    if (depId === taskId) return true;
    if (hasCycleFrom(depId)) return true;
  }
  return false;
}

function taskExists(id) {
  const row = db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(id);
  return !!row;
}

function deserializeTask(row) {
  return {
    ...row,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    depend_tasks: typeof row.depend_tasks === 'string' ? JSON.parse(row.depend_tasks) : row.depend_tasks,
    locked_resources: typeof row.locked_resources === 'string' ? JSON.parse(row.locked_resources) : row.locked_resources,
    retry_config: typeof row.retry_config === 'string' ? JSON.parse(row.retry_config) : row.retry_config
  };
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  init,
  getDb,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  listTasks,
  getScheduledTasks,
  getPendingTasksWithMetDeps,
  findDependentTasks,
  acquireResourceLock,
  releaseResourceLocksForTask,
  isResourceLocked,
  getLockedResources,
  registerWorker,
  updateWorkerHeartbeat,
  getActiveWorkers,
  getDeadWorkers,
  deactivateWorker,
  recoverTasksForWorker,
  batchCreateTasks,
  cancelBatch,
  getStats,
  recordWebhookFailure,
  checkCycle,
  taskExists,
  deserializeTask,
  close
};
