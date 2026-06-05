import { v4 as uuidv4 } from 'uuid'
import { queryAll, queryOne, run } from '../database.js'
import type { AlertRecord, NotificationChannel } from '../../shared/types.js'

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function mapAlertRow(row: Record<string, unknown>): AlertRecord {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    taskName: row.task_name as string,
    executionId: row.execution_id as string,
    type: row.type as AlertRecord['type'],
    message: row.message as string,
    channels: parseJsonArray<string>(row.channels as string),
    status: row.status as AlertRecord['status'],
    createdAt: row.created_at as string
  }
}

function mapChannelRow(row: Record<string, unknown>): NotificationChannel {
  return {
    id: row.id as string,
    type: row.type as NotificationChannel['type'],
    name: row.name as string,
    webhookUrl: row.webhook_url as string | undefined,
    emailSmtpHost: row.email_smtp_host as string | undefined,
    emailSmtpPort: row.email_smtp_port as number | undefined,
    emailUser: row.email_user as string | undefined,
    emailPass: row.email_pass as string | undefined,
    emailFrom: row.email_from as string | undefined,
    enabled: row.enabled === 1,
    createdAt: row.created_at as string
  }
}

export async function getAlerts(filter?: { status?: string; type?: string }): Promise<AlertRecord[]> {
  let sql = `SELECT ar.*, t.name as task_name FROM alert_records ar JOIN tasks t ON ar.task_id = t.id WHERE 1=1`
  const params: unknown[] = []

  if (filter?.status) {
    sql += ` AND ar.status = ?`
    params.push(filter.status)
  }
  if (filter?.type) {
    sql += ` AND ar.type = ?`
    params.push(filter.type)
  }

  sql += ` ORDER BY ar.created_at DESC LIMIT 500`

  const rows = queryAll(sql, params)
  return rows.map(mapAlertRow)
}

export async function createAlert(data: Omit<AlertRecord, 'id' | 'status' | 'createdAt' | 'taskName'> & { taskName?: string }): Promise<AlertRecord> {
  const id = uuidv4()
  const now = new Date().toISOString()

  run(
    `INSERT INTO alert_records (id, task_id, execution_id, type, message, channels, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.taskId,
      data.executionId || null,
      data.type,
      data.message,
      JSON.stringify(data.channels || []),
      'pending',
      now
    ]
  )

  const created = await getAlertById(id)
  if (!created) throw new Error('Failed to create alert')
  return created
}

export async function getAlertById(id: string): Promise<AlertRecord | null> {
  const row = queryOne(
    `SELECT ar.*, t.name as task_name FROM alert_records ar JOIN tasks t ON ar.task_id = t.id WHERE ar.id = ?`,
    [id]
  )
  return row ? mapAlertRow(row) : null
}

export async function acknowledgeAlert(id: string): Promise<AlertRecord | null> {
  run(`UPDATE alert_records SET status = 'acknowledged' WHERE id = ?`, [id])
  return getAlertById(id)
}

export async function updateAlertStatus(id: string, status: AlertRecord['status']): Promise<void> {
  run(`UPDATE alert_records SET status = ? WHERE id = ?`, [status, id])
}

export async function getPendingAlertsCount(): Promise<number> {
  const row = queryOne(
    `SELECT COUNT(*) as count FROM alert_records WHERE status = 'pending'`,
    []
  )
  return row ? (row.count as number) : 0
}

export async function getChannels(): Promise<NotificationChannel[]> {
  const rows = queryAll(`SELECT * FROM notification_channels ORDER BY created_at DESC`)
  return rows.map(mapChannelRow)
}

export async function getChannelById(id: string): Promise<NotificationChannel | null> {
  const row = queryOne(`SELECT * FROM notification_channels WHERE id = ?`, [id])
  return row ? mapChannelRow(row) : null
}

export async function createChannel(data: Omit<NotificationChannel, 'id' | 'createdAt'>): Promise<NotificationChannel> {
  const id = uuidv4()
  const now = new Date().toISOString()

  run(
    `INSERT INTO notification_channels (
      id, type, name, webhook_url, email_smtp_host, email_smtp_port,
      email_user, email_pass, email_from, enabled, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.type,
      data.name,
      data.webhookUrl || null,
      data.emailSmtpHost || null,
      data.emailSmtpPort || null,
      data.emailUser || null,
      data.emailPass || null,
      data.emailFrom || null,
      data.enabled ? 1 : 0,
      now
    ]
  )

  const created = await getChannelById(id)
  if (!created) throw new Error('Failed to create channel')
  return created
}

export async function updateChannel(id: string, data: Partial<NotificationChannel>): Promise<NotificationChannel | null> {
  const fields: string[] = []
  const params: unknown[] = []

  if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
  if (data.webhookUrl !== undefined) { fields.push('webhook_url = ?'); params.push(data.webhookUrl || null) }
  if (data.emailSmtpHost !== undefined) { fields.push('email_smtp_host = ?'); params.push(data.emailSmtpHost || null) }
  if (data.emailSmtpPort !== undefined) { fields.push('email_smtp_port = ?'); params.push(data.emailSmtpPort || null) }
  if (data.emailUser !== undefined) { fields.push('email_user = ?'); params.push(data.emailUser || null) }
  if (data.emailPass !== undefined) { fields.push('email_pass = ?'); params.push(data.emailPass || null) }
  if (data.emailFrom !== undefined) { fields.push('email_from = ?'); params.push(data.emailFrom || null) }
  if (data.enabled !== undefined) { fields.push('enabled = ?'); params.push(data.enabled ? 1 : 0) }

  params.push(id)

  run(`UPDATE notification_channels SET ${fields.join(', ')} WHERE id = ?`, params)

  return getChannelById(id)
}

export async function deleteChannel(id: string): Promise<void> {
  run(`DELETE FROM notification_channels WHERE id = ?`, [id])
}
