import express from 'express'
import type { Task } from '../../shared/types.js'
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  toggleTask
} from '../repositories/taskRepository.js'
import { validateDAG } from '../services/dagService.js'
import { triggerTask } from '../services/executorService.js'
import { reloadTask, unregisterTask } from '../services/schedulerService.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const filter = {
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      search: req.query.search as string | undefined
    }
    const tasks = await getTasks(filter)
    res.json(tasks)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const task = await getTaskById(req.params.id)
    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }
    res.json(task)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const data = req.body as Partial<Task>

    if (!data.name || !data.type || !data.executorType) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const allTasks = await getTasks()
    const tempTask = { id: 'temp', dependencies: data.dependencies || [] } as Task
    const existingTasks = allTasks

    const validation = validateDAG(
      data.dependencies?.length ? 'new' : '',
      data.dependencies || [],
      existingTasks
    )

    if (!validation.valid) {
      return res.status(400).json({ error: validation.message, cycle: validation.cycle })
    }

    const task = await createTask({
      name: data.name,
      type: data.type,
      cronExpression: data.cronExpression,
      intervalSeconds: data.intervalSeconds,
      executorType: data.executorType,
      scriptPath: data.scriptPath,
      httpUrl: data.httpUrl,
      httpMethod: data.httpMethod || 'GET',
      httpHeaders: data.httpHeaders || {},
      httpBody: data.httpBody,
      parameters: data.parameters || {},
      enabled: data.enabled ?? true,
      retryPolicy: data.retryPolicy || {
        maxRetries: 3,
        retryIntervalMs: 60000,
        retryStrategy: 'fixed',
        exponentialBase: 2
      },
      timeoutPolicy: data.timeoutPolicy || {
        warnTimeoutMs: 300000,
        forceTimeoutMs: 1800000,
        onWarnAction: 'alert',
        onForceAction: 'kill_and_fail'
      },
      alertPolicy: data.alertPolicy || {
        channels: ['webhook'],
        webhookUrls: [],
        emailRecipients: [],
        onTimeout: true,
        onFailure: true,
        onRetry: false
      },
      dependencies: data.dependencies || [],
      createdBy: data.createdBy || 'admin'})

    if (task.enabled) {
      await reloadTask(task.id)
    }

    res.status(201).json(task)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const taskId = req.params.id
    const existing = await getTaskById(taskId)
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const data = req.body as Partial<Task>

    if (data.dependencies !== undefined) {
      const allTasks = await getTasks()
      const validation = validateDAG(taskId, data.dependencies, allTasks)
      if (!validation.valid) {
        return res.status(400).json({ error: validation.message, cycle: validation.cycle })
      }
    }

    const updated = await updateTask(taskId, data)
    if (updated) {
      if (data.enabled !== undefined || data.type !== undefined || data.cronExpression !== undefined || data.intervalSeconds !== undefined) {
        if (updated.enabled) {
          await reloadTask(taskId)
        } else {
          unregisterTask(taskId)
        }
      }
    }

    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const existing = await getTaskById(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' })
    }
    unregisterTask(req.params.id)
    await deleteTask(req.params.id)
    res.status(204).send()
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:id/toggle', async (req, res) => {
  try {
    const existing = await getTaskById(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const updated = await toggleTask(req.params.id)
    if (updated) {
      if (updated.enabled) {
        await reloadTask(updated.id)
      } else {
        unregisterTask(updated.id)
      }
    }

    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:id/trigger', async (req, res) => {
  try {
    const existing = await getTaskById(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const execution = await triggerTask(req.params.id)
    res.json({ message: 'Task triggered', execution })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
