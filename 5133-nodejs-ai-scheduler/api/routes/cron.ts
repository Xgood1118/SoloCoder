import express from 'express'
import cronParser from 'cron-parser'

const router = express.Router()

router.post('/parse', (req, res) => {
  try {
    const { expression } = req.body
    if (!expression) {
      return res.status(400).json({ error: 'Cron expression is required' })
    }

    const interval = cronParser.parseExpression(expression)
    const fields = interval.fields

    res.json({
      valid: true,
      expression,
      fields: {
        minute: fields.minute,
        hour: fields.hour,
        dayOfMonth: fields.dayOfMonth,
        month: fields.month,
        dayOfWeek: fields.dayOfWeek
      },
      nextRun: interval.next().toISOString()
    })
  } catch (e: any) {
    res.status(400).json({ valid: false, error: e.message })
  }
})

router.post('/next-runs', (req, res) => {
  try {
    const { expression, count = 5 } = req.body
    if (!expression) {
      return res.status(400).json({ error: 'Cron expression is required' })
    }

    const interval = cronParser.parseExpression(expression)
    const runs: string[] = []
    let remaining = count

    while (remaining > 0) {
      runs.push(interval.next().toISOString())
      remaining--
    }

    res.json({
      expression,
      count,
      nextRuns: runs
    })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

router.post('/dag/validate', async (req, res) => {
  try {
    const { taskId, dependencies } = req.body
    const { getTasks } = await import('../repositories/taskRepository.js')
    const { validateDAG } = await import('../services/dagService.js')

    const allTasks = await getTasks()
    const result = validateDAG(taskId || '', dependencies || [], allTasks)

    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
