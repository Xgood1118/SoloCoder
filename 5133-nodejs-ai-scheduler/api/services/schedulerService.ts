import cron from 'node-cron'
import type { Task } from '../../shared/types.js'
import { getTasks, getTaskById, toggleTask } from '../repositories/taskRepository.js'
import { executeTask, getActiveExecutionCount } from './executorService.js'
import { getAllConfig } from '../repositories/configRepository.js'

interface ScheduledTask {
  taskId: string
  cronJob?: cron.ScheduledTask
  intervalId?: ReturnType<typeof setInterval>
  onceTimeout?: ReturnType<typeof setTimeout>
}

const scheduledTasks = new Map<string, ScheduledTask>()
let isRunning = false

export async function initialize(): Promise<void> {
  const tasks = await getTasks({ status: 'enabled' })
  for (const task of tasks) {
    if (task.enabled) {
      registerTask(task)
    }
  }
  isRunning = true
  console.log(`Scheduler initialized with ${scheduledTasks.size} tasks`)
}

export function registerTask(task: Task): void {
  unregisterTask(task.id)

  if (!task.enabled) return

  const scheduled: ScheduledTask = { taskId: task.id }

  if (task.type === 'cron' && task.cronExpression) {
    try {
      const job = cron.schedule(task.cronExpression, async () => {
        await runScheduledTask(task.id)
      })
      scheduled.cronJob = job
    } catch (e) {
      console.error(`Failed to register cron task ${task.id}:`, e)
    }
  } else if (task.type === 'interval' && task.intervalSeconds) {
    const intervalMs = task.intervalSeconds * 1000
    const intervalId = setInterval(async () => {
      await runScheduledTask(task.id)
    }, intervalMs)
    scheduled.intervalId = intervalId
  } else if (task.type === 'once') {
    console.log(`One-time task ${task.id} registered, waiting for manual trigger`)
  }

  scheduledTasks.set(task.id, scheduled)
}

export function unregisterTask(taskId: string): void {
  const scheduled = scheduledTasks.get(taskId)
  if (scheduled) {
    if (scheduled.cronJob) {
      scheduled.cronJob.stop()
    }
    if (scheduled.intervalId) {
      clearInterval(scheduled.intervalId)
    }
    if (scheduled.onceTimeout) {
      clearTimeout(scheduled.onceTimeout)
    }
    scheduledTasks.delete(taskId)
  }
}

async function runScheduledTask(taskId: string): Promise<void> {
  try {
    const config = await getAllConfig()
    const maxConcurrent = config.maxConcurrentTasks || 10
    const activeCount = getActiveExecutionCount()

    if (activeCount >= maxConcurrent) {
      console.log(`Max concurrent tasks (${maxConcurrent}) reached, skipping task ${taskId}`)
      return
    }

    const task = await getTaskById(taskId)
    if (!task || !task.enabled) {
      unregisterTask(taskId)
      return
    }

    await executeTask(task, false, 0)
  } catch (e) {
    console.error(`Error running scheduled task ${taskId}:`, e)
  }
}

export function start(): void {
  for (const [, scheduled] of scheduledTasks) {
    if (scheduled.cronJob) {
      scheduled.cronJob.start()
    }
  }
  isRunning = true
  console.log('Scheduler started')
}

export function stop(): void {
  for (const [, scheduled] of scheduledTasks) {
    if (scheduled.cronJob) {
      scheduled.cronJob.stop()
    }
    if (scheduled.intervalId) {
      clearInterval(scheduled.intervalId)
    }
    if (scheduled.onceTimeout) {
      clearTimeout(scheduled.onceTimeout)
    }
  }
  isRunning = false
  console.log('Scheduler stopped')
}

export async function triggerTask(taskId: string): Promise<void> {
  const task = await getTaskById(taskId)
  if (!task) {
    throw new Error('Task not found')
  }
  if (!task.enabled) {
    await toggleTask(taskId)
  }
  await runScheduledTask(taskId)
}

export function getScheduledTaskIds(): string[] {
  return Array.from(scheduledTasks.keys())
}

export function isSchedulerRunning(): boolean {
  return isRunning
}

export async function reloadTask(taskId: string): Promise<void> {
  const task = await getTaskById(taskId)
  if (task) {
    registerTask(task)
  }
}
