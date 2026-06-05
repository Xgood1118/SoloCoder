import app from './app.js'
import { getDatabase } from './database.js'
import { initialize as initScheduler } from './services/schedulerService.js'
import { setupWebSocket } from './services/websocket.js'

const PORT = process.env.PORT || 3001

async function start() {
  try {
    console.log('Initializing database...')
    await getDatabase()
    console.log('Database initialized')

    console.log('Initializing scheduler...')
    await initScheduler()
    console.log('Scheduler initialized')

    const server = app.listen(PORT, () => {
      console.log(`Server ready on port ${PORT}`)
    })

    setupWebSocket(server)
    console.log('WebSocket server ready')

    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received')
      server.close(() => {
        console.log('Server closed')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      console.log('SIGINT signal received')
      server.close(() => {
        console.log('Server closed')
        process.exit(0)
      })
    })
  } catch (e) {
    console.error('Failed to start server:', e)
    process.exit(1)
  }
}

start()

export default app
