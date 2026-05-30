import { StorageAdapter } from '../types';
import { MemoryStorage } from './MemoryStorage';
import { InfluxDBAdapter, InfluxDBOptions } from './InfluxDBAdapter';
import { PrometheusAdapter, PrometheusOptions } from './PrometheusAdapter';
import { ClickHouseAdapter, ClickHouseOptions } from './ClickHouseAdapter';
import { TimescaleDBAdapter, TimescaleDBOptions } from './TimescaleDBAdapter';

export type StorageType = 'memory' | 'influxdb' | 'prometheus' | 'clickhouse' | 'timescaledb';

export interface StorageConfig {
  type: StorageType;
  options?: Record<string, unknown>;
}

export class StorageAdapterFactory {
  static create(config: StorageConfig): StorageAdapter {
    switch (config.type) {
      case 'memory':
        return new MemoryStorage();
      case 'influxdb':
        return this.createInfluxDBAdapter(config.options as unknown as InfluxDBOptions);
      case 'prometheus':
        return this.createPrometheusAdapter(config.options as unknown as PrometheusOptions);
      case 'clickhouse':
        return this.createClickHouseAdapter(config.options as unknown as ClickHouseOptions);
      case 'timescaledb':
        return this.createTimescaleDBAdapter(config.options as unknown as TimescaleDBOptions);
      default:
        throw new Error(`Unsupported storage type: ${config.type}`);
    }
  }

  private static createInfluxDBAdapter(options: InfluxDBOptions): StorageAdapter {
    if (!options?.url || !options?.token || !options?.org || !options?.bucket) {
      throw new Error(
        'InfluxDB adapter requires url, token, org, and bucket options',
      );
    }
    return new InfluxDBAdapter(options);
  }

  private static createPrometheusAdapter(options: PrometheusOptions): StorageAdapter {
    if (!options?.url) {
      throw new Error('Prometheus adapter requires url option');
    }
    return new PrometheusAdapter(options);
  }

  private static createClickHouseAdapter(options: ClickHouseOptions): StorageAdapter {
    if (!options?.host || !options?.database) {
      throw new Error('ClickHouse adapter requires host and database options');
    }
    return new ClickHouseAdapter(options);
  }

  private static createTimescaleDBAdapter(options: TimescaleDBOptions): StorageAdapter {
    if (!options?.host || !options?.user || !options?.password || !options?.database) {
      throw new Error(
        'TimescaleDB adapter requires host, user, password, and database options',
      );
    }
    return new TimescaleDBAdapter(options);
  }
}

