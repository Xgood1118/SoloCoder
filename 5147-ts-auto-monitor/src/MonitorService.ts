import { createModuleLogger, ModuleLogger } from './utils/logger';
import config from './config/env';
import { SystemMetricsCollector } from './collectors/SystemMetricsCollector';
import { BusinessMetricsCollector } from './collectors/BusinessMetricsCollector';
import { AlertEngine } from './alerts/AlertEngine';
import { NotificationManager } from './notifications/NotificationManager';
import { PrometheusExporter } from './metrics/PrometheusExporter';
import { MetricsStore } from './metrics/MetricsStore';
import { MetricValue } from './types/metrics';
import { AlertEvent } from './types/alerts';
import { NotificationMessage } from './types/notifications';

export class MonitorService {
  private logger: ModuleLogger;
  private systemCollector: SystemMetricsCollector;
  private businessCollector: BusinessMetricsCollector;
  private alertEngine: AlertEngine;
  private notificationManager: NotificationManager;
  private prometheusExporter: PrometheusExporter;
  private metricsStore: MetricsStore;
  private collectionTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.logger = createModuleLogger('MonitorService');
    this.systemCollector = new SystemMetricsCollector();
    this.businessCollector = new BusinessMetricsCollector();
    this.alertEngine = new AlertEngine();
    this.notificationManager = new NotificationManager();
    this.prometheusExporter = new PrometheusExporter();
    this.metricsStore = new MetricsStore();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('监控服务已在运行');
      return;
    }

    this.logger.info('启动监控服务...');

    await this.alertEngine.start();

    this.alertEngine.on('alert:triggered', (event: AlertEvent) => {
      this.handleAlertEvent(event);
    });

    this.alertEngine.on('alert:resolved', (event: AlertEvent) => {
      this.handleAlertEvent(event);
    });

    this.startCollection();

    this.isRunning = true;
    this.logger.info('监控服务已启动', {
      collectionInterval: config.collectionInterval,
    });
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('停止监控服务...');

    if (this.collectionTimer) {
      clearTimeout(this.collectionTimer);
      this.collectionTimer = null;
    }

    this.alertEngine.stop();
    this.isRunning = false;
    this.logger.info('监控服务已停止');
  }

  private startCollection(): void {
    this.collectMetrics();
  }

  private async collectMetrics(): Promise<void> {
    try {
      const [systemResult, businessResult] = await Promise.allSettled([
        this.systemCollector.collect(),
        this.businessCollector.collect(),
      ]);

      const allMetrics: MetricValue[] = [];

      if (systemResult.status === 'fulfilled') {
        allMetrics.push(...systemResult.value.metrics);
      }

      if (businessResult.status === 'fulfilled') {
        allMetrics.push(...businessResult.value.metrics);
      }

      if (allMetrics.length > 0) {
        this.processMetrics(allMetrics);
      }
    } catch (error) {
      this.logger.error('指标采集失败', { error: (error as Error).message });
    } finally {
      if (this.isRunning) {
        this.collectionTimer = setTimeout(
          () => this.collectMetrics(),
          config.collectionInterval
        );
      }
    }
  }

  private processMetrics(metrics: MetricValue[]): void {
    this.metricsStore.addMetrics(metrics);

    this.prometheusExporter.updateMetrics(metrics);

    const events = this.alertEngine.processMetrics(metrics);

    if (events.length > 0) {
      this.logger.debug('告警事件', { count: events.length });
    }
  }

  private handleAlertEvent(event: AlertEvent): void {
    const message: NotificationMessage = {
      id: `${event.ruleId}-${event.timestamp}`,
      title: event.type === 'triggered' ? '告警触发' : '告警恢复',
      content: `指标 ${event.metricName} 当前值 ${event.value.toFixed(2)} ${event.type === 'triggered' ? '超过' : '低于'} 阈值 ${event.threshold.toFixed(2)}`,
      level: event.level,
      metricName: event.metricName,
      value: event.value,
      threshold: event.threshold,
      labels: event.labels,
      timestamp: event.timestamp,
      type: event.type,
    };

    this.notificationManager.sendNotification(message).catch((error) => {
      this.logger.error('发送通知失败', { error: error.message });
    });
  }

  getSystemCollector(): SystemMetricsCollector {
    return this.systemCollector;
  }

  getBusinessCollector(): BusinessMetricsCollector {
    return this.businessCollector;
  }

  getAlertEngine(): AlertEngine {
    return this.alertEngine;
  }

  getNotificationManager(): NotificationManager {
    return this.notificationManager;
  }

  getPrometheusExporter(): PrometheusExporter {
    return this.prometheusExporter;
  }

  getMetricsStore(): MetricsStore {
    return this.metricsStore;
  }

  getStatus(): {
    isRunning: boolean;
    systemAvailable: boolean;
    businessAvailable: boolean;
    activeAlerts: number;
    storedMetrics: number;
    totalPoints: number;
  } {
    return {
      isRunning: this.isRunning,
      systemAvailable: this.systemCollector.isAvailable(),
      businessAvailable: this.businessCollector.isAvailable(),
      activeAlerts: this.alertEngine.getActiveAlerts().length,
      storedMetrics: this.metricsStore.getStoredMetricsCount(),
      totalPoints: this.metricsStore.getTotalPoints(),
    };
  }
}
