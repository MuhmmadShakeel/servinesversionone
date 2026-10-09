import cors from 'cors'
import express from 'express'
import { env } from './common/config/env.js'
import { errorHandler, notFound } from './common/middleware/error.middleware.js'
import authRouter from './auth/AuthRouter.js'
import { authenticate } from './auth/auth.middleware.js'
import serviceRouter from './services/ServiceRouter.js'
import hiringRouter from './hiring/HiringRouter.js'
import productRouter from './products/ProductRouter.js'
import chatRouter from './chat/ChatRouter.js'
import shareRouter from './shares/ShareRouter.js'

const app = express()

app.use(cors({ origin: env.clientUrl, allowedHeaders: ['Content-Type', 'Authorization'], exposedHeaders: ['Authorization'] }))
app.use('/v1/hiring', express.json({ limit: '24mb' }))
app.use('/v1/products', express.json({ limit: '8mb' }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.use('/v1/auth', authRouter)
app.use('/v1/services', authenticate, serviceRouter)
app.use('/v1/hiring', authenticate, hiringRouter)
app.use('/v1/products', authenticate, productRouter)
app.use('/v1/chat', authenticate, chatRouter)
app.use('/v1/shares', authenticate, shareRouter)

app.use(notFound)
app.use(errorHandler)

export default app
