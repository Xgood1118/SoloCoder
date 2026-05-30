import {
  AlertRule,
  Alert,
  AlertStatus,
  AlertSeverity,
  AlertOperator,
  AlertCondition,
  Labels,
} from './types';
import { Registry } from './Registry';
import { Aggregator } from './Aggregator';
import { labelsToKey, now, floatEqual } from './utils';

interface RuleState {
  rule: AlertRule;
  pendingSince?: number;
  lastFired?: number;
  lastValue?: number;
}

interface PendingAlert {
  ruleId: string;
  condition: AlertCondition;
  value: number;
  since: number;
}

export interface AlertNotification {
  alert: Alert;
  previousStatus: AlertStatus;
  newStatus: AlertStatus;
}

export type AlertHandler = (notification: AlertNotification) => void | Promise<void>;

export interface AlerterOptions {
  registry?: Registry;
  aggregator?: Aggregator;
  checkIntervalMs?: number;
  minSampleSize?: number;
}

export interface AlerterStats {
  totalRules: number;
  activeAlerts: number;
  firingAlerts: number;
  acknowledgedAlerts: number;
}

export class Alerter {
  private registry: Registry;
  private aggregator?: Aggregator;
  private rules: Map<string, RuleState>;
  private alerts: Map<string, Alert>;
  private checkIntervalMs: number;
  private minSampleSize: number;
  private checkTimer?: NodeJS.Timeout;
  private handlers: Map<string, AlertHandler[]>;
  private pendingAlerts: Map<string, PendingAlert>;

  constructor(options: AlerterOptions = {}) {
    this.registry = options.registry || Registry.getInstance();
    this.aggregator = options.aggregator;
    this.rules = new Map();
    this.alerts = new Map();
    this.pendingAlerts = new Map();
    this.handlers = new Map();
    this.checkIntervalMs = options.checkIntervalMs || 10000;
    this.minSampleSize = options.minSampleSize || 5;
  }

