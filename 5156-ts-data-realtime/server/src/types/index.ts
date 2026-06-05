export type AggregationType = 'sum' | 'avg' | 'max' | 'min' | 'count';

export type ComparisonDirection = 'above' | 'below';

export type AlertLevel = 'info' | 'warning' | 'critical';

export type AlertStatus = 'active' | 'resolved' | 'acknowledged';

export type WindowStartMode = 'fixed' | 'dynamic';

export type LogicalOperator = 'AND' | 'OR';

export interface DataPoint {
  timestamp: number;
  metricName: string;
  value: number;
  dimensions: Record<string, string>;
}

export interface DataPointBatch {
  type: 'data_batch';
  data: DataPoint[];
}

export interface AggregationConfig {
  metricName: string;
  windowSize: number;
  slideStep: number;
  aggregationType: AggregationType;
  groupBy?: string[];
  windowStartMode: WindowStartMode;
}

export interface AggregationResult {
  windowStart: number;
  windowEnd: number;
  metricName: string;
  aggregationType: AggregationType;
  value: number;
  dimensions: Record<string, string>;
  dataPointCount: number;
}

export interface AggregationResultBatch {
  type: 'aggregation_batch';
  data: AggregationResult[];
}

export interface AlertCondition {
  metricName: string;
  aggregationType: AggregationType;
  threshold: number;
  direction: ComparisonDirection;
  duration: number;
  dimensions?: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  level: AlertLevel;
  operator: LogicalOperator;
  conditions: AlertCondition[];
  enabled: boolean;
  createdAt: number;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  level: AlertLevel;
  status: AlertStatus;
  triggeredAt: number;
  resolvedAt?: number;
  acknowledgedAt?: number;
  metricValues: Record<string, number>;
  thresholdValues: Record<string, number>;
  duration: number;
  notes?: string;
}

export interface AlertEventUpdate {
  type: 'alert_event';
  data: AlertEvent;
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
}

export interface ConnectionStatusMessage {
  type: 'connection_status';
  data: {
    status: 'connected' | 'disconnected';
    timestamp: number;
  };
}

export interface HistoricalDataRequest {
  metricName: string;
  startTime: number;
  endTime: number;
  aggregationType: AggregationType;
  downsample?: '1m' | '5m' | '1h' | '1d';
  dimensions?: Record<string, string>;
}

export type WebSocketMessageUnion = 
  | DataPointBatch 
  | AggregationResultBatch 
  | AlertEventUpdate 
  | ConnectionStatusMessage;
