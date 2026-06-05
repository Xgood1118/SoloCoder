import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import fetch from 'node-fetch'
import type { Task, ExecutionRecord } from '../../shared/types.js'
import {
  createExecution,
  updateExecution,
  getExecutions
} from '../repositories/executionRepository.js'
import { getTaskById, getDependencies } from '../repositories/taskRepository.js'
import { checkDependenciesMet } from './dagService.js'
import { startTimeoutMonitor, cancelTimeoutMonitor, registerProcess, unregisterProcess } from './timeoutService.js'
import { shouldRetry, scheduleRetry } from './retryService.js'
import { sendAlert } from './alertService.js'
import { broadcastLog, broadcastExecutionUpdate, broadcastTaskStatus } from './websocket.js'

const activeExecutions = new Map<string, ChildProcessWithoutNullStreams>()
const runningCount = { value: 0 }

export async function executeTask(
  task: Task,
  isRetry: boolean = false,
  retryCount: number = 0
): Promise<ExecutionRecord | null> {
  const depCheck = await checkDependenciesMet(task.id)
  if (!depCheck.met) {
    let errorMsg = ''
    if (depCheck.failedDependencies?.length) {
      errorMsg = `Dependencies failed: ${depCheck.failedDependencies.join(', ')}`
    } else if (depCheck.pendingDependencies?.length) {
      errorMsg = `Dependencies not ready yet: ${depCheck.pendingDependencies.join(', ')}. Skipping this execution.`
    }

    const now = new Date().toISOString()
    const skippedRecord = await createExecution({
      taskId: task.id,
      taskName: task.name,
      triggerTime: now,
      startTime: now,
      endTime: now,
      status: 'skipped',
      exitCode: 0,
      output: `[SKIPPED] ${errorMsg}`,
      error: errorMsg,
      retryCount,
      isRetry,
      durationMs: 0
    })

    if (depCheck.failedDependencies?.length) {
      await sendAlert(task, skippedRecord.id, 'dependency_failed', errorMsg)
    }

    broadcastExecutionUpdate(skippedRecord as unknown as Record<string, unknown>)
    return skippedRecord
  }

  const now = new Date().toISOString()
  let executionRecord = await createExecution({
    taskId: task.id,
    taskName: task.name,
    triggerTime: now,
    startTime: null,
    endTime: null,
    status: 'running',
    exitCode: null,
    output: `[${new Date().toISOString()}] Task started (${isRetry ? `retry #${retryCount}` : 'initial run'})\n`,
    error: '',
    retryCount,
    isRetry,
    durationMs: null
  })

  broadcastTaskStatus(task.id, 'running', { executionId: executionRecord.id })
  broadcastExecutionUpdate(executionRecord as unknown as Record<string, unknown>)
  broadcastLog(executionRecord.id, executionRecord.output)

  runningCount.value++

  const startTime = Date.now()
  executionRecord = await updateExecution(executionRecord.id, {
    startTime: new Date(startTime).toISOString()
  }) || executionRecord

  startTimeoutMonitor(task, executionRecord.id, executionRecord)

  try {
    if (task.executorType === 'script') {
      await executeScript(task, executionRecord)
    } else if (task.executorType === 'http') {
      await executeHttp(task, executionRecord)
    }

    const endTime = Date.now()
    const durationMs = endTime - startTime

    executionRecord = await updateExecution(executionRecord.id, {
      endTime: new Date(endTime).toISOString(),
      durationMs,
      status: 'success',
      exitCode: 0
    }) || executionRecord

    broadcastLog(executionRecord.id, `\n[${new Date().toISOString()}] Task completed successfully in ${durationMs}ms`)
    broadcastTaskStatus(task.id, 'success', { executionId: executionRecord.id })
    broadcastExecutionUpdate(executionRecord as unknown as Record<string, unknown>)
  } catch (e: any) {
    const endTime = Date.now()
    const durationMs = endTime - startTime

    const finalRecord = await getExecutions({ taskId: task.id })
    const current = finalRecord[0]?.id === executionRecord.id ? finalRecord[0] : executionRecord

    if (current.status === 'running') {
      executionRecord = await updateExecution(executionRecord.id, {
        endTime: new Date(endTime).toISOString(),
        durationMs,
        status: 'failed',
        exitCode: e.code || 1,
        error: e.message || 'Unknown error',
        output: current.output + `\n[ERROR] ${e.message || 'Unknown error'}`
      }) || executionRecord

      broadcastLog(executionRecord.id, `\n[ERROR] ${e.message || 'Unknown error'}`)
    } else {
      executionRecord = current
    }

    if (executionRecord.status === 'failed') {
      broadcastTaskStatus(task.id, 'failed', { executionId: executionRecord.id })
      broadcastExecutionUpdate(executionRecord as unknown as Record<string, unknown>)

      if (shouldRetry(task, executionRecord)) {
        await scheduleRetry(task, executionRecord)
      } else {
        await sendAlert(task, executionRecord.id, 'failure', `Task '${task.name}' failed: ${executionRecord.error || 'Unknown error'}`)
      }
    } else if (executionRecord.status === 'timeout') {
      broadcastTaskStatus(task.id, 'timeout', { executionId: executionRecord.id })
      broadcastExecutionUpdate(executionRecord as unknown as Record<string, unknown>)
    }
  } finally {
    cancelTimeoutMonitor(executionRecord.id)
    unregisterProcess(executionRecord.id)
    activeExecutions.delete(executionRecord.id)
    runningCount.value = Math.max(0, runningCount.value - 1)

    if (task.type === 'once' && !isRetry && executionRecord.status !== 'failed') {
      const { toggleTask } = await import('../repositories/taskRepository.js')
      await toggleTask(task.id)
    }
  }

  return executionRecord
}

