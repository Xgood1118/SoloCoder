import express from 'express'
import { getAllConfig, updateSystemConfig } from '../repositories/configRepository.js'

const router = express.Router()

router.get('/', async (_req, res) => {
  try {
    const config = await getAllConfig()
    res.json(config)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/', async (req, res) => {
  try {
    const updated = await updateSystemConfig(req.body)
    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
