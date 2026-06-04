export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogOutputTarget = 'console' | 'file' | 'remote';

export type ConfigFormat = 'json' | 'yaml';

export interface LogConfig {
  level: LogLevel;
  targets: LogOutputTarget[];
  filePath?: string;
  remoteEndpoint?: string;
  remoteApiKey?: string;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

export interface HttpClientConfig {
  baseUrl: string;
  timeoutMs: number;
  defaultHeaders: Record<string, string>;
  keepAlive: boolean;
  keepAliveMsecs: number;
  maxSockets: number;
  maxFreeSockets: number;
}

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  idleTimeoutMs: number;
  acquireTimeoutMs: number;
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  path: string;
}

export interface SdkConfig {
  serviceName: string;
  environment: string;
  log: LogConfig;
  retry: RetryConfig;
  httpClient: HttpClientConfig;
  connectionPool: ConnectionPoolConfig;
  healthCheck: HealthCheckConfig;
}

export type ConfigSource = 'environment' | 'cli' | 'file' | 'programmatic';

export interface ConfigLoadOptions {
  configPath?: string;
  format?: ConfigFormat;
  prefix?: string;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  retryConfig?: Partial<RetryConfig>;
}

export interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  requestId: string;
}

export interface ErrorCategory {
  code: string;
  message: string;
  retryable: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  timestamp: string;
  details: {
    [key: string]: {
      healthy: boolean;
      latencyMs?: number;
      error?: string;
    };
  };
}

export interface ConnectionInfo {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
}
