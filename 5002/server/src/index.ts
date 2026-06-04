import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { config } from './config'
import routes from './routes'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { scheduledTaskService } from './services/scheduledTaskService'

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api', routes)

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`🚀 Server is running on http://localhost:${config.port}`)
  console.log(`📚 API Documentation available at http://localhost:${config.port}/api`)

  scheduledTaskService.start()
})

export default app
