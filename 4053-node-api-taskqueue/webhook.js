const http = require('http');
const https = require('https');
const db = require('./database');

const MAX_RETRIES = 3;
const BACKOFF_BASE = 2;
const MAX_BACKOFF_MS = 60000;

const retryQueue = [];
let processing = false;

function sendWebhook(taskId, callbackUrl, payload) {
  if (!callbackUrl) return;

  const webhookPayload = {
    task_id: taskId,
    status: payload.status,
    result: payload.result || null,
    error_message: payload.error_message || null,
    duration: payload.duration || null,
    timestamp: new Date().toISOString()
  };

  enqueueRetry({
    taskId,
    callbackUrl,
    payload: webhookPayload,
    attempt: 0,
    maxAttempts: MAX_RETRIES
  });
}

function enqueueRetry(webhookItem) {
  retryQueue.push(webhookItem);
  if (!processing) {
    setImmediate(processRetryQueue);
  }
}

function processRetryQueue() {
  if (retryQueue.length === 0) {
    processing = false;
    return;
  }

  processing = true;
  const item = retryQueue.shift();

  if (item.scheduledAt && Date.now() < item.scheduledAt) {
    retryQueue.push(item);
    setTimeout(() => setImmediate(processRetryQueue), 100);
    return;
  }

  executeWebhook(item).then(success => {
    if (!success) {
      item.attempt++;
      if (item.attempt < item.maxAttempts) {
        const backoffMs = Math.min(
          Math.pow(BACKOFF_BASE, item.attempt) * 1000,
          MAX_BACKOFF_MS
        );
        item.scheduledAt = Date.now() + backoffMs;
        console.log(`[webhook] Retry ${item.attempt}/${item.maxAttempts} for task ${item.taskId} in ${backoffMs}ms`);
        retryQueue.push(item);
      } else {
        console.error(`[webhook] All ${item.maxAttempts} attempts failed for task ${item.taskId}, recording failure`);
        db.recordWebhookFailure(
          item.taskId,
          item.callbackUrl,
          item.payload,
          `Failed after ${item.maxAttempts} attempts`,
          item.attempt
        );
      }
    }
    setImmediate(processRetryQueue);
  });
}

function executeWebhook(item) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(item.payload);
    const url = new URL(item.callbackUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'TaskQueue-Webhook/1.0'
      },
      timeout: 10000
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[webhook] Successfully notified ${item.callbackUrl} for task ${item.taskId}`);
          resolve(true);
        } else {
          console.warn(`[webhook] Non-2xx response ${res.statusCode} from ${item.callbackUrl} for task ${item.taskId}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.warn(`[webhook] Error sending to ${item.callbackUrl} for task ${item.taskId}: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn(`[webhook] Timeout sending to ${item.callbackUrl} for task ${item.taskId}`);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

function notifyTaskComplete(task) {
  if (!task.callback_url) return;

  const duration = task.started_at && task.completed_at
    ? (new Date(task.completed_at) - new Date(task.started_at)) / 1000
    : null;

  sendWebhook(task.id, task.callback_url, {
    status: task.status,
    result: task.payload,
    error_message: task.error_message,
    duration
  });
}

module.exports = {
  sendWebhook,
  notifyTaskComplete,
  processRetryQueue
};
