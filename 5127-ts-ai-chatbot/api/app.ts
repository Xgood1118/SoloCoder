import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDb } from './database.js'
import authRoutes from './routes/auth.js'
import sessionRoutes from './routes/session.js'
import chatRoutes from './routes/chat.js'
import knowledgeRoutes from './routes/knowledge.js'
import sensitiveWordRoutes from './routes/sensitive-word.js'
import historyRoutes from './routes/history.js'
import userRoutes from './routes/user.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/knowledge', knowledgeRoutes)
app.use('/api/sensitive-words', sensitiveWordRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/users', userRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export { initDb }
export default app
