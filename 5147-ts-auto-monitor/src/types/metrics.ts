export type MetricType = 'gauge' | 'counter' | 'histogram' | 'summary';

export type MetricCategory = 'system' | 'business';

export interface MetricLabels {
  [key: string]: string;
}

export interface MetricValue {
  name: string;
  value: number;
  timestamp: number;
  labels: MetricLabels;
}

export interface MetricDefinition {
  name: string;
  type: MetricType;
  category: MetricCategory;
  unit: string;
  description: string;
  labels: string[];
}

export interface CollectedMetric {
  name: string;
  values: MetricValue[];
  collectedAt: number;
}

export interface DataSourceStatus {
  name: string;
  available: boolean;
  consecutiveFailures: number;
  lastSuccess: number | null;
  lastFailure: number | null;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  diskUsage: number;
  diskTotal: number;
  diskUsed: number;
  networkIn: number;
  networkOut: number;
  processCount: number;
  loadAverage: number[];
}

export interface BusinessMetrics {
  qps: number;
  requestLatency: number;
  errorRate: number;
  [key: string]: number;
}

export const SYSTEM_METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    name: 'cpu_usage_percent',
    type: 'gauge',
    category: 'system',
    unit: 'percent',
    description: 'CPU使用率百分比',
    labels: ['instance', 'service'],
  },
  {
    name: 'memory_usage_percent',
    type: 'gauge',
    category: 'system',
    unit: 'percent',
    description: '内存使用率百分比',
    labels: ['instance', 'service'],
  },
  {
    name: 'memory_total_bytes',
    type: 'gauge',
    category: 'system',
    unit: 'bytes',
    description: '总内存字节数',
    labels: ['instance', 'service'],
  },
  {
    name: 'memory_used_bytes',
    type: 'gauge',
    category: 'system',
    unit: 'bytes',
    description: '已使用内存字节数',
    labels: ['instance', 'service'],
  },
  {
    name: 'disk_usage_percent',
    type: 'gauge',
    category: 'system',
    unit: 'percent',
    description: '磁盘使用率百分比',
    labels: ['instance', 'service', 'mount'],
  },
  {
    name: 'disk_total_bytes',
    type: 'gauge',
    category: 'system',
    unit: 'bytes',
    description: '总磁盘字节数',
    labels: ['instance', 'service', 'mount'],
  },
  {
    name: 'disk_used_bytes',
    type: 'gauge',
    category: 'system',
    unit: 'bytes',
    description: '已使用磁盘字节数',
    labels: ['instance', 'service', 'mount'],
  },
  {
    name: 'network_in_bytes_per_second',
    type: 'gauge',
    category: 'system',
    unit: 'bytes_per_second',
    description: '网络入站流量速率',
    labels: ['instance', 'service', 'interface'],
  },
  {
    name: 'network_out_bytes_per_second',
    type: 'gauge',
    category: 'system',
    unit: 'bytes_per_second',
    description: '网络出站流量速率',
    labels: ['instance', 'service', 'interface'],
  },
  {
    name: 'process_count',
    type: 'gauge',
    category: 'system',
    unit: 'count',
    description: '进程数量',
    labels: ['instance', 'service'],
  },
  {
    name: 'load_average_1m',
    type: 'gauge',
    category: 'system',
    unit: 'count',
    description: '1分钟平均负载',
    labels: ['instance', 'service'],
  },
];

export const BUSINESS_METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    name: 'qps',
    type: 'gauge',
    category: 'business',
    unit: 'requests_per_second',
    description: '每秒请求数',
    labels: ['instance', 'service', 'endpoint'],
  },
  {
    name: 'request_latency_ms',
    type: 'gauge',
    category: 'business',
    unit: 'milliseconds',
    description: '请求延迟毫秒数',
    labels: ['instance', 'service', 'endpoint'],
  },
  {
    name: 'error_rate_percent',
    type: 'gauge',
    category: 'business',
    unit: 'percent',
    description: '错误率百分比',
    labels: ['instance', 'service', 'endpoint'],
  },
];