async function executeScript(task: Task, executionRecord: ExecutionRecord): Promise<void> {
  if (!task.scriptPath) {
    throw new Error('Script path not configured')
  }

  const params = task.parameters || {}
  const args = Object.entries(params).map(([k, v]) => `--${k}=${v}`)

  const child = spawn(task.scriptPath, args, {
    shell: true,
    env: {
      ...process.env,
      TASK_ID: task.id,
      TASK_NAME: task.name,
      EXECUTION_ID: executionRecord.id
    }
  })

  activeExecutions.set(executionRecord.id, child)
  registerProcess(executionRecord.id, { kill: (signal?: string) => child.kill(signal as NodeJS.Signals) })

  let output = executionRecord.output

  child.stdout.on('data', async (data: Buffer) => {
    const chunk = data.toString()
    output += chunk
    broadcastLog(executionRecord.id, chunk)
    await updateExecution(executionRecord.id, { output })
  })

  child.stderr.on('data', async (data: Buffer) => {
    const chunk = data.toString()
    output += chunk
    broadcastLog(executionRecord.id, chunk)
    await updateExecution(executionRecord.id, { output })
  })

  return new Promise((resolve, reject) => {
    child.on('exit', (code) => {
      activeExecutions.delete(executionRecord.id)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Script exited with code ${code}`))
      }
    })

    child.on('error', (err) => {
      activeExecutions.delete(executionRecord.id)
      reject(err)
    })
  })
}

async function executeHttp(task: Task, executionRecord: ExecutionRecord): Promise<void> {
  if (!task.httpUrl) {
    throw new Error('HTTP URL not configured')
  }

  const params = task.parameters || {}
  let url = task.httpUrl

  if (Object.keys(params).length > 0 && task.httpMethod === 'GET') {
    const urlParams = new URLSearchParams(params as Record<string, string>)
    url += (url.includes('?') ? '&' : '?') + urlParams.toString()
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...task.httpHeaders
  }

  const body = task.httpMethod !== 'GET' && Object.keys(params).length > 0
    ? JSON.stringify(params)
    : task.httpBody || undefined

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), task.timeoutPolicy?.forceTimeoutMs || 300000)

  const abortHandle = {
    kill: () => {
      try {
        controller.abort()
      } catch {}
    }
  }
  registerProcess(executionRecord.id, abortHandle)

  let output = executionRecord.output
  output += `\n[${new Date().toISOString()}] Calling ${task.httpMethod} ${url}\n`
  output += `[${new Date().toISOString()}] Headers: ${JSON.stringify(headers)}\n`
  if (body) {
    output += `[${new Date().toISOString()}] Body: ${body}\n`
  }
  broadcastLog(executionRecord.id, output)
  await updateExecution(executionRecord.id, { output })

  try {
    const response = await fetch(url, {
      method: task.httpMethod || 'GET',
      headers,
      body,
      signal: controller.signal as any
    })

    clearTimeout(timeoutId)

    const responseBody = await response.text()
    output += `\n[${new Date().toISOString()}] Response Status: ${response.status}\n`
    output += `[${new Date().toISOString()}] Response Body: ${responseBody}\n`
    broadcastLog(executionRecord.id, `Response Status: ${response.status}\nResponse Body: ${responseBody}`)
    await updateExecution(executionRecord.id, { output })

    if (!response.ok) {
      throw new Error(`HTTP request failed with status ${response.status}`)
    }
  } catch (e: any) {
    clearTimeout(timeoutId)
    throw e
  } finally {
    unregisterProcess(executionRecord.id)
  }
}

export async function triggerTask(taskId: string): Promise<ExecutionRecord | null> {
  const task = await getTaskById(taskId)
  if (!task) {
    throw new Error('Task not found')
  }
  if (!task.enabled) {
    throw new Error('Task is disabled')
  }
  return executeTask(task, false, 0)
}

export function getActiveExecutionCount(): number {
  return runningCount.value
}
