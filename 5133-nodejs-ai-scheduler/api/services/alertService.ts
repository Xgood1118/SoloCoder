import fetch from 'node-fetch'
import nodemailer from 'nodemailer'
import type { Task, AlertRecord } from '../../shared/types.js'
import {
  createAlert,
  getChannels,
  updateAlertStatus
} from '../repositories/alertRepository.js'

type AlertType = AlertRecord['type']

export async function sendAlert(
  task: Task,
  executionId: string,
  alertType: AlertType,
  message: string
): Promise<AlertRecord | null> {
  const alertPolicy = task.alertPolicy
  if (!alertPolicy) return null

  let shouldSend = false
  if (alertType === 'timeout_warn' || alertType === 'timeout_force') {
    shouldSend = alertPolicy.onTimeout
  } else if (alertType === 'failure') {
    shouldSend = alertPolicy.onFailure
  } else if (alertType === 'retry') {
    shouldSend = alertPolicy.onRetry
  } else if (alertType === 'dependency_failed') {
    shouldSend = true
  }

  if (!shouldSend) return null

  const channels = alertPolicy.channels || []
  const alert = await createAlert({
    taskId: task.id,
    executionId,
    type: alertType,
    message,
    channels,
    taskName: task.name
  })

  const timestamp = new Date().toISOString()
  const payload = {
    taskId: task.id,
    taskName: task.name,
    executionId,
    alertType,
    message,
    timestamp,
    status: alert.status
  }

  if (channels.includes('webhook') && alertPolicy.webhookUrls?.length) {
    for (const url of alertPolicy.webhookUrls) {
      try {
        await sendWebhook(url, payload)
      } catch (e) {
        console.error(`Failed to send webhook to ${url}:`, e)
      }
    }
  }

  if (channels.includes('email') && alertPolicy.emailRecipients?.length) {
    try {
      const subject = `[TaskScheduler][${alertType.toUpperCase()}] ${task.name}`
      const body = `
Task: ${task.name} (ID: ${task.id})
Alert Type: ${alertType}
Message: ${message}
Execution ID: ${executionId}
Time: ${timestamp}

View details in TaskScheduler dashboard.
      `.trim()
      for (const recipient of alertPolicy.emailRecipients) {
        try {
          await sendEmail(recipient, subject, body)
        } catch (e) {
          console.error(`Failed to send email to ${recipient}:`, e)
        }
      }
    } catch (e) {
      console.error('Failed to send email:', e)
    }
  }

  try {
    await updateAlertStatus(alert.id, 'sent')
  } catch {}

  return alert
}

export async function sendWebhook(url: string, payload: unknown): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    timeout: 10000
  } as any)

  if (!response.ok) {
    throw new Error(`Webhook request failed with status ${response.status}`)
  }
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const channels = await getChannels()
  const emailChannel = channels.find(c => c.type === 'email' && c.enabled)

  if (!emailChannel || !emailChannel.emailSmtpHost || !emailChannel.emailUser || !emailChannel.emailPass) {
    console.warn('No email channel configured, using console output')
    console.log(`[EMAIL] To: ${to}\nSubject: ${subject}\nBody:\n${body}`)
    return
  }

  const transporter = nodemailer.createTransport({
    host: emailChannel.emailSmtpHost,
    port: emailChannel.emailSmtpPort || 587,
    secure: emailChannel.emailSmtpPort === 465,
    auth: {
      user: emailChannel.emailUser,
      pass: emailChannel.emailPass
    }
  })

  await transporter.sendMail({
    from: emailChannel.emailFrom || emailChannel.emailUser,
    to,
    subject,
    text: body
  })
}

export async function testChannel(channelId: string): Promise<{ success: boolean; error?: string }> {
  const channels = await getChannels()
  const channel = channels.find(c => c.id === channelId)

  if (!channel) {
    return { success: false, error: 'Channel not found' }
  }

  try {
    if (channel.type === 'webhook' && channel.webhookUrl) {
      await sendWebhook(channel.webhookUrl, {
        test: true,
        message: 'This is a test webhook from TaskScheduler',
        timestamp: new Date().toISOString()
      })
      return { success: true }
    } else if (channel.type === 'email') {
      const testRecipient = channel.emailUser || 'test@example.com'
      await sendEmail(testRecipient, 'TaskScheduler Test Email', 'This is a test email from TaskScheduler.')
      return { success: true }
    }
    return { success: false, error: 'Invalid channel configuration' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
