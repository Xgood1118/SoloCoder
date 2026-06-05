import express from 'express'
import {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  getChannelById
} from '../repositories/alertRepository.js'
import { testChannel } from '../services/alertService.js'

const router = express.Router()

router.get('/', async (_req, res) => {
  try {
    const channels = await getChannels()
    res.json(channels)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const data = req.body
    if (!data.name || !data.type) {
      return res.status(400).json({ error: 'Missing required fields' })
    }
    const channel = await createChannel({
      name: data.name,
      type: data.type,
      webhookUrl: data.webhookUrl,
      emailSmtpHost: data.emailSmtpHost,
      emailSmtpPort: data.emailSmtpPort,
      emailUser: data.emailUser,
      emailPass: data.emailPass,
      emailFrom: data.emailFrom,
      enabled: data.enabled ?? true
    })
    res.status(201).json(channel)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const existing = await getChannelById(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Channel not found' })
    }
    const updated = await updateChannel(req.params.id, req.body)
    res.json(updated)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const existing = await getChannelById(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Channel not found' })
    }
    await deleteChannel(req.params.id)
    res.status(204).send()
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:id/test', async (req, res) => {
  try {
    const result = await testChannel(req.params.id)
    if (result.success) {
      res.json({ success: true, message: 'Test sent successfully' })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

export default router
