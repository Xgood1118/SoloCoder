class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

class ConcurrencyController {
  constructor(options = {}) {
    this.globalMaxConcurrent = options.globalMaxConcurrent || 20;
    this.defaultDatasourceMaxConcurrent = options.defaultDatasourceMaxConcurrent || 5;
    this.queryTimeoutMs = options.queryTimeoutMs || 30000;

    this.globalActiveCount = 0;
    this.datasourceActiveCount = new Map();
    this.datasourceMaxConcurrent = new Map();
    this.queue = [];
  }

  setDatasourceMaxConcurrent(datasourceId, max) {
    this.datasourceMaxConcurrent.set(datasourceId, max);
  }

  _getDatasourceMax(datasourceId) {
    if (this.datasourceMaxConcurrent.has(datasourceId)) {
      return this.datasourceMaxConcurrent.get(datasourceId);
    }
    return this.defaultDatasourceMaxConcurrent;
  }

  _getDatasourceActive(datasourceId) {
    return this.datasourceActiveCount.get(datasourceId) || 0;
  }

  acquire(datasourceId) {
    return new Promise((resolve, reject) => {
      const datasourceMax = this._getDatasourceMax(datasourceId);
      const datasourceActive = this._getDatasourceActive(datasourceId);

      if (this.globalActiveCount < this.globalMaxConcurrent && datasourceActive < datasourceMax) {
        this.globalActiveCount += 1;
        this.datasourceActiveCount.set(datasourceId, datasourceActive + 1);
        resolve(this._createRelease(datasourceId));
        return;
      }

      const timeoutTimer = setTimeout(() => {
        const idx = this.queue.findIndex((item) => item.timeoutTimer === timeoutTimer);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
        }
        reject(new TimeoutError(`Query timed out after ${this.queryTimeoutMs}ms waiting for concurrency slot`));
      }, this.queryTimeoutMs);

      this.queue.push({ resolve, reject, datasourceId, timeoutTimer });
    });
  }

  _createRelease(datasourceId) {
    let released = false;
    return () => {
      if (released) return;
      released = true;

      this.globalActiveCount -= 1;
      const active = this._getDatasourceActive(datasourceId) - 1;
      this.datasourceActiveCount.set(datasourceId, Math.max(0, active));

      this._processQueue();
    };
  }

  _processQueue() {
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      const datasourceMax = this._getDatasourceMax(item.datasourceId);
      const datasourceActive = this._getDatasourceActive(item.datasourceId);

      if (this.globalActiveCount < this.globalMaxConcurrent && datasourceActive < datasourceMax) {
        this.queue.splice(i, 1);
        clearTimeout(item.timeoutTimer);

        this.globalActiveCount += 1;
        this.datasourceActiveCount.set(item.datasourceId, datasourceActive + 1);
        item.resolve(this._createRelease(item.datasourceId));

        i -= 1;
      }
    }
  }

  getStats() {
    const perDatasource = {};
    for (const [id, max] of this.datasourceMaxConcurrent) {
      perDatasource[id] = {
        active: this.datasourceActiveCount.get(id) || 0,
        max,
      };
    }
    return {
      globalActive: this.globalActiveCount,
      globalMax: this.globalMaxConcurrent,
      perDatasource,
    };
  }
}

function createConcurrencyController(options) {
  return new ConcurrencyController(options);
}

module.exports = { createConcurrencyController, ConcurrencyController, TimeoutError };
