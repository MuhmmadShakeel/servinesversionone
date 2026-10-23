import cors from 'cors'
import express from 'express'
import { env } from './common/config/env.js'
import { isReady } from './common/config/readiness.js'
import { migrate } from './common/database/migrate.js'
import { errorHandler, notFound } from './common/middleware/error.middleware.js'
import authRouter from './auth/AuthRouter.js'
import { authenticate } from './auth/auth.middleware.js'
import serviceRouter from './services/ServiceRouter.js'
import hiringRouter from './hiring/HiringRouter.js'
import productRouter from './products/ProductRouter.js'
import chatRouter from './chat/ChatRouter.js'
import shareRouter from './shares/ShareRouter.js'
import boostRouter from './boosts/BoostRouter.js'
import pool from './common/database/connection.js'
import { deleteReview, listReviews, saveReview } from './common/reviews/ReviewController.js'
import { rateLimit } from 'express-rate-limit'
import voiceUploadRouter from './common/voice/VoiceUploadRouter.js'

const app = express()
if (process.env.VERCEL === '1') app.set('trust proxy', 1)
let listingSchemaReady

async function ensureListingSchema(_request, _response, next) {
  try {
    listingSchemaReady ||= migrate().catch((error) => {
      listingSchemaReady = null
      throw error
    })
    await listingSchemaReady
    next()
  } catch (error) { next(error) }
}

app.use(cors({ origin: env.clientUrl, allowedHeaders: ['Content-Type', 'Authorization'], exposedHeaders: ['Authorization'] }))
app.use('/v1', (_request, response, next) => {
  if (!isReady()) return response.status(503).json({ message: 'Servnix API is starting. Please try again shortly.' })
  next()
})
app.use('/v1', rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/v1/auth/me/image', express.json({ limit: '2mb' }))
app.use('/v1/hiring', express.json({ limit: '36mb' }))
app.use('/v1/products', express.json({ limit: '20mb' }))
app.use('/v1/services', express.json({ limit: '12mb' }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (_request, response) => response.status(isReady() ? 200 : 503).json({ status: isReady() ? 'ok' : 'starting' }))
app.use('/v1/voice', voiceUploadRouter)
app.use('/v1/auth', ensureListingSchema, authRouter)
const reviewLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })
app.get('/v1/reviews/:type/:id', authenticate, ensureListingSchema, listReviews)
app.put('/v1/reviews/:type/:id', authenticate, ensureListingSchema, reviewLimit, saveReview)
app.delete('/v1/reviews/:type/:id', authenticate, ensureListingSchema, reviewLimit, deleteReview)
app.get('/v1/categories/:kind', authenticate, ensureListingSchema, async (request, response, next) => {
  try {
    if (!['service', 'product', 'hiring'].includes(request.params.kind)) return response.status(400).json({ message: 'Choose a valid listing type.' })
    const result = await pool.query('SELECT name FROM listing_categories WHERE kind = $1 ORDER BY name', [request.params.kind])
    response.json({ categories: result.rows.map((row) => row.name) })
  } catch (error) { next(error) }
})
app.use('/v1/services', authenticate, ensureListingSchema, serviceRouter)
app.use('/v1/hiring', authenticate, ensureListingSchema, hiringRouter)
app.use('/v1/products', authenticate, ensureListingSchema, productRouter)
app.use('/v1/chat', authenticate, ensureListingSchema, chatRouter)
app.use('/v1/shares', authenticate, shareRouter)
app.use('/v1/boosts', authenticate, ensureListingSchema, boostRouter)

app.use(notFound)
app.use(errorHandler)

export default app
