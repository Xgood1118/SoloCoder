import axios from 'axios';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import config from '../config/env';
import { MetricValue, MetricLabels, DataSourceStatus } from '../types/metrics';

const MAX_CONSECUTIVE_FAILURES = 3;

export interface BusinessMetricResponse {
  qps?: number;
  requestLatency?: number;
  errorRate?: number;
  custom?: {
    [key: string]: number;
  };
}

export class BusinessMetricsCollector {
  private logger: ModuleLogger;
  private cache: MetricValue[] = [];
  private status: DataSourceStatus;
  private labels: MetricLabels;
  private apiUrl: string;
  private timeout: number;

  constructor() {
    this.logger = createModuleLogger('BusinessCollector');
    this.status = {
      name: 'business',
      available: true,
      consecutiveFailures: 0,
      lastSuccess: null,
      lastFailure: null,
    };
    this.labels = {
      instance: config.instanceId,
      service: config.serviceName,
      env: config.env,
    };
    this.apiUrl = config.businessMetricsApi;
    this.timeout = config.businessMetricsTimeout;
  }

  async collect(): Promise<{ metrics: MetricValue[]; success: boolean }> {
    try {
      const response = await this.fetchBusinessMetrics();
      const metrics = this.transformToMetricValues(response);
      this.cache = metrics;
      this.status.consecutiveFailures = 0;
      this.status.available = true;
      this.status.lastSuccess = Date.now();

      this.logger.debug('业务指标采集成功', {
        metricCount: metrics.length,
      });

      return { metrics, success: true };
    } catch (error) {
      this.status.consecutiveFailures++;
      this.status.lastFailure = Date.now();

      if (this.status.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.status.available = false;
        this.logger.error('业务指标数据源不可用', {
          consecutiveFailures: this.status.consecutiveFailures,
          apiUrl: this.apiUrl,
        });
      } else {
        this.logger.warn('业务指标采集失败，使用缓存值', {
          error: (error as Error).message,
          consecutiveFailures: this.status.consecutiveFailures,
        });
      }

      if (this.cache.length > 0) {
        return { metrics: this.cache, success: false };
      }

      return { metrics: [], success: false };
    }
  }

  private async fetchBusinessMetrics(): Promise<BusinessMetricResponse> {
    const response = await axios.get<BusinessMetricResponse>(this.apiUrl, {
      timeout: this.timeout,
      headers: {
        'Accept': 'application/json',
      },
    });

    return response.data;
  }

  private transformToMetricValues(response: BusinessMetricResponse): MetricValue[] {
    const timestamp = Date.now();
    const values: MetricValue[] = [];
    const endpointLabels = { ...this.labels, endpoint: 'default' };

    if (response.qps !== undefined) {
      values.push({
        name: 'qps',
        value: response.qps,
        timestamp,
        labels: endpointLabels,
      });
    }

    if (response.requestLatency !== undefined) {
      values.push({
        name: 'request_latency_ms',
        value: response.requestLatency,
        timestamp,
        labels: endpointLabels,
      });
    }

    if (response.errorRate !== undefined) {
      values.push({
        name: 'error_rate_percent',
        value: response.errorRate,
        timestamp,
        labels: endpointLabels,
      });
    }

    if (response.custom) {
      Object.entries(response.custom).forEach(([key, value]) => {
        values.push({
          name: `custom_${key}`,
          value,
          timestamp,
          labels: { ...this.labels },
        });
      });
    }

    return values;
  }

  getStatus(): DataSourceStatus {
    return { ...this.status };
  }

  isAvailable(): boolean {
    return this.status.available;
  }

  setApiUrl(url: string): void {
    this.apiUrl = url;
  }
}
