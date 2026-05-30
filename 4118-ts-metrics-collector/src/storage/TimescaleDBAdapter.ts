import { StorageAdapter, AggregatedData, Labels, AggregationFunction } from '../types';
import { labelsToKey, now } from '../utils';

export interface TimescaleDBOptions {
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  table?: string;
  ssl?: boolean;
  timeout?: number;
}

export class TimescaleDBAdapter implements StorageAdapter {
  readonly name: string = 'timescaledb';
  private options: TimescaleDBOptions;
  private pool: unknown;
  private connected: boolean = false;

  constructor(options: TimescaleDBOptions) {
    this.options = {
      port: 5432,
      table: 'metrics',
      ssl: false,
      timeout: 10000,
      ...options,
    };
  }

  async connect(): Promise<void> {
    try {
      const { Pool } = require('pg');
      this.pool = new Pool({
        host: this.options.host,
        port: this.options.port,
        user: this.options.user,
        password: this.options.password,
        database: this.options.database,
        ssl: this.options.ssl,
        connectionTimeoutMillis: this.options.timeout,
      });

      const client = await (this.pool as any).connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${this.options.table} (
            timestamp TIMESTAMPTZ NOT NULL,
            metricName TEXT NOT NULL,
            labels JSONB NOT NULL DEFAULT '{}',
            function TEXT NOT NULL,
            value DOUBLE PRECISION NOT NULL,
            windowStart TIMESTAMPTZ NOT NULL,
            windowEnd TIMESTAMPTZ NOT NULL
          )
        `);

        await client.query(`
          SELECT create_hypertable('${this.options.table}', 'timestamp', if_not_exists => TRUE)
        `);

        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON ${this.options.table} (metricName, timestamp DESC)
        `);
      } finally {
        client.release();
      }

      this.connected = true;
    } catch (e) {
      throw new Error(
        'Failed to connect to TimescaleDB. Make sure pg is installed: npm install pg',
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await (this.pool as any).end();
    }
    this.connected = false;
  }

  async write(data: AggregatedData[]): Promise<void> {
    if (!this.connected || !this.pool) {
      throw new Error('TimescaleDB not connected');
    }

    const client = await (this.pool as any).connect();
    try {
      await client.query('BEGIN');

      for (const point of data) {
        await client.query(
          `
          INSERT INTO ${this.options.table}
            (timestamp, metricName, labels, function, value, windowStart, windowEnd)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [
            new Date(point.timestamp),
            point.metricName,
            JSON.stringify(point.labels),
            point.function,
            point.value,
            new Date(point.windowStart),
            new Date(point.windowEnd),
          ],
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async query(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Labels,
    aggregation?: AggregationFunction,
  ): Promise<AggregatedData[]> {
    if (!this.connected || !this.pool) {
      throw new Error('TimescaleDB not connected');
    }

    let query = `
      SELECT timestamp, metricName, labels, function, value, windowStart, windowEnd
      FROM ${this.options.table}
      WHERE metricName = $1
        AND timestamp >= $2
        AND timestamp <= $3
    `;
    const params: unknown[] = [metricName, new Date(startTime), new Date(endTime)];
    let paramIndex = 4;

    if (aggregation !== undefined) {
      query += ` AND function = $${paramIndex}`;
      params.push(aggregation);
      paramIndex++;
    }

    if (labels && Object.keys(labels).length > 0) {
      for (const [key, value] of Object.entries(labels)) {
        query += ` AND labels ->> $${paramIndex} = $${paramIndex + 1}`;
        params.push(key, String(value));
        paramIndex += 2;
      }
    }

    query += ' ORDER BY timestamp';

    const client = await (this.pool as any).connect();
    try {
      const result = await client.query(query, params);

      return result.rows.map((row: any) => ({
        metricName: row.metricname,
        labels: row.labels,
        function: row.function as AggregationFunction,
        value: row.value,
        timestamp: row.timestamp.getTime(),
        windowStart: row.windowstart.getTime(),
        windowEnd: row.windowend.getTime(),
      }));
    } finally {
      client.release();
    }
  }

  async deleteOldData(retentionDays: number): Promise<void> {
    if (!this.connected || !this.pool) {
      throw new Error('TimescaleDB not connected');
    }

    const cutoff = now() - retentionDays * 24 * 60 * 60 * 1000;
    const client = await (this.pool as any).connect();
    try {
      await client.query(
        `DELETE FROM ${this.options.table} WHERE timestamp < $1`,
        [new Date(cutoff)],
      );

      await client.query(
        `SELECT drop_chunks(INTERVAL '${retentionDays} days', '${this.options.table}')`,
      );
    } finally {
      client.release();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
