const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { db } = require('./database');
const { processingQueue } = require('./processing-queue');

class DirectoryWatcher {
  constructor() {
    this.watchers = new Map();
    this.debounceTimers = new Map();
    this.init();
  }

  init() {
    processingQueue.on('record', (record) => {
      this.saveRecord(record);
    });

    this.loadDirectories();
  }

  async saveRecord(record) {
    try {
      await db.run(`
        INSERT INTO processing_records
        (file_path, file_name, file_size, result, reason, duration_ms, rule_name, retry_count, md5)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        record.file_path,
        record.file_name,
        record.file_size,
        record.result,
        record.reason,
        record.duration_ms,
        record.rule_name,
        record.retry_count,
        record.md5
      );
    } catch (err) {
      console.error('Failed to save record:', err);
    }
  }

  async loadDirectories() {
    try {
      const dirs = await db.all('SELECT * FROM directories');
      for (const dir of dirs) {
        this.watchDirectory(dir);
      }
    } catch (err) {
      console.error('Failed to load directories:', err);
    }
  }

  async addDirectory(dirPath) {
    const existing = await db.get('SELECT * FROM directories WHERE path = ?', dirPath);
    if (existing) {
      return { success: false, error: 'Directory already exists' };
    }

    let status = 'active';
    let error = null;

    try {
      await fs.promises.access(dirPath, fs.constants.R_OK);
      const stats = await fs.promises.stat(dirPath);
      if (!stats.isDirectory()) {
        status = 'error';
        error = 'Path is not a directory';
      }
    } catch (err) {
      status = 'error';
      error = err.code === 'ENOENT' ? 'Directory does not exist' : `Permission denied: ${err.message}`;
    }

    const result = await db.run(
      'INSERT INTO directories (path, status, error) VALUES (?, ?, ?)',
      dirPath, status, error
    );

    const dir = { id: result.lastID, path: dirPath, status, error };
    if (status === 'active') {
      this.watchDirectory(dir);
    }

    return { success: true, dir };
  }

  async removeDirectory(id) {
    const dir = await db.get('SELECT * FROM directories WHERE id = ?', id);
    if (!dir) {
      return { success: false, error: 'Directory not found' };
    }

    if (this.watchers.has(dir.path)) {
      this.watchers.get(dir.path).close();
      this.watchers.delete(dir.path);
    }

    await db.run('DELETE FROM directories WHERE id = ?', id);
    return { success: true };
  }

  watchDirectory(dir) {
    if (this.watchers.has(dir.path)) {
      return;
    }

    const watcher = chokidar.watch(dir.path, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500,
      },
    });

    watcher.on('all', (event, filePath) => {
      if (event === 'add' || event === 'change' || event === 'addDir') {
        if (event !== 'addDir') {
          this.debounceFileEvent(filePath);
        }
      }
    });

    watcher.on('error', (error) => {
      db.run('UPDATE directories SET status = ?, error = ? WHERE path = ?',
        'error',
        error.message,
        dir.path
      );
    });

    this.watchers.set(dir.path, watcher);

    fs.stat(dir.path, (err) => {
      if (err) {
        db.run('UPDATE directories SET status = ?, error = ? WHERE path = ?',
          'error',
          err.code === 'ENOENT' ? 'Directory does not exist' : `Permission denied: ${err.message}`,
          dir.path
        );
      }
    });
  }

  debounceFileEvent(filePath) {
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.processFile(filePath);
      this.debounceTimers.delete(filePath);
    }, 1000);

    this.debounceTimers.set(filePath, timer);
  }

  async processFile(filePath) {
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isFile()) {
        await processingQueue.addFile(filePath, stats);
      }
    } catch (err) {
      console.error(`Failed to process file ${filePath}:`, err.message);
    }
  }

  async getDirectories() {
    return await db.all('SELECT * FROM directories');
  }

  scanExistingFiles(dirPath) {
    const watcher = this.watchers.get(dirPath);
    if (!watcher) {
      return { success: false, error: 'Directory not being watched' };
    }

    fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
      if (err) return;
      for (const file of files) {
        if (file.isFile()) {
          const fullPath = path.join(dirPath, file.name);
          this.debounceFileEvent(fullPath);
        }
      }
    });

    return { success: true };
  }
}

const directoryWatcher = new DirectoryWatcher();

module.exports = { directoryWatcher };
