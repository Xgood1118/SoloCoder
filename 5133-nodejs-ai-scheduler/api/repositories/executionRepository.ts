import { v4 as uuidv4 } from 'uuid'
import { queryAll, queryOne, run } from '../database.js'
import type { ExecutionRecord } from '../../shared/types.js'

function mapExecutionRow(row: Record<string, unknown>): ExecutionRecord {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    taskName: row.task_name as string,
    triggerTime: row.trigger_time as string,
    startTime: row.start_time as string | null,
    endTime: row.end_time as string | null,
    status: row.status as ExecutionRecord['status'],
    exitCode: row.exit_code as number | null,
    output: row.output as string,
    error: row.error as string,
    retryCount: row.retry_count as number,
    isRetry: row.is_retry === 1,
    durationMs: row.duration_ms as number | null
  }
}

export async function getExecutions(filter?: {
  taskId?: string
  status?: string
  from?: string
  to?: string
}): Promise<ExecutionRecord[]> {
  let sql = `SELECT * FROM execution_records WHERE 1=1`
  const params: unknown[] = []

  if (filter?.taskId) {
    sql += ` AND task_id = ?`
    params.push(filter.taskId)
  }
  if (filter?.status) {
    sql += ` AND status = ?`
    params.push(filter.status)
  }
  if (filter?.from) {
    sql += ` AND trigger_time >= ?`
    params.push(filter.from)
  }
  if (filter?.to) {
    sql += ` AND trigger_time <= ?`
    params.push(filter.to)
  }

  sql += ` ORDER BY trigger_time DESC LIMIT 1000`

  const rows = queryAll(sql, params)
  return rows.map(mapExecutionRow)
}

export async function getExecutionById(id: string): Promise<ExecutionRecord | null> {
  const row = queryOne(`SELECT * FROM execution_records WHERE id = ?`, [id])
  return row ? mapExecutionRow(row) : null
}

export async function createExecution(data: Omit<ExecutionRecord, 'id'>): Promise<ExecutionRecord> {
  const id = uuidv4()

  run(
    `INSERT INTO execution_records (
      id, task_id, task_name, trigger_time, start_time, end_time, status,
      exit_code, output, error, retry_count, is_retry, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.taskId,
      data.taskName,
      data.triggerTime,
      data.startTime || null,
      data.endTime || null,
      data.status,
      data.exitCode || null,
      data.output || '',
      data.error || '',
      data.retryCount || 0,
      data.isRetry ? 1 : 0,
      data.durationMs || null
    ]
  )

  const created = await getExecutionById(id)
  if (!created) throw new Error('Failed to create execution')
  return created
}

export async function updateExecution(
  id: string,
  data: Partial<Omit<ExecutionRecord, 'id' | 'taskId' | 'taskName' | 'triggerTime' | 'retryCount' | 'isRetry'>>
): Promise<ExecutionRecord | null> {
  const fields: string[] = []
  const params: unknown[] = []

  if (data.startTime !== undefined) { fields.push('start_time = ?'); params.push(data.startTime || null) }
  if (data.endTime !== undefined) { fields.push('end_time = ?'); params.push(data.endTime || null) }
  if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status) }
  if (data.exitCode !== undefined) { fields.push('exit_code = ?'); params.push(data.exitCode ?? null) }
  if (data.output !== undefined) { fields.push('output = ?'); params.push(data.output || '') }
  if (data.error !== undefined) { fields.push('error = ?'); params.push(data.error || '') }
  if (data.durationMs !== undefined) { fields.push('duration_ms = ?'); params.push(data.durationMs ?? null) }

  params.push(id)

  run(`UPDATE execution_records SET ${fields.join(', ')} WHERE id = ?`, params)

  return getExecutionById(id)
}

export async function getRecentExecutions(limit: number = 20): Promise<ExecutionRecord[]> {
  const rows = queryAll(
    `SELECT * FROM execution_records ORDER BY trigger_time DESC LIMIT ?`,
    [limit]
  )
  return rows.map(mapExecutionRow)
}

export async function getRunningExecutionsCount(): Promise<number> {
  const row = queryOne(
    `SELECT COUNT(*) as count FROM execution_records WHERE status = 'running'`,
    []
  )
  return row ? (row.count as number) : 0
}
