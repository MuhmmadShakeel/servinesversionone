import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { clearConversation, deleteMessage, editMessage, listConversations, listMessages, markConversationRead, sendMessage, startConversation } from './ChatController.js'

const router = Router()
const messageLimit = rateLimit({ windowMs: 60 * 1000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false })

router.get('/conversations', listConversations)
router.post('/conversations', messageLimit, startConversation)
router.get('/conversations/:id/messages', listMessages)
router.post('/conversations/:id/messages', messageLimit, sendMessage)
router.post('/conversations/:id/read', markConversationRead)
router.delete('/conversations/:id/messages', messageLimit, clearConversation)
router.patch('/conversations/:id/messages/:messageId', messageLimit, editMessage)
router.delete('/conversations/:id/messages/:messageId', messageLimit, deleteMessage)

export default router
