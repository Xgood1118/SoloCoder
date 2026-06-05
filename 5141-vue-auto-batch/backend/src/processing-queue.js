const path = require('path');
const EventEmitter = require('events');
const { db } = require('./database');
const { matchFile } = require('./rule-engine');
const { processFileWorker } = require('./file-processor');

class ProcessingQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.processing = null;
    this.isPaused = false;
    this.currentProgress = 0;
    this.currentFile = null;
    this.currentStartTime = null;
    this.maxQueueSize = 100;
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const settings = await db.all('SELECT key, value FROM app_settings');
      for (const s of settings) {
        if (s.key === 'queue_max_size') {
          this.maxQueueSize = parseInt(s.value, 10);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async addFile(filePath, fileStats) {
    const fileName = path.basename(filePath);

    if (this.queue.find((f) => f.filePath === filePath)) {
      return { success: false, reason: 'Already in queue' };
    }

    if (this.queue.length >= this.maxQueueSize) {
      return { success: false, reason: 'Queue is full' };
    }

    const matchResult = await matchFile(filePath, fileStats);
    if (!matchResult.matched) {
      this.emit('record', {
        file_path: filePath,
        file_name: fileName,
        file_size: fileStats.size,
        result: 'skipped',
        reason: 'No matching rule',
        duration_ms: 0,
        rule_name: null,
        retry_count: 0,
        md5: null,
      });
      return { success: false, reason: 'No matching rule' };
    }

    const queueItem = {
      filePath,
      fileName,
      fileSize: fileStats.size,
      fileStats,
      ruleName: matchResult.ruleName,
      retryCount: 0,
      addedAt: Date.now(),
    };

    this.queue.push(queueItem);
    this.emit('queueUpdate', this.getQueueInfo());

    setImmediate(() => this.processNext());

    return { success: true };
  }

  getQueueInfo() {
    return {
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      isPaused: this.isPaused,
      currentFile: this.currentFile,
      currentProgress: this.currentProgress,
      currentElapsed: this.currentStartTime ? Date.now() - this.currentStartTime : 0,
      queuedFiles: this.queue.map((f) => ({
        fileName: f.fileName,
        filePath: f.filePath,
        fileSize: f.fileSize,
        ruleName: f.ruleName,
        retryCount: f.retryCount,
      })),
    };
  }

  pause() {
    this.isPaused = true;
    this.emit('queueUpdate', this.getQueueInfo());
  }

  resume() {
    this.isPaused = false;
    this.emit('queueUpdate', this.getQueueInfo());
    setImmediate(() => this.processNext());
  }

  async processNext() {
    if (this.isPaused || this.processing || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    this.processing = item;
    this.currentFile = item.fileName;
    this.currentStartTime = Date.now();
    this.currentProgress = 0;

    this.emit('queueUpdate', this.getQueueInfo());
    this.emit('processingStart', item);

    try {
      this.currentProgress = 30;
      this.emit('queueUpdate', this.getQueueInfo());

      const result = await processFileWorker(item.filePath, item.fileStats);

      this.currentProgress = 90;
      this.emit('queueUpdate', this.getQueueInfo());

      const record = {
        file_path: item.filePath,
        file_name: item.fileName,
        file_size: item.fileSize,
        result: result.result,
        reason: result.reason,
        duration_ms: result.duration,
        rule_name: item.ruleName,
        retry_count: item.retryCount,
        md5: result.md5,
      };

      if (result.result === 'failed') {
        const maxRetriesRow = await db.get('SELECT value FROM app_settings WHERE key = ?', 'max_retries');
        const retryIntervalRow = await db.get('SELECT value FROM app_settings WHERE key = ?', 'retry_interval');
        const maxRetries = parseInt(maxRetriesRow.value, 10);
        const retryInterval = parseInt(retryIntervalRow.value, 10);

        if (item.retryCount < maxRetries) {
          item.retryCount++;
          const nextRetryAt = new Date(Date.now() + retryInterval * 1000).toISOString();

          await db.run(`
            INSERT OR REPLACE INTO retry_queue 
            (file_path, file_name, file_size, rule_name, retry_remaining, next_retry_at, last_error)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
            item.filePath,
            item.fileName,
            item.fileSize,
            item.ruleName,
            maxRetries - item.retryCount,
            nextRetryAt,
            result.reason
          );

          record.retry_count = item.retryCount;
          record.result = 'retrying';
        }
      }

      this.emit('record', record);

      this.currentProgress = 100;
      this.emit('queueUpdate', this.getQueueInfo());
      this.emit('processingComplete', { item, result });
    } catch (err) {
      const record = {
        file_path: item.filePath,
        file_name: item.fileName,
        file_size: item.fileSize,
        result: 'failed',
        reason: `Processing error: ${err.message}`,
        duration_ms: Date.now() - this.currentStartTime,
        rule_name: item.ruleName,
        retry_count: item.retryCount,
        md5: null,
      };
      this.emit('record', record);
      this.emit('processingError', { item, error: err });
    } finally {
      this.processing = null;
      this.currentFile = null;
      this.currentStartTime = null;
      this.currentProgress = 0;
      this.emit('queueUpdate', this.getQueueInfo());
      setImmediate(() => this.processNext());
    }
  }

  async checkRetryQueue() {
    const now = new Date().toISOString();
    const items = await db.all(
      'SELECT * FROM retry_queue WHERE next_retry_at <= ? ORDER BY next_retry_at ASC',
      now
    );

    for (const item of items) {
      const fs = require('fs');
      try {
        const fileStats = fs.statSync(item.file_path);
        const maxRetriesRow = await db.get('SELECT value FROM app_settings WHERE key = ?', 'max_retries');
        const maxRetries = parseInt(maxRetriesRow.value, 10);
        const queueItem = {
          filePath: item.file_path,
          fileName: item.file_name,
          fileSize: item.file_size,
          fileStats,
          ruleName: item.rule_name,
          retryCount: maxRetries - item.retry_remaining,
          addedAt: Date.now(),
        };

        this.queue.push(queueItem);
        await db.run('DELETE FROM retry_queue WHERE id = ?', item.id);
      } catch (err) {
        await db.run(`
          INSERT INTO processing_records 
          (file_path, file_name, file_size, result, reason, duration_ms, rule_name, retry_count)
          VALUES (?, ?, ?, 'failed', ?, 0, ?, ?)
        `,
          item.file_path,
          item.file_name,
          item.file_size,
          `File no longer exists: ${err.message}`,
          item.rule_name,
          item.retry_remaining
        );
        await db.run('DELETE FROM retry_queue WHERE id = ?', item.id);
      }
    }

    if (items.length > 0) {
      this.emit('queueUpdate', this.getQueueInfo());
      setImmediate(() => this.processNext());
    }
  }
}

const processingQueue = new ProcessingQueue();
setInterval(() => processingQueue.checkRetryQueue(), 5000);

module.exports = { processingQueue };
