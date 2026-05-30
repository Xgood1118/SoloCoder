import { StorageAdapter, AggregatedData, Labels, AggregationFunction } from '../types';
import { labelsToKey, now } from '../utils';

export interface ClickHouseOptions {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  database: string;
  table?: string;
  protocol?: 'http' | 'https';
  timeout?: number;
}

export class ClickHouseAdapter implements StorageAdapter {
  readonly name: string = 'clickhouse';
  private options: ClickHouseOptions;
  private client: unknown;
  private connected: boolean = false;

  constructor(options: ClickHouseOptions) {
    this.options = {
      port: 8123,
      table: 'metrics',
      protocol: 'http',
      timeout: 10000,
      ...options,
    };
  }

  async connect(): Promise<void> {
    try {
      const { ClickHouse } = require('@clickhouse/client');
      this.client = new ClickHouse({
        host: this.options.host,
        port: this.options.port,
        username: this.options.username || 'default',
        password: this.options.password || '',
        database: this.options.database,
        protocol: this.options.protocol,
        request_timeout: this.options.timeout,
      });

      await (this.client as any).exec({
        query: `
          CREATE TABLE IF NOT EXISTS ${this.options.table} (
            timestamp DateTime64(9),
            metricName String,
            labels Map(String, String),
            function Enum8('Sum' = 0, 'Avg' = 1, 'Min' = 2, 'Max' = 3, 'Count' = 4, 'Percentile' = 5),
            value Float64,
            windowStart DateTime64(9),
            windowEnd DateTime64(9)
          ) ENGINE = MergeTree()
          PARTITION BY toDate(timestamp)
          ORDER BY (metricName, timestamp, labels)
          TTL toDateTime(timestamp) + INTERVAL 90 DAY
        `,
      });

      this.connected = true;
    } catch (e) {
      throw new Error(
        'Failed to connect to ClickHouse. Make sure @clickhouse/client is installed: npm install @clickhouse/client',
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await (this.client as any).close();
    }
    this.connected = false;
  }

  async write(data: AggregatedData[]): Promise<void> {
    if (!this.connected || !this.client) {
      throw new Error('ClickHouse not connected');
    }

    const rows = data.map((point) => ({
      timestamp: new Date(point.timestamp),
      metricName: point.metricName,
      labels: point.labels,
      function: point.function,
      value: point.value,
      windowStart: new Date(point.windowStart),
      windowEnd: new Date(point.windowEnd),
    }));

    await (this.client as any).insert({
      table: this.options.table,
      values: rows,
      format: 'JSONEachRow',
    });
  }

  async query(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Labels,
    aggregation?: AggregationFunction,
  ): Promise<AggregatedData[]> {
    if (!this.connected || !this.client) {
      throw new Error('ClickHouse not connected');
    }

    let query = `
      SELECT timestamp, metricName, labels, function, value, windowStart, windowEnd
      FROM ${this.options.table}
      WHERE metricName = '${metricName}'
        AND timestamp >= '${new Date(startTime).toISOString()}'
        AND timestamp <= '${new Date(endTime).toISOString()}'
    `;

    if (aggregation !== undefined) {
      query += ` AND function = '${aggregation}'`;
    }

    if (labels && Object.keys(labels).length > 0) {
      for (const [key, value] of Object.entries(labels)) {
        query += ` AND labels['${key}'] = '${String(value)}'`;
      }
    }

    query += ' ORDER BY timestamp';

    const result = await (this.client as any).query({ query, format: 'JSONEachRow' });
    const rows = await result.json();

    return rows.map((row: any) => ({
      metricName: row.metricName,
      labels: row.labels,
      function: row.function as AggregationFunction,
      value: row.value,
      timestamp: new Date(row.timestamp).getTime(),
      windowStart: new Date(row.windowStart).getTime(),
      windowEnd: new Date(row.windowEnd).getTime(),
    }));
  }

  async deleteOldData(retentionDays: number): Promise<void> {
    if (!this.connected || !this.client) {
      throw new Error('ClickHouse not connected');
    }

    const cutoff = now() - retentionDays * 24 * 60 * 60 * 1000;
    await (this.client as any).exec({
      query: `
        DELETE FROM ${this.options.table}
        WHERE timestamp < '${new Date(cutoff).toISOString()}'
      `,
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}
