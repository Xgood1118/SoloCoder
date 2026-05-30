export enum MetricType {
  Counter = 'counter',
  Gauge = 'gauge',
  Histogram = 'histogram',
  Summary = 'summary',
}

export interface Labels {
  [key: string]: string;
}

export interface MetricOptions {
  name: string;
  help: string;
  type: MetricType;
  unit?: string;
  labelNames?: string[];
}

export interface CounterOptions extends MetricOptions {
  type: MetricType.Counter;
}

export interface GaugeOptions extends MetricOptions {
  type: MetricType.Gauge;
}

export interface HistogramOptions extends MetricOptions {
  type: MetricType.Histogram;
  buckets?: number[];
}

export interface SummaryOptions extends MetricOptions {
  type: MetricType.Summary;
  percentiles?: number[];
  maxAgeSeconds?: number;
  ageBuckets?: number;
}

export type AnyMetricOptions =
  | CounterOptions
  | GaugeOptions
  | HistogramOptions
  | SummaryOptions;

export interface MetricValue {
  value: number;
  timestamp: number;
  labels: Labels;
}

export interface HistogramValue {
  count: number;
  sum: number;
  buckets: Map<number, number>;
  timestamp: number;
  labels: Labels;
}

export interface SummaryValue {
  count: number;
  sum: number;
  quantiles: Map<number, number>;
  timestamp: number;
  labels: Labels;
}

export interface MetricSnapshot {
  name: string;
  help: string;
  type: MetricType;
  unit?: string;
  values: MetricValue[] | HistogramValue[] | SummaryValue[];
}

export enum AggregationFunction {
  Sum = 'sum',
  Avg = 'avg',
  Min = 'min',
  Max = 'max',
  Count = 'count',
  Percentile = 'percentile',
}

export interface AggregationConfig {
  function: AggregationFunction;
  windowMs: number;
  slideMs?: number;
  percentile?: number;
}

export interface AggregatedData {
  metricName: string;
  labels: Labels;
  function: AggregationFunction;
  value: number;
  timestamp: number;
  windowStart: number;
  windowEnd: number;
}

export enum AlertSeverity {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
}

export enum AlertStatus {
  Normal = 'normal',
  Pending = 'pending',
  Firing = 'firing',
  Acknowledged = 'acknowledged',
  Resolving = 'resolving',
  Recovered = 'recovered',
}

export enum AlertOperator {
  GreaterThan = '>',
  LessThan = '<',
  GreaterThanOrEqual = '>=',
  LessThanOrEqual = '<=',
  Equal = '==',
  NotEqual = '!=',
  RateIncrease = 'rate_increase',
  RateDecrease = 'rate_decrease',
}

export interface AlertCondition {
  metricName: string;
  labels?: Labels;
  operator: AlertOperator;
  threshold: number;
  durationMs?: number;
  lookbackMs?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  severity: AlertSeverity;
  conditions: AlertCondition[];
  conditionOperator?: 'AND' | 'OR';
  forMs?: number;
  labels?: Labels;
  annotations?: { [key: string]: string };
}

export interface Alert {
  id: string;
  ruleId: string;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  labels: Labels;
  annotations: { [key: string]: string };
  value: number;
  threshold: number;
  operator: AlertOperator;
  startedAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolvedAt?: number;
  recoveredAt?: number;
}

export interface StorageAdapter {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  write(data: AggregatedData[]): Promise<void>;
  query(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Labels,
    aggregation?: AggregationFunction,
  ): Promise<AggregatedData[]>;
  deleteOldData(retentionDays: number): Promise<void>;
  isConnected(): boolean;
}

export interface CollectorTarget {
  id: string;
  name: string;
  url: string;
  intervalMs: number;
  timeoutMs?: number;
  labels?: Labels;
  enabled?: boolean;
}

export interface CollectorConfig {
  targets: CollectorTarget[];
  defaultIntervalMs?: number;
  defaultTimeoutMs?: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  labels: Labels;
}

export interface SlidingWindowOptions {
  windowSize: number;
  slideInterval: number;
  maxPoints?: number;
}

export const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export const DEFAULT_PERCENTILES = [0.5, 0.9, 0.95, 0.99];

export const EPSILON = 1e-9;
