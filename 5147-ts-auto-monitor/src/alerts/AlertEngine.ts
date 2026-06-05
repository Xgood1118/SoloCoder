import fs from 'fs';
import { EventEmitter } from 'events';
import { createModuleLogger, ModuleLogger } from '../utils/logger';
import config from '../config/env';
import { RuleParser } from './RuleParser';
import { AlertRule, ActiveAlert, AlertEvent, AlertLevel, ALERT_LEVEL_PRIORITY } from '../types/alerts';
import { MetricValue, MetricLabels } from '../types/metrics';

interface RuleState {
  ruleId: string;
  consecutiveMatches: number;
  lastValue: number | null;
  lastCheck: number;
}

export class AlertEngine extends EventEmitter {
  private logger: ModuleLogger;
  private rules: AlertRule[] = [];
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private ruleStates: Map<string, RuleState> = new Map();
  private ruleParser: RuleParser;
  private rulesFile: string;
  private fileWatcher: fs.FSWatcher | null = null;
  private lastReload: number = 0;
  private reloadDebounce: number = 1000;

  constructor() {
    super();
    this.logger = createModuleLogger('AlertEngine');
    this.ruleParser = new RuleParser();
    this.rulesFile = config.alertRulesFile;
  }

  async start(): Promise<void> {
    this.loadRules();
    this.watchRulesFile();
    this.logger.info('告警引擎已启动', { ruleCount: this.rules.length });
  }

  stop(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    this.logger.info('告警引擎已停止');
  }

  loadRules(): void {
    const rules = this.ruleParser.parseFile(this.rulesFile);
    this.rules = rules.sort((a, b) => b.priority - a.priority);
    this.lastReload = Date.now();
    this.logger.info('告警规则已加载', { count: this.rules.length });
    this.emit('rules:updated', this.rules);
  }

  private watchRulesFile(): void {
    try {
      this.fileWatcher = fs.watch(
        this.rulesFile,
        { persistent: false },
        (event) => {
          if (event === 'change') {
            const now = Date.now();
            if (now - this.lastReload > this.reloadDebounce) {
              this.logger.info('检测到规则文件变化，重新加载规则');
              this.loadRules();
            }
          }
        }
      );
    } catch (error) {
      this.logger.warn('无法监听规则文件变化，热更新已禁用', {
        error: (error as Error).message,
      });
    }
  }

  processMetrics(metrics: MetricValue[]): AlertEvent[] {
    const events: AlertEvent[] = [];

    for (const metric of metrics) {
      const metricEvents = this.processMetric(metric);
      events.push(...metricEvents);
    }

    return events;
  }

  private processMetric(metric: MetricValue): AlertEvent[] {
    const events: AlertEvent[] = [];
    const matchingRules = this.findMatchingRules(metric);

    for (const rule of matchingRules) {
      const stateKey = this.getStateKey(rule, metric.labels);
      const state = this.getOrCreateState(stateKey);

      const matches = this.evaluateRule(rule, metric.value);
      const currentLevel = matches ? this.getTriggeredLevel(rule, metric.value) : null;

      if (currentLevel) {
        state.consecutiveMatches++;
        state.lastValue = metric.value;
        state.lastCheck = metric.timestamp;

        if (state.consecutiveMatches >= rule.duration) {
          const alertId = this.getAlertId(rule.id, metric.labels);

          if (!this.activeAlerts.has(alertId)) {
            const event = this.triggerAlert(rule, metric, currentLevel);
            events.push(event);
          } else {
            const existingAlert = this.activeAlerts.get(alertId)!;
            if (ALERT_LEVEL_PRIORITY[currentLevel] > ALERT_LEVEL_PRIORITY[existingAlert.level]) {
              this.activeAlerts.delete(alertId);
              const event = this.triggerAlert(rule, metric, currentLevel);
              events.push(event);
            }
          }
        }
      } else {
        state.consecutiveMatches = 0;
        state.lastValue = metric.value;
        state.lastCheck = metric.timestamp;

        const alertId = this.getAlertId(rule.id, metric.labels);
        if (this.activeAlerts.has(alertId)) {
          const event = this.resolveAlert(alertId, metric);
          events.push(event);
        }
      }
    }

    return events;
  }

