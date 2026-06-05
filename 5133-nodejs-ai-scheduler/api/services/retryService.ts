import type { Task, ExecutionRecord, RetryPolicy } from '../../shared/types.js'
import { updateExecution } from '../repositories/executionRepository.js'
import { sendAlert } from './alertService.js'

export function shouldRetry(
  task: Task,
  executionRecord: ExecutionRecord
): boolean {
  const retryPolicy = task.retryPolicy
  if (!retryPolicy) return false
  if (retryPolicy.maxRetries <= 0) return false
  if (executionRecord.retryCount >= retryPolicy.maxRetries) return false
  if (executionRecord.status === 'success') return false
  return true
}

export function calculateRetryDelay(
  retryPolicy: RetryPolicy,
  retryCount: number
): number {
  if (retryPolicy.retryStrategy === 'exponential') {
    const base = retryPolicy.exponentialBase || 2
    return retryPolicy.retryIntervalMs * Math.pow(base, retryCount)
  }
  return retryPolicy.retryIntervalMs
}

export async function scheduleRetry(
  task: Task,
  executionRecord: ExecutionRecord
): Promise<void> {
  if (!shouldRetry(task, executionRecord)) {
    return
  }

  const delay = calculateRetryDelay(task.retryPolicy, executionRecord.retryCount)
  const nextRetryCount = executionRecord.retryCount + 1

  const message = `Scheduling retry #${nextRetryCount} for task '${task.name}' in ${delay / 1000} seconds. Max retries: ${task.retryPolicy.maxRetries}.`

  await updateExecution(executionRecord.id, {
    output: executionRecord.output + `\n[RETRY] ${message}`
  })

  await sendAlert(task, executionRecord.id, 'retry', message)

  setTimeout(async () => {
    const { executeTask } = await import('./executorService.js')
    await executeTask(task, true, nextRetryCount)
  }, delay)
}
