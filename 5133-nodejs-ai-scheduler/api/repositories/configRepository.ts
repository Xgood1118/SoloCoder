import { queryAll, queryOne, run } from '../database.js'
import type { SystemConfig, TimeoutPolicy, RetryPolicy } from '../../shared/types.js'

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function getAllConfig(): Promise<SystemConfig> {
  const rows = queryAll(`SELECT key, value FROM system_config`, [])
  const config: Record<string, unknown> = {}

  for (const row of rows) {
    const key = row.key as string
    const value = row.value as string

    if (key === 'defaultTimeoutPolicy') {
      config.defaultTimeoutPolicy = parseJson<TimeoutPolicy>(value) || {
        warnTimeoutMs: 300000,
        forceTimeoutMs: 1800000,
        onWarnAction: 'alert',
        onForceAction: 'kill_and_fail'
      }
    } else if (key === 'defaultRetryPolicy') {
      config.defaultRetryPolicy = parseJson<RetryPolicy>(value) || {
        maxRetries: 3,
        retryIntervalMs: 60000,
        retryStrategy: 'fixed',
        exponentialBase: 2
      }
    } else if (key === 'maxConcurrentTasks') {
      config.maxConcurrentTasks = parseInt(value) || 10
    } else {
      try {
        config[key] = JSON.parse(value)
      } catch {
        config[key] = value
      }
    }
  }

  return config as unknown as SystemConfig
}

export async function getConfig(key: string): Promise<unknown | null> {
  const row = queryOne(`SELECT value FROM system_config WHERE key = ?`, [key])
  if (!row) return null

  const value = row.value as string
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  const now = new Date().toISOString()
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)

  run(
    `INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, serialized, now]
  )
}

export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  const now = new Date().toISOString()

  if (config.defaultTimeoutPolicy !== undefined) {
    await setConfig('defaultTimeoutPolicy', config.defaultTimeoutPolicy)
  }
  if (config.defaultRetryPolicy !== undefined) {
    await setConfig('defaultRetryPolicy', config.defaultRetryPolicy)
  }
  if (config.maxConcurrentTasks !== undefined) {
    await setConfig('maxConcurrentTasks', config.maxConcurrentTasks.toString())
  }

  return getAllConfig()
}
