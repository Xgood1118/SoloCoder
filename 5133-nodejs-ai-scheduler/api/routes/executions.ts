import express from 'express'
import {
  getExecutions,
  getExecutionById,
  getRecentExecutions
} from '../repositories/executionRepository.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const filter = {
      taskId: req.query.taskId as string | undefined,
      status: req.query.status as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined
    }
    const executions = await getExecutions(filter)
    res.json(executions)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/export', async (req, res) => {
  try {
    const format = (req.query.format as string) || 'csv'
    const filter = {
      taskId: req.query.taskId as string | undefined,
      status: req.query.status as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined
    }
    const executions = await getExecutions(filter)

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', 'attachment; filename=executions.json')
      res.json(executions)
    } else {
      const headers = ['ID', 'Task ID', 'Task Name', 'Trigger Time', 'Start Time', 'End Time', 'Status', 'Exit Code', 'Duration (ms)', 'Retry Count', 'Is Retry']
      const rows = executions.map(e => [
        e.id,
        e.taskId,
        e.taskName,
        e.triggerTime,
        e.startTime || '',
        e.endTime || '',
        e.status,
        e.exitCode ?? '',
        e.durationMs ?? '',
        e.retryCount,
        e.isRetry ? 'Yes' : 'No'
      ])

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n')

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename=executions.csv')
      res.send('\uFEFF' + csv)
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const execution = await getExecutionById(req.params.id)
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' })
    }
    res.json(execution)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id/log', async (req, res) => {
  try {
    const execution = await getExecutionById(req.params.id)
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' })
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(execution.output || '')
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
