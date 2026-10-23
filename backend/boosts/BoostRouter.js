import { Router } from 'express'
import { deleteBoost, getBoost, getBoostBenchmark, saveBoost } from './BoostController.js'

const router = Router()
router.get('/benchmark/:type', getBoostBenchmark)
router.get('/:type/:id', getBoost)
router.put('/:type/:id', saveBoost)
router.delete('/:type/:id', deleteBoost)
export default router
