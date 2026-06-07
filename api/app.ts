import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { getDb } from './db/index.js'
import { config } from './config/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

getDb()

app.use(cors({
  origin: config.nodeEnv === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use(express.static(path.join(__dirname, '..', 'public')))

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

app.use('/api/health', (req: Request, res: Response, next: NextFunction): void => {
  res.status(200).json({
    success: true,
    message: 'ok',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api', routes)

app.use(errorHandler)

app.use(notFoundHandler)

export default app
