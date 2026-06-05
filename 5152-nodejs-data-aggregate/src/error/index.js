const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

class ErrorTracker {
  constructor(options = {}) {
    this.consecutiveFailureThreshold = options.consecutiveFailureThreshold || 5;
    this.logger = options.logger || null;
    this.datasourceModel = null;
    this.trackingData = new Map();
  }

  setDatasourceModel(model) {
    this.datasourceModel = model;
  }

  _ensureEntry(datasourceId) {
    if (!this.trackingData.has(datasourceId)) {
      this.trackingData.set(datasourceId, {
        errors: [],
        consecutiveFailures: 0,
        lastAlertTime: null,
      });
    }
    return this.trackingData.get(datasourceId);
  }

  recordError(datasourceId, error) {
    const entry = this._ensureEntry(datasourceId);

    entry.errors.push({
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack || null,
    });

    entry.consecutiveFailures += 1;

    if (this.datasourceModel && typeof this.datasourceModel.incrementFailure === 'function') {
      this.datasourceModel.incrementFailure(datasourceId);
    }

    if (this.shouldAlert(datasourceId)) {
      const now = Date.now();
      const lastAlert = entry.lastAlertTime ? entry.lastAlertTime.getTime() : 0;
      if (now - lastAlert >= ALERT_COOLDOWN_MS) {
        this.triggerAlert(datasourceId);
      }
    }
  }

  recordSuccess(datasourceId) {
    const entry = this._ensureEntry(datasourceId);
    entry.consecutiveFailures = 0;

    if (this.datasourceModel && typeof this.datasourceModel.incrementSuccess === 'function') {
      this.datasourceModel.incrementSuccess(datasourceId);
    }
  }

  getErrors(datasourceId, limit = 50) {
    const entry = this.trackingData.get(datasourceId);
    if (!entry) return [];
    return entry.errors.slice(-limit);
  }

  getConsecutiveFailures(datasourceId) {
    const entry = this.trackingData.get(datasourceId);
    if (!entry) return 0;
    return entry.consecutiveFailures;
  }

  shouldAlert(datasourceId) {
    const entry = this.trackingData.get(datasourceId);
    if (!entry) return false;
    return entry.consecutiveFailures >= this.consecutiveFailureThreshold;
  }

  triggerAlert(datasourceId) {
    const entry = this.trackingData.get(datasourceId);
    if (!entry) return;

    entry.lastAlertTime = new Date();

    if (this.logger) {
      this.logger.error(
        `CRITICAL ALERT: Datasource ${datasourceId} has reached ${entry.consecutiveFailures} consecutive failures (threshold: ${this.consecutiveFailureThreshold})`
      );
    }
  }

  getStats(datasourceId) {
    const entry = this.trackingData.get(datasourceId);
    if (!entry) {
      return { consecutiveFailures: 0, totalErrors: 0, lastError: null };
    }
    const lastError = entry.errors.length > 0 ? entry.errors[entry.errors.length - 1] : null;
    return {
      consecutiveFailures: entry.consecutiveFailures,
      totalErrors: entry.errors.length,
      lastError,
    };
  }
}

function createErrorTracker(options = {}) {
  return new ErrorTracker(options);
}

module.exports = { createErrorTracker, ErrorTracker };
