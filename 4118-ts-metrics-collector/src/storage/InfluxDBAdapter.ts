import { StorageAdapter, AggregatedData, Labels, AggregationFunction } from '../types';
import { labelsToKey, now } from '../utils';

export interface InfluxDBOptions {
  url: string;
  token: string;
  org: string;
  bucket: string;
  measurement?: string;
}

export class InfluxDBAdapter implements StorageAdapter {
  readonly name: string = 'influxdb';
  private options: InfluxDBOptions;
  private client: unknown;
  private writeApi: unknown;
  private queryApi: unknown;
  private connected: boolean = false;

  constructor(options: InfluxDBOptions) {
    this.options = {
      measurement: 'metrics',
      ...options,
    };
  }

  async connect(): Promise<void> {
    try {
      const { InfluxDB } = require('@influxdata/influxdb-client');
      this.client = new InfluxDB({
        url: this.options.url,
        token: this.options.token,
      });
      this.writeApi = (this.client as any).getWriteApi(this.options.org, this.options.bucket);
      this.queryApi = (this.client as any).getQueryApi(this.options.org);
      this.connected = true;
    } catch (e) {
      throw new Error(
        'Failed to connect to InfluxDB. Make sure @influxdata/influxdb-client is installed: npm install @influxdata/influxdb-client',
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.writeApi) {
      await (this.writeApi as any).close();
    }
    this.connected = false;
  }

  async write(data: AggregatedData[]): Promise<void> {
    if (!this.connected || !this.writeApi) {
      throw new Error('InfluxDB not connected');
    }

    const { Point } = require('@influxdata/influxdb-client');
    const writeApi = this.writeApi as any;

    for (const point of data) {
      const influxPoint = new Point(this.options.measurement);

      for (const [key, value] of Object.entries(point.labels)) {
        influxPoint.tag(key, String(value));
      }

      influxPoint
        .floatField('value', point.value)
        .floatField('windowStart', point.windowStart)
        .floatField('windowEnd', point.windowEnd)
        .tag('function', point.function)
        .timestamp(new Date(point.timestamp));

      writeApi.writePoint(influxPoint);
    }

    await writeApi.flush();
  }

  async query(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Labels,
    aggregation?: AggregationFunction,
  ): Promise<AggregatedData[]> {
    if (!this.connected || !this.queryApi) {
      throw new Error('InfluxDB not connected');
    }

    const fluxQuery = this.buildQuery(metricName, startTime, endTime, labels, aggregation);
    const result = await (this.queryApi as any).collectRows(fluxQuery);

    return result.map((row: any) => ({
      metricName,
      labels: row.labels || {},
      function: (row.function as AggregationFunction) || AggregationFunction.Sum,
      value: row._value,
      timestamp: row._time ? new Date(row._time).getTime() : now(),
      windowStart: row.windowStart,
      windowEnd: row.windowEnd,
    }));
  }

  private buildQuery(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Labels,
    aggregation?: AggregationFunction,
  ): string {
    const start = new Date(startTime).toISOString();
    const stop = new Date(endTime).toISOString();

    let query = `
      from(bucket: "${this.options.bucket}")
        |> range(start: ${start}, stop: ${stop})
        |> filter(fn: (r) => r._measurement == "${this.options.measurement}" and r.metricName == "${metricName}")
    `;

    if (labels) {
      for (const [key, value] of Object.entries(labels)) {
        query += `|> filter(fn: (r) => r.${key} == "${value}")\n`;
      }
    }

    if (aggregation !== undefined) {
      const fnName = aggregation;
      query += `|> filter(fn: (r) => r.function == "${fnName}")\n`;
    }

    return query;
  }

  async deleteOldData(retentionDays: number): Promise<void> {
    if (!this.connected || !this.client) {
      throw new Error('InfluxDB not connected');
    }

    const cutoff = now() - retentionDays * 24 * 60 * 60 * 1000;
    const deleteApi = (this.client as any).getDeleteApi();
    await deleteApi.delete(
      new Date(cutoff),
      new Date(),
      `_measurement="${this.options.measurement}"`,
      this.options.org,
      this.options.bucket,
    );
  }

  isConnected(): boolean {
    return this.connected;
  }
}
