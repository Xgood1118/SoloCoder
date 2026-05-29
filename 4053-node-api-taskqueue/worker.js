const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const state = require('./state');
const webhook = require('./webhook');
const queue = require('./queue');

const DEFAULT_MAX_CONCURRENCY = 4;
const DEFAULT_HEARTBEAT_INTERVAL = 30000;
const LOCK_DURATION_MS = 120000;

class WorkerPool {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || DEFAULT_MAX_CONCURRENCY;
    this.heartbeatInterval = options.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL;
    this.workers = new Map();
    this.runningTasks = 0;
    this.heartbeatTimer = null;
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    console.log(`[worker] Starting worker pool with maxConcurrency=${this.maxConcurrency}`);

    for (let i = 0; i < this.maxConcurrency; i++) {
      this.spawnWorker();
    }

    this.heartbeatTimer = setInterval(() => {
      this.heartbeatAll();
      this.recoverDeadWorkers();
    }, this.heartbeatInterval);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    console.log('[worker] Stopping worker pool');

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const [workerId, worker] of this.workers) {
      worker.active = false;
      db.deactivateWorker(workerId);
    }
    this.workers.clear();
  }

  spawnWorker() {
    const workerId = `worker-${uuidv4().slice(0, 8)}`;
    const worker = {
      id: workerId,
      active: true,
      currentTask: null
    };
    this.workers.set(workerId, worker);
    db.registerWorker(workerId);
    console.log(`[worker] Spawned worker ${workerId}`);
    return worker;
  }

  async assignTask(workerId, task) {
    const worker = this.workers.get(workerId);
    if (!worker || !worker.active) return false;

    if (task.locked_resources && task.locked_resources.length > 0) {
      const allAvailable = this.acquireResourceLocks(task.id, task.locked_resources, workerId);
      if (!allAvailable) {
        console.log(`[worker] Worker ${workerId} skipping task ${task.id}: resources locked`);
        return false;
      }
    }

    try {
      state.transitionTo(task.id, 'running', { worker_id: workerId });
      worker.currentTask = task.id;
      this.runningTasks++;
      console.log(`[worker] Worker ${workerId} assigned task ${task.id} (type=${task.task_type}, priority=${task.priority})`);

      setImmediate(() => {
        this.executeTask(workerId, task);
      });

      return true;
    } catch (err) {
      console.error(`[worker] Failed to assign task ${task.id} to worker ${workerId}: ${err.message}`);
      this.releaseResourceLocks(task.id);
      return false;
    }
  }

  acquireResourceLocks(taskId, resources, workerId) {
    const expiresAt = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
    for (const resourceId of resources) {
      if (db.isResourceLocked(resourceId)) {
        for (const res of resources) {
          db.releaseResourceLocksForTask(taskId);
          break;
        }
        return false;
      }
      const acquired = db.acquireResourceLock(taskId, resourceId, workerId, expiresAt);
      if (!acquired) {
        db.releaseResourceLocksForTask(taskId);
        return false;
      }
    }
    return true;
  }

  releaseResourceLocks(taskId) {
    db.releaseResourceLocksForTask(taskId);
  }

  async executeTask(workerId, task) {
    const worker = this.workers.get(workerId);
    if (!worker || !worker.active) return;

    try {
      const result = await simulateTaskExecution(task);

      try {
        const updated = state.transitionTo(task.id, 'completed', { result });
        console.log(`[worker] Worker ${workerId} completed task ${task.id}`);
        setImmediate(() => {
          queue.notifyDependents(task.id);
          webhook.notifyTaskComplete(updated);
        });
      } catch (err) {
        console.error(`[worker] State transition error on complete for ${task.id}: ${err.message}`);
      }
    } catch (err) {
      try {
        const updated = state.transitionTo(task.id, 'failed', { error_message: err.message });
        console.log(`[worker] Worker ${workerId} failed task ${task.id}: ${err.message}`);

        const retryConfig = task.retry_config || { max_retries: 3, backoff_base: 2 };
        const maxRetries = retryConfig.max_retries ?? 3;
        if ((updated.retry_count || 0) < maxRetries) {
          const backoffBase = retryConfig.backoff_base ?? 2;
          const backoffMs = Math.pow(backoffBase, updated.retry_count || 0) * 1000;
          console.log(`[worker] Task ${task.id} will be retried (attempt ${(updated.retry_count || 0) + 1}/${maxRetries}) after ${backoffMs}ms`);

          setTimeout(() => {
            try {
              state.retryTask(task.id);
            } catch (retryErr) {
              console.error(`[worker] Retry failed for task ${task.id}: ${retryErr.message}`);
            }
          }, backoffMs);
        } else {
          webhook.notifyTaskComplete(updated);
        }
      } catch (stateErr) {
        console.error(`[worker] State transition error on fail for ${task.id}: ${stateErr.message}`);
      }
    } finally {
      worker.currentTask = null;
      this.runningTasks--;
    }
  }

  heartbeatAll() {
    for (const [workerId] of this.workers) {
      db.updateWorkerHeartbeat(workerId);
    }
  }

  recoverDeadWorkers() {
    const deadWorkers = db.getDeadWorkers();
    for (const dw of deadWorkers) {
      const wasInPool = this.workers.has(dw.worker_id);
      console.log(`[worker] Recovering tasks from dead worker ${dw.worker_id} (inPool=${wasInPool})`);
      db.recoverTasksForWorker(dw.worker_id);
      this.workers.delete(dw.worker_id);
      if (wasInPool && this.workers.size < this.maxConcurrency && this.started) {
        this.spawnWorker();
      }
    }
  }

  getAvailableWorker() {
    for (const [workerId, worker] of this.workers) {
      if (worker.active && !worker.currentTask) {
        return worker;
      }
    }
    return null;
  }

  getRunningCount() {
    return this.runningTasks;
  }

  getWorkerList() {
    const result = [];
    for (const [workerId, worker] of this.workers) {
      result.push({
        worker_id: workerId,
        active: worker.active,
        current_task: worker.currentTask || null
      });
    }
    return result;
  }
}

async function simulateTaskExecution(task) {
  const execTime = Math.floor(Math.random() * 500) + 100;
  await new Promise(resolve => setTimeout(resolve, execTime));

  const shouldFail = Math.random() < 0.1;
  if (shouldFail) {
    throw new Error(`Simulated execution failure for task ${task.id}`);
  }

  return {
    task_type: task.task_type,
    processed: true,
    execution_time_ms: execTime
  };
}

let pool = null;

function getPool() {
  if (!pool) {
    pool = new WorkerPool();
  }
  return pool;
}

module.exports = {
  WorkerPool,
  getPool,
  simulateTaskExecution
};
