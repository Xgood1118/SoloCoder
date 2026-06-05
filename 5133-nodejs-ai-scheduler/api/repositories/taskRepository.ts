import { v4 as uuidv4 } from 'uuid'
import { queryAll, queryOne, run } from '../database.js'
import type { Task, RetryPolicy, TimeoutPolicy, AlertPolicy } from '../../shared/types.js'

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function mapTaskRow(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as Task['type'],
    cronExpression: row.cron_expression as string | undefined,
    intervalSeconds: row.interval_seconds as number | undefined,
    executorType: row.executor_type as Task['executorType'],
    scriptPath: row.script_path as string | undefined,
    httpUrl: row.http_url as string | undefined,
    httpMethod: row.http_method as Task['httpMethod'] | undefined,
    httpHeaders: parseJson<Record<string, string>>(row.http_headers as string) || {},
    httpBody: row.http_body as string | undefined,
    parameters: parseJson<Record<string, unknown>>(row.parameters as string) || {},
    enabled: row.enabled === 1,
    retryPolicy: parseJson<RetryPolicy>(row.retry_policy as string) || {
      maxRetries: 3,
      retryIntervalMs: 60000,
      retryStrategy: 'fixed',
      exponentialBase: 2
    },
    timeoutPolicy: parseJson<TimeoutPolicy>(row.timeout_policy as string) || {
      warnTimeoutMs: 300000,
      forceTimeoutMs: 1800000,
      onWarnAction: 'alert',
      onForceAction: 'kill_and_fail'
    },
    alertPolicy: parseJson<AlertPolicy>(row.alert_policy as string) || {
      channels: ['webhook'],
      webhookUrls: [],
      emailRecipients: [],
      onTimeout: true,
      onFailure: true,
      onRetry: false
    },
    dependencies: [],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

export async function getTasks(filter?: { status?: string; type?: string; search?: string }): Promise<Task[]> {
  let sql = `SELECT t.* FROM tasks t WHERE 1=1`
  const params: unknown[] = []

  if (filter?.type) {
    sql += ` AND t.type = ?`
    params.push(filter.type)
  }
  if (filter?.status === 'enabled') {
    sql += ` AND t.enabled = 1`
  } else if (filter?.status === 'disabled') {
    sql += ` AND t.enabled = 0`
  }
  if (filter?.search) {
    sql += ` AND t.name LIKE ?`
    params.push(`%${filter.search}%`)
  }

  sql += ` ORDER BY t.created_at DESC`

  const rows = queryAll(sql, params)
  const tasks = rows.map(mapTaskRow)

  for (const task of tasks) {
    task.dependencies = await getDependencies(task.id)
  }

  return tasks
}

export async function getTaskById(id: string): Promise<Task | null> {
  const row = queryOne(`SELECT * FROM tasks WHERE id = ?`, [id])
  if (!row) return null
  const task = mapTaskRow(row)
  task.dependencies = await getDependencies(id)
  return task
}

export async function createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
  const id = uuidv4()
  const now = new Date().toISOString()

  run(
    `INSERT INTO tasks (
      id, name, type, cron_expression, interval_seconds, executor_type,
      script_path, http_url, http_method, http_headers, http_body, parameters,
      enabled, retry_policy, timeout_policy, alert_policy, created_by,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.type,
      data.cronExpression || null,
      data.intervalSeconds || null,
      data.executorType,
      data.scriptPath || null,
      data.httpUrl || null,
      data.httpMethod || 'GET',
      JSON.stringify(data.httpHeaders || {}),
      data.httpBody || null,
      JSON.stringify(data.parameters || {}),
      data.enabled ? 1 : 0,
      JSON.stringify(data.retryPolicy),
      JSON.stringify(data.timeoutPolicy),
      JSON.stringify(data.alertPolicy),
      data.createdBy || 'admin',
      now,
      now
    ]
  )

  if (data.dependencies && data.dependencies.length > 0) {
    await setDependencies(id, data.dependencies)
  }

  const created = await getTaskById(id)
  if (!created) throw new Error('Failed to create task')
  return created
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task | null> {
  const now = new Date().toISOString()
  const fields: string[] = []
  const params: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
  if (data.type !== undefined) { fields.push('type = ?'); params.push(data.type) }
  if (data.cronExpression !== undefined) { fields.push('cron_expression = ?'); params.push(data.cronExpression || null) }
  if (data.intervalSeconds !== undefined) { fields.push('interval_seconds = ?'); params.push(data.intervalSeconds || null) }
  if (data.executorType !== undefined) { fields.push('executor_type = ?'); params.push(data.executorType) }
  if (data.scriptPath !== undefined) { fields.push('script_path = ?'); params.push(data.scriptPath || null) }
  if (data.httpUrl !== undefined) { fields.push('http_url = ?'); params.push(data.httpUrl || null) }
  if (data.httpMethod !== undefined) { fields.push('http_method = ?'); params.push(data.httpMethod || null) }
  if (data.httpHeaders !== undefined) { fields.push('http_headers = ?'); params.push(JSON.stringify(data.httpHeaders || {})) }
  if (data.httpBody !== undefined) { fields.push('http_body = ?'); params.push(data.httpBody || null) }
  if (data.parameters !== undefined) { fields.push('parameters = ?'); params.push(JSON.stringify(data.parameters || {})) }
  if (data.enabled !== undefined) { fields.push('enabled = ?'); params.push(data.enabled ? 1 : 0) }
  if (data.retryPolicy !== undefined) { fields.push('retry_policy = ?'); params.push(JSON.stringify(data.retryPolicy)) }
  if (data.timeoutPolicy !== undefined) { fields.push('timeout_policy = ?'); params.push(JSON.stringify(data.timeoutPolicy)) }
  if (data.alertPolicy !== undefined) { fields.push('alert_policy = ?'); params.push(JSON.stringify(data.alertPolicy)) }

  fields.push('updated_at = ?')
  params.push(now, id)

  run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params)

  if (data.dependencies !== undefined) {
    await setDependencies(id, data.dependencies)
  }

  return getTaskById(id)
}

export async function deleteTask(id: string): Promise<void> {
  run(`DELETE FROM tasks WHERE id = ?`, [id])
}

export async function toggleTask(id: string): Promise<Task | null> {
  run(`UPDATE tasks SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    id
  ])
  return getTaskById(id)
}

export async function getDependencies(taskId: string): Promise<string[]> {
  const rows = queryAll(
    `SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?`,
    [taskId]
  )
  return rows.map(r => r.depends_on_task_id as string)
}

export async function setDependencies(taskId: string, dependsOnIds: string[]): Promise<void> {
  run(`DELETE FROM task_dependencies WHERE task_id = ?`, [taskId])

  for (const depId of dependsOnIds) {
    if (depId === taskId) continue
    try {
      run(
        `INSERT INTO task_dependencies (id, task_id, depends_on_task_id) VALUES (?, ?, ?)`,
        [uuidv4(), taskId, depId]
      )
    } catch {
    }
  }
}

export async function getAllDependenciesMap(): Promise<Map<string, string[]>> {
  const rows = queryAll(`SELECT task_id, depends_on_task_id FROM task_dependencies`)
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const taskId = row.task_id as string
    const depId = row.depends_on_task_id as string
    if (!map.has(taskId)) {
      map.set(taskId, [])
    }
    map.get(taskId)!.push(depId)
  }
  return map
}