  private findMatchingRules(metric: MetricValue): AlertRule[] {
    return this.rules.filter((rule) => {
      if (!rule.enabled) return false;
      if (rule.metricName !== metric.name && rule.metricName !== '*') return false;
      return this.matchLabels(rule.labels, metric.labels);
    });
  }

  private matchLabels(ruleLabels: MetricLabels, metricLabels: MetricLabels): boolean {
    for (const [key, value] of Object.entries(ruleLabels)) {
      if (metricLabels[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private evaluateRule(rule: AlertRule, value: number): boolean {
    const threshold = rule.thresholds.warning;

    switch (rule.operator) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return Math.abs(value - threshold) < 0.001;
      case 'ne':
        return Math.abs(value - threshold) >= 0.001;
      case 'outside':
        return value < threshold * 0.9 || value > threshold * 1.1;
      default:
        return false;
    }
  }

  private getTriggeredLevel(rule: AlertRule, value: number): AlertLevel | null {
    if (value >= rule.thresholds.critical) {
      return 'critical';
    }
    if (value >= rule.thresholds.warning) {
      return 'warning';
    }
    return null;
  }

  private triggerAlert(rule: AlertRule, metric: MetricValue, level: AlertLevel): AlertEvent {
    const alertId = this.getAlertId(rule.id, metric.labels);
    const threshold = level === 'critical' ? rule.thresholds.critical : rule.thresholds.warning;

    const alert: ActiveAlert = {
      id: alertId,
      ruleId: rule.id,
      metricName: metric.name,
      level,
      value: metric.value,
      threshold,
      labels: metric.labels,
      triggeredAt: Date.now(),
      duration: rule.duration,
      consecutiveCount: 1,
    };

    this.activeAlerts.set(alertId, alert);

    const event: AlertEvent = {
      ruleId: rule.id,
      metricName: metric.name,
      level,
      value: metric.value,
      threshold,
      operator: rule.operator,
      labels: metric.labels,
      timestamp: Date.now(),
      type: 'triggered',
    };

    this.logger.warn('告警已触发', {
      metric: metric.name,
      level,
      value: metric.value,
      threshold,
      labels: metric.labels,
    });

    this.emit('alert:triggered', event);
    return event;
  }

  private resolveAlert(alertId: string, metric: MetricValue): AlertEvent {
    const alert = this.activeAlerts.get(alertId)!;
    this.activeAlerts.delete(alertId);

    const event: AlertEvent = {
      ruleId: alert.ruleId,
      metricName: alert.metricName,
      level: alert.level,
      value: metric.value,
      threshold: alert.threshold,
      operator: 'lt',
      labels: alert.labels,
      timestamp: Date.now(),
      type: 'resolved',
    };

    this.logger.info('告警已恢复', {
      metric: alert.metricName,
      level: alert.level,
      value: metric.value,
    });

    this.emit('alert:resolved', event);
    return event;
  }

  private getStateKey(rule: AlertRule, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${rule.id}:${labelStr}`;
  }

  private getOrCreateState(stateKey: string): RuleState {
    if (!this.ruleStates.has(stateKey)) {
      this.ruleStates.set(stateKey, {
        ruleId: stateKey,
        consecutiveMatches: 0,
        lastValue: null,
        lastCheck: 0,
      });
    }
    return this.ruleStates.get(stateKey)!;
  }

  private getAlertId(ruleId: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${ruleId}:${labelStr}`;
  }

  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  getRules(): AlertRule[] {
    return [...this.rules];
  }

  addRule(rule: AlertRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    this.emit('rules:updated', this.rules);
  }

  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      this.emit('rules:updated', this.rules);
      return true;
    }
    return false;
  }
}
