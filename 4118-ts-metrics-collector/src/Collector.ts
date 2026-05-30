import { CollectorTarget, CollectorConfig, Labels } from './types';
import { PrometheusExporter } from './Exporter';
import { Aggregator } from './Aggregator';
import { ExponentialBackoff, now } from './utils';
import axios, { AxiosError } from 'axios';

interface TargetState {
  target: CollectorTarget;
  timer?: NodeJS.Timeout;
  backoff: ExponentialBackoff;
  lastSuccess?: number;
  lastError?: string;
  consecutiveErrors: number;
  enabled: boolean;
}

export interface CollectorOptions {
  aggregator?: Aggregator;
  exporter?: PrometheusExporter;
  defaultIntervalMs?: number;
  defaultTimeoutMs?: number;
  maxRetries?: number;
}

export interface CollectorStats {
  totalTargets: number;
  activeTargets: number;
  successfulScrapes: number;
  failedScrapes: number;
  lastScrapeTime?: number;
}

export class Collector {
  private targets: Map<string, TargetState>;
  private aggregator?: Aggregator;
  private exporter: PrometheusExporter;
  private defaultIntervalMs: number;
  private defaultTimeoutMs: number;
  private maxRetries: number;
  private successfulScrapes: number = 0;
  private failedScrapes: number = 0;
  private lastScrapeTime?: number;
  private onError?: (targetId: string, error: Error) => void;
  private onSuccess?: (targetId: string, metricsCount: number) => void;

  constructor(options: CollectorOptions = {}) {
    this.targets = new Map();
    this.aggregator = options.aggregator;
    this.exporter = options.exporter || new PrometheusExporter();
    this.defaultIntervalMs = options.defaultIntervalMs || 60000;
    this.defaultTimeoutMs = options.defaultTimeoutMs || 10000;
    this.maxRetries = options.maxRetries || 3;
  }

  setErrorHandler(handler: (targetId: string, error: Error) => void): void {
    this.onError = handler;
  }

  setSuccessHandler(handler: (targetId: string, metricsCount: number) => void): void {
    this.onSuccess = handler;
  }

  loadConfig(config: CollectorConfig): void {
    if (config.defaultIntervalMs) {
      this.defaultIntervalMs = config.defaultIntervalMs;
    }
    if (config.defaultTimeoutMs) {
      this.defaultTimeoutMs = config.defaultTimeoutMs;
    }

    for (const target of config.targets) {
      this.addTarget(target);
    }
  }

  addTarget(target: CollectorTarget): void {
    if (this.targets.has(target.id)) {
      this.removeTarget(target.id);
    }

    const state: TargetState = {
      target: {
        ...target,
        intervalMs: target.intervalMs || this.defaultIntervalMs,
        timeoutMs: target.timeoutMs || this.defaultTimeoutMs,
        enabled: target.enabled !== false,
      },
      backoff: new ExponentialBackoff(1000, 60000, 2),
      consecutiveErrors: 0,
      enabled: target.enabled !== false,
    };

    this.targets.set(target.id, state);

    if (state.enabled) {
      this.startTarget(target.id);
    }
  }

  removeTarget(targetId: string): void {
    const state = this.targets.get(targetId);
    if (state) {
      if (state.timer) {
        clearInterval(state.timer);
      }
      this.targets.delete(targetId);
    }
  }

  enableTarget(targetId: string): void {
    const state = this.targets.get(targetId);
    if (state) {
      state.enabled = true;
      state.target.enabled = true;
      this.startTarget(targetId);
    }
  }

  disableTarget(targetId: string): void {
    const state = this.targets.get(targetId);
    if (state) {
      state.enabled = false;
      state.target.enabled = false;
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = undefined;
      }
    }
  }

  private startTarget(targetId: string): void {
    const state = this.targets.get(targetId);
    if (!state || !state.enabled) return;

    if (state.timer) {
      clearInterval(state.timer);
    }

    this.scrape(targetId).catch((e) => console.error('Initial scrape error:', e));

    state.timer = setInterval(() => {
      this.scrape(targetId).catch((e) => console.error('Scrape error:', e));
    }, state.target.intervalMs);
  }

  async scrape(targetId: string): Promise<number> {
    const state = this.targets.get(targetId);
    if (!state) {
      throw new Error(`Target not found: ${targetId}`);
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const metricsCount = await this.scrapeOnce(state);
        state.lastSuccess = now();
        state.lastError = undefined;
        state.consecutiveErrors = 0;
        state.backoff.reset();
        this.successfulScrapes++;
        this.lastScrapeTime = now();

        if (this.onSuccess) {
          this.onSuccess(targetId, metricsCount);
        }

        return metricsCount;
      } catch (e) {
        lastError = e as Error;
        state.consecutiveErrors++;

        if (attempt < this.maxRetries - 1) {
          const delay = state.backoff.nextDelay();
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (lastError) {
      state.lastError = lastError.message;
      this.failedScrapes++;

      if (this.onError) {
        this.onError(targetId, lastError);
      }

      throw lastError;
    }

    return 0;
  }

  private async scrapeOnce(state: TargetState): Promise<number> {
    const url = state.target.url;
    const timeout = state.target.timeoutMs || this.defaultTimeoutMs;

    const response = await axios.get(url, {
      timeout,
      headers: {
        'Accept': this.exporter.contentType(),
      },
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const metrics = this.exporter.parse(response.data);

    if (this.aggregator) {
      for (const metric of metrics) {
        const labels: Labels = { ...metric.labels, ...state.target.labels };
        this.aggregator.observe(metric.name, metric.value, labels, metric.timestamp);
      }
    }

    return metrics.length;
  }

  async scrapeAll(): Promise<Map<string, number | Error>> {
    const results = new Map<string, number | Error>();

    for (const targetId of this.targets.keys()) {
      const state = this.targets.get(targetId);
      if (!state?.enabled) continue;

      try {
        const count = await this.scrape(targetId);
        results.set(targetId, count);
      } catch (e) {
        results.set(targetId, e as Error);
      }
    }

    return results;
  }

  start(): void {
    for (const targetId of this.targets.keys()) {
      const state = this.targets.get(targetId);
      if (state?.enabled) {
        this.startTarget(targetId);
      }
    }
  }

  stop(): void {
    for (const state of this.targets.values()) {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = undefined;
      }
    }
  }

  getTarget(targetId: string): CollectorTarget | undefined {
    return this.targets.get(targetId)?.target;
  }

  getAllTargets(): CollectorTarget[] {
    return Array.from(this.targets.values()).map((s) => s.target);
  }

  getTargetStatus(targetId: string): {
    target: CollectorTarget;
    lastSuccess?: number;
    lastError?: string;
    consecutiveErrors: number;
    enabled: boolean;
  } | undefined {
    const state = this.targets.get(targetId);
    if (!state) return undefined;

    return {
      target: state.target,
      lastSuccess: state.lastSuccess,
      lastError: state.lastError,
      consecutiveErrors: state.consecutiveErrors,
      enabled: state.enabled,
    };
  }

  getStats(): CollectorStats {
    return {
      totalTargets: this.targets.size,
      activeTargets: Array.from(this.targets.values()).filter((s) => s.enabled).length,
      successfulScrapes: this.successfulScrapes,
      failedScrapes: this.failedScrapes,
      lastScrapeTime: this.lastScrapeTime,
    };
  }
}
