import { StorageAdapter, AggregatedData, Labels, AggregationFunction } from '../types';
import axios from 'axios';
import { labelsToKey, now } from '../utils';

export interface PrometheusOptions {
  url: string;
  username?: string;
  password?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

interface PrometheusQueryResult {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      value: [number, string];
      values?: Array<[number, string]>;
    }>;
  };
}

export class PrometheusAdapter implements StorageAdapter {
  readonly name: string = 'prometheus';
  private options: PrometheusOptions;
  private connected: boolean = false;

  constructor(options: PrometheusOptions) {
    this.options = {
      timeout: 10000,
      ...options,
    };
  }

  async connect(): Promise<void> {
    try {
      const response = await axios.get(`${this.options.url}/-/healthy`, {
        timeout: this.options.timeout,
        auth: this.options.username
          ? { username: this.options.username, password: this.options.password || '' }
          : undefined,
        headers: this.options.headers,
      });
      if (response.status !== 200) {
        throw new Error(`Prometheus health check failed: ${response.status}`);
      }
      this.connected = true;
    } catch (e) {
      throw new Error(`Failed to connect to Prometheus: ${(e as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async write(data: AggregatedData[]): Promise<void> {
    if (!this.connected) {
      throw new Error('Prometheus not connected');
    }

    const metrics: string[] = [];
    const timestamp = Date.now();

    for (const point of data) {
      const labels = { ...point.labels, function: point.function };
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${String(v)}"`)
        .join(',');

      metrics.push(`${point.metricName}{${labelStr}} ${point.value} ${timestamp}`);
    }

    await axios.post(`${this.options.url}/api/v1/import/prometheus`, metrics.join('\n'), {
      timeout: this.options.timeout,
      auth: this.options.username
        ? { username: this.options.username, password: this.options.password || '' }
        : undefined,
      headers: { 'Content-Type': 'text/plain', ...this.options.headers },
    });
  }

  async query(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Labels,
    aggregation?: AggregationFunction,
  ): Promise<AggregatedData[]> {
    if (!this.connected) {
      throw new Error('Prometheus not connected');
    }

    const query = this.buildQuery(metricName, labels, aggregation);
    const start = startTime / 1000;
    const end = endTime / 1000;
    const step = Math.max(1, (end - start) / 100);

    try {
      const response = await axios.get<PrometheusQueryResult>(
        `${this.options.url}/api/v1/query_range`,
        {
          params: { query, start, end, step },
          timeout: this.options.timeout,
          auth: this.options.username
            ? { username: this.options.username, password: this.options.password || '' }
            : undefined,
          headers: this.options.headers,
        },
      );

      return this.parseQueryResult(response.data, metricName, aggregation);
    } catch (e) {
      throw new Error(`Prometheus query failed: ${(e as Error).message}`);
    }
  }

  private buildQuery(metricName: string, labels?: Labels, aggregation?: AggregationFunction): string {
    let labelStr = '';
    if (labels) {
      const labelParts = Object.entries(labels).map(([k, v]) => `${k}="${String(v)}"`);
      if (aggregation !== undefined) {
        labelParts.push(`function="${aggregation}"`);
      }
      labelStr = labelParts.join(',');
    } else if (aggregation !== undefined) {
      labelStr = `function="${aggregation}"`;
    }

    return `${metricName}{${labelStr}}`;
  }

  private parseQueryResult(
    result: PrometheusQueryResult,
    metricName: string,
    aggregation?: AggregationFunction,
  ): AggregatedData[] {
    const data: AggregatedData[] = [];

    if (result.status !== 'success' || !result.data?.result) {
      return data;
    }

    for (const item of result.data.result) {
      const labels = { ...item.metric };
      delete labels.__name__;
      const fnName = labels.function;
      delete labels.function;

      const fn = aggregation !== undefined
        ? aggregation
        : ((fnName as AggregationFunction) ?? AggregationFunction.Sum);

      if (item.values) {
        for (const [ts, valStr] of item.values) {
          data.push({
            metricName,
            labels,
            function: fn,
            value: parseFloat(valStr),
            timestamp: Math.floor(ts * 1000),
            windowStart: Math.floor(ts * 1000) - 60000,
            windowEnd: Math.floor(ts * 1000),
          });
        }
      } else if (item.value) {
        const [ts, valStr] = item.value;
        data.push({
          metricName,
          labels,
          function: fn,
          value: parseFloat(valStr),
          timestamp: Math.floor(ts * 1000),
          windowStart: Math.floor(ts * 1000) - 60000,
          windowEnd: Math.floor(ts * 1000),
        });
      }
    }

    return data;
  }

  async deleteOldData(retentionDays: number): Promise<void> {
    if (!this.connected) {
      throw new Error('Prometheus not connected');
    }

    const cutoff = now() - retentionDays * 24 * 60 * 60 * 1000;
    await axios.post(
      `${this.options.url}/api/v1/admin/tsdb/delete_series`,
      {
        match: ['{__name__!=""}'],
        start: '1970-01-01T00:00:00Z',
        end: new Date(cutoff).toISOString(),
      },
      {
        timeout: this.options.timeout,
        auth: this.options.username
          ? { username: this.options.username, password: this.options.password || '' }
          : undefined,
        headers: this.options.headers,
      },
    );

    await axios.post(
      `${this.options.url}/api/v1/admin/tsdb/clean_tombstones`,
      {},
      {
        timeout: this.options.timeout,
        auth: this.options.username
          ? { username: this.options.username, password: this.options.password || '' }
          : undefined,
        headers: this.options.headers,
      },
    );
  }

  isConnected(): boolean {
    return this.connected;
  }
}
