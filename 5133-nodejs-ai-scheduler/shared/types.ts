export interface RetryPolicy {
  maxRetries: number
  retryIntervalMs: number
  retryStrategy: 'fixed' | 'exponential'
  exponentialBase: number
}

export interface TimeoutPolicy {
  warnTimeoutMs: number
  forceTimeoutMs: number
  onWarnAction: 'alert' | 'alert_and_continue' | 'silent'
  onForceAction: 'kill_and_fail' | 'kill_and_retry'
}

export interface AlertPolicy {
  channels: ('webhook' | 'email')[]
  webhookUrls: string[]
  emailRecipients: string[]
  onTimeout: boolean
  onFailure: boolean
  onRetry: boolean
}

export interface Task {
  id: string
  name: string
  type: 'once' | 'cron' | 'interval'
  cronExpression?: string
  intervalSeconds?: number
  executorType: 'script' | 'http'
  scriptPath?: string
  httpUrl?: string
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  httpHeaders?: Record<string, string>
  httpBody?: string
  parameters?: Record<string, unknown>
  enabled: boolean
  retryPolicy: RetryPolicy
  timeoutPolicy: TimeoutPolicy
  alertPolicy: AlertPolicy
  dependencies: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface ExecutionRecord {
  id: string
  taskId: string
  taskName: string
  triggerTime: string
  startTime: string | null
  endTime: string | null
  status: 'running' | 'success' | 'failed' | 'timeout' | 'skipped'
  exitCode: number | null
  output: string
  error: string
  retryCount: number
  isRetry: boolean
  durationMs: number | null
}

export interface AlertRecord {
  id: string
  taskId: string
  taskName: string
  executionId: string
  type: 'timeout_warn' | 'timeout_force' | 'failure' | 'retry' | 'dependency_failed'
  message: string
  channels: string[]
  status: 'pending' | 'sent' | 'acknowledged'
  createdAt: string
}

export interface NotificationChannel {
  id: string
  type: 'webhook' | 'email'
  name: string
  webhookUrl?: string
  emailSmtpHost?: string
  emailSmtpPort?: number
  emailUser?: string
  emailPass?: string
  emailFrom?: string
  enabled: boolean
  createdAt: string
}

export interface SystemConfig {
  defaultTimeoutPolicy: TimeoutPolicy
  defaultRetryPolicy: RetryPolicy
  maxConcurrentTasks: number
}

export interface DashboardStats {
  totalTasks: number
  runningTasks: number
  successRate: number
  recentExecutions: ExecutionRecord[]
  pendingAlerts: number
}
