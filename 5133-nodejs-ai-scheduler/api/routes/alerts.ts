import express from 'express'
import {
  getAlerts,
  getAlertById,
  acknowledgeAlert,
  getPendingAlertsCount
} from '../repositories/alertRepository.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const filter = {
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined
    }
    const alerts = await getAlerts(filter)
    res.json(alerts)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/pending-count', async (_req, res) => {
  try {
    const count = await getPendingAlertsCount()
    res.json({ count })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:id/acknowledge', async (req, res) => {
  try {
    const alert = await getAlertById(req.params.id)
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' })
    }
    const updated = await acknowledgeAlert(req.params.id)
    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
