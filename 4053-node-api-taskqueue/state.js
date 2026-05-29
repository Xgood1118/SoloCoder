const db = require('./database');

const TRANSITIONS = {
  pending: ['scheduled', 'cancelled'],
  scheduled: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  failed: ['scheduled'],
  completed: [],
  cancelled: []
};

const VALID_STATUSES = Object.keys(TRANSITIONS);

function isValidTransition(fromStatus, toStatus) {
  if (!VALID_STATUSES.includes(fromStatus)) return false;
  if (!VALID_STATUSES.includes(toStatus)) return false;
  return TRANSITIONS[fromStatus].includes(toStatus);
}

function transitionTo(taskId, newStatus, options = {}) {
  const task = db.getTaskById(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const currentStatus = task.status;

  if (currentStatus === newStatus) {
    return task;
  }

  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(
      `Invalid state transition: ${currentStatus} -> ${newStatus} for task ${taskId}`
    );
  }

  const updates = { status: newStatus };
  const now = new Date().toISOString();

  switch (newStatus) {
    case 'scheduled':
      updates.scheduled_at = now;
      break;
    case 'running':
      updates.started_at = now;
      if (options.worker_id) {
        updates.worker_id = options.worker_id;
      }
      break;
    case 'completed':
      updates.completed_at = now;
      updates.progress = 100;
      if (options.result) {
        updates.payload = JSON.stringify(options.result);
      }
      break;
    case 'failed':
      updates.completed_at = now;
      updates.error_message = options.error_message || 'Task execution failed';
      console.log(`[state] Task ${taskId} transitioned to failed, error: ${updates.error_message}`);
      break;
    case 'cancelled':
      if (currentStatus === 'running' && task.worker_id) {
        console.log(`[state] Sending stop signal to worker ${task.worker_id} for task ${taskId}`);
      }
      updates.completed_at = now;
      break;
  }

  const updated = db.updateTask(taskId, updates);

  if (newStatus === 'completed' || newStatus === 'failed') {
    db.releaseResourceLocksForTask(taskId);
  }

  return updated;
}

function retryTask(taskId) {
  const task = db.getTaskById(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  if (task.status !== 'failed') {
    throw new Error(`Cannot retry task in ${task.status} state. Only failed tasks can be retried.`);
  }

  const retryConfig = task.retry_config || { max_retries: 3, backoff_base: 2 };
  const maxRetries = retryConfig.max_retries ?? 3;
  const newRetryCount = (task.retry_count || 0) + 1;

  if (newRetryCount > maxRetries) {
    const err = new Error(`Task ${taskId} has exceeded max retries (${maxRetries})`);
    err.statusCode = 409;
    throw err;
  }

  const updates = {
    status: 'scheduled',
    retry_count: newRetryCount,
    error_message: null,
    completed_at: null,
    started_at: null,
    progress: 0
  };

  console.log(`[state] Retrying task ${taskId}, retry_count=${task.retry_count || 0} -> ${newRetryCount} (max=${maxRetries})`);

  db.updateTask(taskId, updates);
  return db.getTaskById(taskId);
}

function cancelTask(taskId) {
  const task = db.getTaskById(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  if (task.status === 'completed' || task.status === 'cancelled') {
    throw new Error(`Cannot cancel task in ${task.status} state`);
  }

  return transitionTo(taskId, 'cancelled');
}

module.exports = {
  TRANSITIONS,
  VALID_STATUSES,
  isValidTransition,
  transitionTo,
  retryTask,
  cancelTask
};
