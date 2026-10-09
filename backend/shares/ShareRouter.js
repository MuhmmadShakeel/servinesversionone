import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { recordShare } from './ShareController.js'

const router = Router()
const shareLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false })
router.post('/:type/:id', shareLimit, recordShare)
export default router
