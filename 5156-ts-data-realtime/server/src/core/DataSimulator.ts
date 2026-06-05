import type { DataPoint } from '../types';

interface MetricConfig {
  name: string;
  baseValue: number;
  variance: number;
  trend?: number;
}

export class DataSimulator {
  private metricConfigs: MetricConfig[] = [
    { name: 'cpu_usage', baseValue: 50, variance: 20 },
    { name: 'memory_usage', baseValue: 65, variance: 15 },
    { name: 'disk_usage', baseValue: 45, variance: 10 },
    { name: 'network_in', baseValue: 100, variance: 50 },
    { name: 'network_out', baseValue: 80, variance: 40 },
    { name: 'request_count', baseValue: 1000, variance: 300 },
    { name: 'error_rate', baseValue: 2, variance: 1 },
    { name: 'response_time', baseValue: 150, variance: 50 },
  ];

  private servers = ['server-01', 'server-02', 'server-03'];
  private environments = ['production', 'staging', 'development'];

  generateDataPoint(timestamp?: number): DataPoint {
    const metric = this.metricConfigs[Math.floor(Math.random() * this.metricConfigs.length)];
    const server = this.servers[Math.floor(Math.random() * this.servers.length)];
    const environment = this.environments[Math.floor(Math.random() * this.environments.length)];

    const value = this.generateValue(metric);

    return {
      timestamp: timestamp || Date.now(),
      metricName: metric.name,
      value: Math.round(value * 100) / 100,
      dimensions: {
        server,
        environment,
      },
    };
  }

  generateBatch(count: number, startTime?: number, interval: number = 1000): DataPoint[] {
    const points: DataPoint[] = [];
    const start = startTime || Date.now() - count * interval;

    for (let i = 0; i < count; i++) {
      for (const server of this.servers) {
        for (const metric of this.metricConfigs) {
          const value = this.generateValue(metric);
          points.push({
            timestamp: start + i * interval,
            metricName: metric.name,
            value: Math.round(value * 100) / 100,
            dimensions: {
              server,
              environment: 'production',
            },
          });
        }
      }
    }

    return points.sort((a, b) => a.timestamp - b.timestamp);
  }

  generateHistoricalData(
    startTime: number,
    endTime: number,
    interval: number = 1000
  ): DataPoint[] {
    const points: DataPoint[] = [];
    const duration = endTime - startTime;
    const count = Math.floor(duration / interval);

    for (let i = 0; i < count; i++) {
      for (const server of this.servers) {
        for (const metric of this.metricConfigs) {
          const value = this.generateValue(metric);
          points.push({
            timestamp: startTime + i * interval,
            metricName: metric.name,
            value: Math.round(value * 100) / 100,
            dimensions: {
              server,
              environment: 'production',
            },
          });
        }
      }
    }

    return points;
  }

  getMetricNames(): string[] {
    return this.metricConfigs.map((m) => m.name);
  }

  getServers(): string[] {
    return [...this.servers];
  }

  getEnvironments(): string[] {
    return [...this.environments];
  }

  private generateValue(metric: MetricConfig): number {
    const randomFactor = (Math.random() - 0.5) * 2;
    let value = metric.baseValue + randomFactor * metric.variance;
    if (metric.trend) {
      value += metric.trend;
    }
    return Math.max(0, value);
  }

  generateAnomaly(metricName: string, factor: number = 3): DataPoint {
    const metric = this.metricConfigs.find((m) => m.name === metricName);
    if (!metric) {
      return this.generateDataPoint();
    }

    const server = this.servers[Math.floor(Math.random() * this.servers.length)];
    const value = metric.baseValue + metric.variance * factor;

    return {
      timestamp: Date.now(),
      metricName,
      value: Math.round(value * 100) / 100,
      dimensions: {
        server,
        environment: 'production',
      },
    };
  }
}
