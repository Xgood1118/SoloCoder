import type { Task, ExecutionRecord } from '../../shared/types.js'
import { updateExecution } from '../repositories/executionRepository.js'
import { sendAlert } from './alertService.js'

const warnTimers = new Map<string, ReturnType<typeof setTimeout>>()
const forceTimers = new Map<string, ReturnType<typeof setTimeout>>()
const runningProcesses = new Map<string, { kill: (signal?: string) => void }>()

export function registerProcess(executionId: string, processHandle: { kill: (signal?: string) => void }): void {
  runningProcesses.set(executionId, processHandle)
}

export function unregisterProcess(executionId: string): void {
  runningProcesses.delete(executionId)
}

export function startTimeoutMonitor(
  task: Task,
  executionId: string,
  executionRecord: ExecutionRecord
): void {
  const timeoutPolicy = task.timeoutPolicy
  if (!timeoutPolicy) return

  cancelTimeoutMonitor(executionId)

  if (timeoutPolicy.warnTimeoutMs > 0 && timeoutPolicy.warnTimeoutMs < timeoutPolicy.forceTimeoutMs) {
    const warnTimer = setTimeout(async () => {
      await handleWarnTimeout(task, executionId, executionRecord)
    }, timeoutPolicy.warnTimeoutMs)
    warnTimers.set(executionId, warnTimer)
  }

  if (timeoutPolicy.forceTimeoutMs > 0) {
    const forceTimer = setTimeout(async () => {
      await handleForceTimeout(task, executionId, executionRecord)
    }, timeoutPolicy.forceTimeoutMs)
    forceTimers.set(executionId, forceTimer)
  }
}

export function cancelTimeoutMonitor(executionId: string): void {
  const warnTimer = warnTimers.get(executionId)
  if (warnTimer) {
    clearTimeout(warnTimer)
    warnTimers.delete(executionId)
  }

  const forceTimer = forceTimers.get(executionId)
  if (forceTimer) {
    clearTimeout(forceTimer)
    forceTimers.delete(executionId)
  }
}

async function handleWarnTimeout(
  task: Task,
  executionId: string,
  _executionRecord: ExecutionRecord
): Promise<void> {
  const policy = task.timeoutPolicy
  if (!policy) return

  const message = `Task '${task.name}' has been running for ${policy.warnTimeoutMs / 1000} seconds (warning timeout)`

  if (policy.onWarnAction === 'alert' || policy.onWarnAction === 'alert_and_continue') {
    await sendAlert(task, executionId, 'timeout_warn', message)
    await updateExecution(executionId, {
      output: _executionRecord.output + `\n[WARN] ${message}`
    })
  }
}

async function handleForceTimeout(
  task: Task,
  executionId: string,
  executionRecord: ExecutionRecord
): Promise<void> {
  const policy = task.timeoutPolicy
  if (!policy) return

  const message = `Task '${task.name}' exceeded force timeout of ${policy.forceTimeoutMs / 1000} seconds. Terminating.`

  const process = runningProcesses.get(executionId)
  if (process) {
    try {
      process.kill('SIGTERM')
    } catch (e) {
      console.error('Failed to kill process:', e)
    }
    unregisterProcess(executionId)
  }

  cancelTimeoutMonitor(executionId)

  const now = new Date().toISOString()
  const startTime = new Date(executionRecord.startTime || executionRecord.triggerTime).getTime()
  const durationMs = Date.now() - startTime

  await updateExecution(executionId, {
    status: policy.onForceAction === 'kill_and_retry' ? 'failed' : 'timeout',
    endTime: now,
    durationMs,
    error: message,
    output: executionRecord.output + `\n[FATAL] ${message}`
  })

  await sendAlert(task, executionId, 'timeout_force', message)

  if (policy.onForceAction === 'kill_and_retry') {
    const { scheduleRetry } = await import('./retryService.js')
    const updatedRecord = await updateExecution(executionId, {})
    if (updatedRecord) {
      await scheduleRetry(task, updatedRecord)
    }
  }
}
