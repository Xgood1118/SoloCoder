import { MetricLabels } from './metrics';

export type AlertLevel = 'info' | 'warning' | 'critical';

export type Operator = 'gt' | 'lt' | 'eq' | 'ne' | 'outside';

export { MetricLabels };

export interface AlertThreshold {
  warning: number;
  critical: number;
}

export interface AlertRule {
  id: string;
  metricName: string;
  operator: Operator;
  thresholds: AlertThreshold;
  duration: number;
  level: AlertLevel;
  priority: number;
  labels: MetricLabels;
  enabled: boolean;
}

export interface ActiveAlert {
  id: string;
  ruleId: string;
  metricName: string;
  level: AlertLevel;
  value: number;
  threshold: number;
  labels: MetricLabels;
  triggeredAt: number;
  duration: number;
  consecutiveCount: number;
}

export interface AlertEvent {
  ruleId: string;
  metricName: string;
  level: AlertLevel;
  value: number;
  threshold: number;
  operator: Operator;
  labels: MetricLabels;
  timestamp: number;
  type: 'triggered' | 'resolved';
}

export const OPERATOR_LABELS: Record<Operator, string> = {
  gt: '大于',
  lt: '小于',
  eq: '等于',
  ne: '不等于',
  outside: '区间外',
};

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
};

export const ALERT_LEVEL_PRIORITY: Record<AlertLevel, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};
