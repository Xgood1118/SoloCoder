import express from 'express'
import { getTasks } from '../repositories/taskRepository.js'
import { getRecentExecutions, getRunningExecutionsCount, getExecutions } from '../repositories/executionRepository.js'
import { getPendingAlertsCount } from '../repositories/alertRepository.js'

const router = express.Router()

router.get('/stats', async (_req, res) => {
  try {
    const tasks = await getTasks()
    const runningCount = await getRunningExecutionsCount()
    const recentExecutions = await getRecentExecutions(20)
    const pendingAlerts = await getPendingAlertsCount()

    const allExecutions = await getExecutions()
    const totalFinished = allExecutions.filter(e => e.status !== 'running').length
    const successCount = allExecutions.filter(e => e.status === 'success').length
    const successRate = totalFinished > 0 ? Math.round((successCount / totalFinished) * 100) : 100

    res.json({
      totalTasks: tasks.length,
      enabledTasks: tasks.filter(t => t.enabled).length,
      runningTasks: runningCount,
      successRate,
      recentExecutions,
      pendingAlerts
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