  addRule(rule: AlertRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Rule ${rule.id} already exists`);
    }
    this.rules.set(rule.id, { rule });
  }

  updateRule(rule: AlertRule): void {
    if (!this.rules.has(rule.id)) {
      throw new Error(`Rule ${rule.id} not found`);
    }
    this.rules.set(rule.id, { rule });
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId)?.rule;
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values()).map((s) => s.rule);
  }

  addHandler(severity: AlertSeverity | 'all', handler: AlertHandler): void {
    const key = severity === 'all' ? 'all' : severity;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, []);
    }
    this.handlers.get(key)!.push(handler);
  }

  removeHandler(severity: AlertSeverity | 'all', handler: AlertHandler): void {
    const key = severity === 'all' ? 'all' : severity;
    const handlers = this.handlers.get(key);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private async notifyHandlers(alert: Alert, previousStatus: AlertStatus, newStatus: AlertStatus): Promise<void> {
    const notification: AlertNotification = { alert, previousStatus, newStatus };

    const allHandlers = this.handlers.get('all') || [];
    const severityHandlers = this.handlers.get(alert.severity) || [];

    for (const handler of [...allHandlers, ...severityHandlers]) {
      try {
        await handler(notification);
      } catch (e) {
        console.error('Alert handler error:', e);
      }
    }
  }

  start(): void {
    if (this.checkTimer) return;

    this.checkTimer = setInterval(() => {
      this.checkRules().catch((e) => console.error('Alert check error:', e));
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  async checkRules(): Promise<void> {
    for (const [ruleId, state] of this.rules.entries()) {
      await this.checkRule(ruleId, state);
    }

    await this.checkRecovery();
  }

  private async checkRule(ruleId: string, state: RuleState): Promise<void> {
    const rule = state.rule;
    const conditionOperator = rule.conditionOperator || 'AND';

    const conditionResults: boolean[] = [];
    let matchedCondition: AlertCondition | undefined;
    let currentValue: number = 0;

    for (const condition of rule.conditions) {
      const result = await this.evaluateCondition(condition);
      conditionResults.push(result.matched);
      if (result.matched && !matchedCondition) {
        matchedCondition = condition;
        currentValue = result.value;
      }
    }

    const isFiring =
      conditionOperator === 'AND'
        ? conditionResults.every((r) => r)
        : conditionResults.some((r) => r);

    const alertKey = this.getAlertKey(ruleId, rule.conditions[0]?.labels || {});
    const existingAlert = this.alerts.get(alertKey);

    if (isFiring && matchedCondition) {
      await this.handleFiring(ruleId, state, rule, matchedCondition, currentValue, alertKey, existingAlert);
    } else if (!isFiring && existingAlert && existingAlert.status === AlertStatus.Firing) {
      this.updateAlertStatus(existingAlert, AlertStatus.Recovered);
      await this.notifyHandlers(existingAlert, AlertStatus.Firing, AlertStatus.Recovered);
    }
  }

  private async handleFiring(
    ruleId: string,
    state: RuleState,
    rule: AlertRule,
    condition: AlertCondition,
    currentValue: number,
    alertKey: string,
    existingAlert?: Alert,
  ): Promise<void> {
    const forMs = rule.forMs || 0;
    const currentTime = now();

    if (!existingAlert) {
      if (forMs > 0) {
        if (!state.pendingSince) {
          state.pendingSince = currentTime;
          return;
        }

        if (currentTime - state.pendingSince < forMs) {
          return;
        }
      }

      const alert: Alert = {
        id: alertKey,
        ruleId,
        name: rule.name,
        severity: rule.severity,
        status: AlertStatus.Pending,
        labels: { ...rule.labels, ...condition.labels },
        annotations: rule.annotations || {},
        value: currentValue,
        threshold: condition.threshold,
        operator: condition.operator,
        startedAt: state.pendingSince || currentTime,
      };

      this.alerts.set(alertKey, alert);
      state.lastFired = currentTime;
      state.lastValue = currentValue;
      state.pendingSince = undefined;

      this.updateAlertStatus(alert, AlertStatus.Firing);
      await this.notifyHandlers(alert, AlertStatus.Normal, AlertStatus.Firing);
    } else if (existingAlert.status === AlertStatus.Firing) {
      existingAlert.value = currentValue;
      existingAlert.threshold = condition.threshold;
      existingAlert.operator = condition.operator;
      state.lastFired = currentTime;
      state.lastValue = currentValue;
    }
  }

  private async checkRecovery(): Promise<void> {
    const currentTime = now();
    const recoveryWindow = 300000;

    for (const [alertKey, alert] of this.alerts.entries()) {
      if (alert.status === AlertStatus.Recovered && alert.recoveredAt) {
        if (currentTime - alert.recoveredAt > recoveryWindow) {
          this.alerts.delete(alertKey);
          await this.notifyHandlers(alert, AlertStatus.Recovered, AlertStatus.Normal);
        }
      }
    }
  }

  private async evaluateCondition(condition: AlertCondition): Promise<{ matched: boolean; value: number }> {
    const { metricName, labels, operator, threshold, lookbackMs } = condition;

    const currentValue = this.getCurrentValue(metricName, labels || {});
    if (isNaN(currentValue)) {
      return { matched: false, value: NaN };
    }

    if (operator === AlertOperator.RateIncrease || operator === AlertOperator.RateDecrease) {
      const rateChange = this.getRateChange(metricName, labels || {}, lookbackMs || 300000);
      if (isNaN(rateChange)) {
        return { matched: false, value: NaN };
      }

      const matched =
        operator === AlertOperator.RateIncrease
          ? rateChange > threshold
          : rateChange < -threshold;

      return { matched, value: rateChange };
    }

    const matched = this.compareValues(currentValue, operator, threshold);
    return { matched, value: currentValue };
  }

  private getCurrentValue(metricName: string, labels: Labels): number {
    const metric = this.registry.get(metricName);
    if (metric) {
      return metric.get(labels);
    }

    if (this.aggregator) {
      const values = this.aggregator.getValues(metricName, labels);
      if (values.length > 0) {
        return values[values.length - 1].value;
      }
    }

    return NaN;
  }

  private getRateChange(metricName: string, labels: Labels, lookbackMs: number): number {
    if (!this.aggregator) return NaN;

    const values = this.aggregator.getValues(metricName, labels);
    if (values.length < 2) return NaN;

    const cutoff = now() - lookbackMs;
    const recentValues = values.filter((v) => v.timestamp >= cutoff);
    if (recentValues.length < 2) return NaN;

    const first = recentValues[0].value;
    const last = recentValues[recentValues.length - 1].value;

    if (floatEqual(first, 0)) return Infinity;

    return ((last - first) / first) * 100;
  }

  private compareValues(value: number, operator: AlertOperator, threshold: number): boolean {
    switch (operator) {
      case AlertOperator.GreaterThan:
        return value > threshold;
      case AlertOperator.LessThan:
        return value < threshold;
      case AlertOperator.GreaterThanOrEqual:
        return value >= threshold;
      case AlertOperator.LessThanOrEqual:
        return value <= threshold;
      case AlertOperator.Equal:
        return floatEqual(value, threshold);
      case AlertOperator.NotEqual:
        return !floatEqual(value, threshold);
      default:
        return false;
    }
  }

  private getAlertKey(ruleId: string, labels: Labels): string {
    const labelKey = labelsToKey(labels);
    return `${ruleId}:${labelKey}`;
  }

  private updateAlertStatus(alert: Alert, newStatus: AlertStatus): void {
    const previousStatus = alert.status;
    alert.status = newStatus;

    if (newStatus === AlertStatus.Recovered) {
      alert.recoveredAt = now();
    }
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    const previousStatus = alert.status;
    alert.status = AlertStatus.Acknowledged;
    alert.acknowledgedAt = now();
    alert.acknowledgedBy = acknowledgedBy;

    this.notifyHandlers(alert, previousStatus, AlertStatus.Acknowledged).catch((e) =>
      console.error('Acknowledge notification error:', e),
    );

    return true;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    const previousStatus = alert.status;
    alert.status = AlertStatus.Resolving;
    alert.resolvedAt = now();

    this.notifyHandlers(alert, previousStatus, AlertStatus.Resolving).catch((e) =>
      console.error('Resolve notification error:', e),
    );

    return true;
  }

  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  getAlerts(status?: AlertStatus, severity?: AlertSeverity): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (status) {
      alerts = alerts.filter((a) => a.status === status);
    }

    if (severity) {
      alerts = alerts.filter((a) => a.severity === severity);
    }

    return alerts;
  }

  getStats(): AlerterStats {
    const alerts = Array.from(this.alerts.values());
    return {
      totalRules: this.rules.size,
      activeAlerts: alerts.length,
      firingAlerts: alerts.filter((a) => a.status === AlertStatus.Firing).length,
      acknowledgedAlerts: alerts.filter((a) => a.status === AlertStatus.Acknowledged).length,
    };
  }

  clear(): void {
    this.alerts.clear();
    this.pendingAlerts.clear();
    for (const state of this.rules.values()) {
      state.pendingSince = undefined;
      state.lastFired = undefined;
      state.lastValue = undefined;
    }
  }
}
