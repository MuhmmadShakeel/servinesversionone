import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { getProfileImage, login, logout, me, signup, updateProfileImage } from './AuthController.js'
import { forgotPassword, resetPassword } from './PasswordController.js'
import { authenticate } from './auth.middleware.js'

const router = Router()
const signupLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false })
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
})
const recoveryLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false })

router.post('/signup', signupLimit, signup)
router.post('/login', loginLimit, login)
router.post('/password/forgot', recoveryLimit, forgotPassword)
router.post('/password/reset', recoveryLimit, resetPassword)
router.get('/me', authenticate, me)
router.get('/me/image', authenticate, getProfileImage)
router.put('/me/image', authenticate, updateProfileImage)
router.post('/logout', authenticate, logout)

export default router
