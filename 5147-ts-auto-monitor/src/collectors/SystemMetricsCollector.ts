import si from 'systeminformation';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import config from '../config/env';
import { SystemMetrics, MetricValue, MetricLabels, DataSourceStatus } from '../types/metrics';

const MAX_CONSECUTIVE_FAILURES = 3;

export class SystemMetricsCollector {
  private logger: ModuleLogger;
  private cache: SystemMetrics | null = null;
  private status: DataSourceStatus;
  private labels: MetricLabels;
  private lastNetworkStats: {
    rx_sec: number;
    tx_sec: number;
    timestamp: number;
  } | null = null;

  constructor() {
    this.logger = createModuleLogger('SystemCollector');
    this.status = {
      name: 'system',
      available: true,
      consecutiveFailures: 0,
      lastSuccess: null,
      lastFailure: null,
    };
    this.labels = {
      instance: config.instanceId,
      service: config.serviceName,
    };
  }

  async collect(): Promise<{ metrics: MetricValue[]; success: boolean }> {
    try {
      const systemMetrics = await this.fetchSystemMetrics();
      this.cache = systemMetrics;
      this.status.consecutiveFailures = 0;
      this.status.available = true;
      this.status.lastSuccess = Date.now();

      const metrics = this.transformToMetricValues(systemMetrics);
      this.logger.debug('系统指标采集成功', {
        cpu: systemMetrics.cpuUsage.toFixed(2),
        memory: systemMetrics.memoryUsage.toFixed(2),
      });

      return { metrics, success: true };
    } catch (error) {
      this.status.consecutiveFailures++;
      this.status.lastFailure = Date.now();

      if (this.status.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.status.available = false;
        this.logger.error('系统指标数据源不可用', {
          consecutiveFailures: this.status.consecutiveFailures,
        });
      } else {
        this.logger.warn('系统指标采集失败，使用缓存值', {
          error: (error as Error).message,
          consecutiveFailures: this.status.consecutiveFailures,
        });
      }

      if (this.cache) {
        const metrics = this.transformToMetricValues(this.cache);
        return { metrics, success: false };
      }

      return { metrics: [], success: false };
    }
  }

  private async fetchSystemMetrics(): Promise<SystemMetrics> {
    const [cpu, mem, fs, net, processes] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.processes(),
    ]);
    const os = require('os');
    const loadAvg = os.loadavg();

    const mainDisk = fs[0] || { size: 0, used: 0, use: 0 };
    const networkStats = this.calculateNetworkRate(net);

    return {
      cpuUsage: cpu.currentLoad,
      memoryUsage: (mem.used / mem.total) * 100,
      memoryTotal: mem.total,
      memoryUsed: mem.used,
      diskUsage: mainDisk.use,
      diskTotal: mainDisk.size,
      diskUsed: mainDisk.used,
      networkIn: networkStats.rx_sec,
      networkOut: networkStats.tx_sec,
      processCount: processes.all,
      loadAverage: loadAvg,
    };
  }

  private calculateNetworkRate(
    netStats: any[]
  ): { rx_sec: number; tx_sec: number } {
    const totalRx = netStats.reduce((sum, n) => sum + n.rx_bytes, 0);
    const totalTx = netStats.reduce((sum, n) => sum + n.tx_bytes, 0);
    const now = Date.now();

    if (!this.lastNetworkStats) {
      this.lastNetworkStats = {
        rx_sec: totalRx,
        tx_sec: totalTx,
        timestamp: now,
      };
      return { rx_sec: 0, tx_sec: 0 };
    }

    const timeDiff = (now - this.lastNetworkStats.timestamp) / 1000;
    const rxRate = (totalRx - this.lastNetworkStats.rx_sec) / timeDiff;
    const txRate = (totalTx - this.lastNetworkStats.tx_sec) / timeDiff;

    this.lastNetworkStats = {
      rx_sec: totalRx,
      tx_sec: totalTx,
      timestamp: now,
    };

    return {
      rx_sec: Math.max(0, rxRate),
      tx_sec: Math.max(0, txRate),
    };
  }

  private transformToMetricValues(systemMetrics: SystemMetrics): MetricValue[] {
    const timestamp = Date.now();
    const values: MetricValue[] = [];

    values.push({
      name: 'cpu_usage_percent',
      value: systemMetrics.cpuUsage,
      timestamp,
      labels: { ...this.labels },
    });

    values.push({
      name: 'memory_usage_percent',
      value: systemMetrics.memoryUsage,
      timestamp,
      labels: { ...this.labels },
    });

    values.push({
      name: 'memory_total_bytes',
      value: systemMetrics.memoryTotal,
      timestamp,
      labels: { ...this.labels },
    });

    values.push({
      name: 'memory_used_bytes',
      value: systemMetrics.memoryUsed,
      timestamp,
      labels: { ...this.labels },
    });

    values.push({
      name: 'disk_usage_percent',
      value: systemMetrics.diskUsage,
      timestamp,
      labels: { ...this.labels, mount: '/' },
    });

    values.push({
      name: 'disk_total_bytes',
      value: systemMetrics.diskTotal,
      timestamp,
      labels: { ...this.labels, mount: '/' },
    });

    values.push({
      name: 'disk_used_bytes',
      value: systemMetrics.diskUsed,
      timestamp,
      labels: { ...this.labels, mount: '/' },
    });

    values.push({
      name: 'network_in_bytes_per_second',
      value: systemMetrics.networkIn,
      timestamp,
      labels: { ...this.labels, interface: 'all' },
    });

    values.push({
      name: 'network_out_bytes_per_second',
      value: systemMetrics.networkOut,
      timestamp,
      labels: { ...this.labels, interface: 'all' },
    });

    values.push({
      name: 'process_count',
      value: systemMetrics.processCount,
      timestamp,
      labels: { ...this.labels },
    });

    values.push({
      name: 'load_average_1m',
      value: systemMetrics.loadAverage[0],
      timestamp,
      labels: { ...this.labels },
    });

    return values;
  }

  getStatus(): DataSourceStatus {
    return { ...this.status };
  }

  isAvailable(): boolean {
    return this.status.available;
  }
}
