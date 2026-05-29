const queue = require('./queue');
const workerModule = require('./worker');
const db = require('./database');

const DEFAULT_POLL_INTERVAL = 1000;
const DEPENDENCY_CHECK_INTERVAL = 2000;

let pollTimer = null;
let depCheckTimer = null;
let started = false;

function start(options = {}) {
  if (started) return;
  started = true;

  const pollInterval = options.pollInterval || DEFAULT_POLL_INTERVAL;
  const pool = workerModule.getPool();

  pool.start();

  console.log(`[scheduler] Starting scheduler with pollInterval=${pollInterval}ms`);

  scheduleNextPoll();

  depCheckTimer = setInterval(() => {
    queue.processNotifications();
  }, DEPENDENCY_CHECK_INTERVAL);

  function scheduleNextPoll() {
    if (!started) return;
    setImmediate(() => {
      poll(pollInterval);
    });
  }

  function poll(interval) {
    if (!started) return;

    try {
      queue.processNotifications();

      const promoted = queue.checkAndPromotePendingTasks();
      if (promoted > 0) {
        console.log(`[scheduler] Promoted ${promoted} pending tasks to scheduled`);
      }

      const readyTasks = queue.fetchReadyTasks(pool.maxConcurrency);
      for (const task of readyTasks) {
        const availableWorker = pool.getAvailableWorker();
        if (!availableWorker) break;
        pool.assignTask(availableWorker.id, task);
      }
    } catch (err) {
      console.error(`[scheduler] Poll error: ${err.message}`);
    }

    pollTimer = setTimeout(() => {
      scheduleNextPoll();
    }, interval);
  }
}

function stop() {
  if (!started) return;
  started = false;
  console.log('[scheduler] Stopping scheduler');

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  if (depCheckTimer) {
    clearInterval(depCheckTimer);
    depCheckTimer = null;
  }

  const pool = workerModule.getPool();
  pool.stop();
}

function isRunning() {
  return started;
}

module.exports = {
  start,
  stop,
  isRunning
};
