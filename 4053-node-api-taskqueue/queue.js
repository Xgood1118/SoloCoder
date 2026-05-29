const db = require('./database');
const state = require('./state');
const { v4: uuidv4 } = require('uuid');

const pendingNotifications = [];

function enqueue(taskData) {
  const taskId = taskData.id || uuidv4();

  if (taskData.depend_tasks && taskData.depend_tasks.length > 0) {
    for (const depId of taskData.depend_tasks) {
      if (!db.taskExists(depId)) {
        const err = new Error(`Dependency task ${depId} does not exist`);
        err.statusCode = 400;
        throw err;
      }
    }
    if (db.checkCycle(taskId, taskData.depend_tasks)) {
      const err = new Error('Circular dependency detected');
      err.statusCode = 400;
      throw err;
    }
  }

  const task = db.createTask({ ...taskData, id: taskId });

  if (!task.depend_tasks || task.depend_tasks.length === 0) {
    state.transitionTo(task.id, 'scheduled');
    return db.getTaskById(task.id);
  }

  return task;
}

function batchEnqueue(tasksData) {
  const tasksWithIds = tasksData.map(t => ({ ...t, id: t.id || uuidv4() }));

  const virtualDeps = {};
  for (const t of tasksWithIds) {
    virtualDeps[t.id] = t.depend_tasks || [];
  }

  for (const taskData of tasksWithIds) {
    if (taskData.depend_tasks && taskData.depend_tasks.length > 0) {
      for (const depId of taskData.depend_tasks) {
        if (!db.taskExists(depId) && !virtualDeps[depId]) {
          const err = new Error(`Dependency task ${depId} does not exist`);
          err.statusCode = 400;
          throw err;
        }
      }
      if (db.checkCycle(taskData.id, taskData.depend_tasks, virtualDeps)) {
        const err = new Error('Circular dependency detected');
        err.statusCode = 400;
        throw err;
      }
    }
  }

  const ids = db.batchCreateTasks(tasksWithIds);

  for (const id of ids) {
    const task = db.getTaskById(id);
    if (!task.depend_tasks || task.depend_tasks.length === 0) {
      state.transitionTo(id, 'scheduled');
    }
  }

  return ids;
}

function fetchReadyTasks(limit = 10) {
  return db.getScheduledTasks(limit);
}

function checkAndPromotePendingTasks() {
  const readyTasks = db.getPendingTasksWithMetDeps();
  for (const task of readyTasks) {
    try {
      state.transitionTo(task.id, 'scheduled');
    } catch (err) {
      console.error(`[queue] Failed to promote task ${task.id}: ${err.message}`);
    }
  }
  return readyTasks.length;
}

function notifyDependents(completedTaskId) {
  pendingNotifications.push(completedTaskId);
}

function processNotifications() {
  while (pendingNotifications.length > 0) {
    const taskId = pendingNotifications.shift();
    try {
      const dependents = db.findDependentTasks(taskId);
      for (const dep of dependents) {
        if (dep.status === 'pending') {
          const deps = dep.depend_tasks;
          const allCompleted = deps.every(depId => {
            const depTask = db.getTaskById(depId);
            return depTask && depTask.status === 'completed';
          });
          if (allCompleted) {
            state.transitionTo(dep.id, 'scheduled');
            console.log(`[queue] Task ${dep.id} promoted to scheduled (dependency ${taskId} completed)`);
          }
        }
      }
    } catch (err) {
      console.error(`[queue] Error processing notification for ${taskId}: ${err.message}`);
    }
  }
}

function getTaskDetail(taskId) {
  const task = db.getTaskById(taskId);
  if (!task) return null;

  const depStatuses = {};
  if (task.depend_tasks && task.depend_tasks.length > 0) {
    for (const depId of task.depend_tasks) {
      const depTask = db.getTaskById(depId);
      depStatuses[depId] = depTask ? depTask.status : 'unknown';
    }
  }

  return { ...task, dependency_statuses: depStatuses };
}

module.exports = {
  enqueue,
  batchEnqueue,
  fetchReadyTasks,
  checkAndPromotePendingTasks,
  notifyDependents,
  processNotifications,
  getTaskDetail
};
