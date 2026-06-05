export type ProbeType = 'http' | 'tcp' | 'process';
export type ProbeStatus = 'up' | 'down' | 'unknown' | 'disabled';
export type AlertLevel = 'warning' | 'error' | 'critical';

export interface Probe {
  id: string;
  name: string;
  type: ProbeType;
  target: string;
  interval: number;
  timeout: number;
  group: string;
  enabled: boolean;
  status: ProbeStatus;
  failureThreshold: number;
  webhookUrl?: string;
  createTime: string;
  updateTime?: string;
}

export interface ProbeResult {
  id: string;
  probeId: string;
  timestamp: string;
  status: ProbeStatus;
  responseTime: number;
  errorMessage?: string;
  httpStatus?: number;
  cpuPercent?: number;
  memoryPercent?: number;
}

export interface ProbeStats {
  successRate: number;
  p50: number;
  p95: number;
  p99: number;
  totalCount: number;
  upCount: number;
  downCount: number;
}

export interface Event {
  id: string;
  probeId: string;
  probeName: string;
  timestamp: string;
  prevStatus: ProbeStatus;
  currStatus: ProbeStatus;
  message: string;
  acknowledged: boolean;
  ackBy?: string;
  ackTime?: string;
}

export interface Alert {
  id: string;
  probeId: string;
  probeName: string;
  probeGroup: string;
  status: ProbeStatus;
  level: AlertLevel;
  message: string;
  startTime: string;
  endTime?: string;
  resolved: boolean;
  acknowledged: boolean;
  ackBy?: string;
  ackTime?: string;
  silenced: boolean;
  silencedUntil?: string;
  escalated: boolean;
  escalationTime?: string;
  duration?: string;
}

export interface Overview {
  total: number;
  up: number;
  down: number;
  disabled: number;
  unknown: number;
  alerts: number;
  groups: string[];
}

export interface CreateProbeRequest {
  name: string;
  type: ProbeType;
  target: string;
  interval?: number;
  timeout?: number;
  group?: string;
  enabled?: boolean;
  failureThreshold?: number;
  webhookUrl?: string;
}
