import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { handleUpload } from '@vercel/blob/client'
import { authenticate } from '../../auth/auth.middleware.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import pool from '../database/connection.js'
import { belongsToUser, removeVoice } from './voiceStorage.js'

const router = Router()
const formats = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/mp4']
const maxBytes = 8 * 1024 * 1024

router.post('/grant', authenticate, (request, response) => {
  response.json({ grant: jwt.sign({ sub: request.user.id, purpose: 'voice-upload' }, env.jwtSecret, { expiresIn: '5m' }), userId: request.user.id })
})

router.post('/upload', async (request, response, next) => {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new ApiError(503, 'Voice storage is not configured.')
    const result = await handleUpload({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      body: request.body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let claims
        try { claims = jwt.verify(clientPayload || '', env.jwtSecret, { algorithms: ['HS256'] }) }
        catch { throw new ApiError(401, 'Voice upload authorization has expired. Please try again.') }
        if (claims.purpose !== 'voice-upload' || !/^[0-9a-f-]{36}$/i.test(claims.sub || '') ||
          !new RegExp(`^voices/${claims.sub}/[0-9a-f-]{36}\\.(webm|ogg|wav|mp3|m4a)$`, 'i').test(pathname)) {
          throw new ApiError(403, 'Voice upload path is not authorized.')
        }
        return { allowedContentTypes: formats, maximumSizeInBytes: maxBytes, tokenPayload: claims.sub, validUntil: Date.now() + 5 * 60 * 1000 }
      },
      onUploadCompleted: async () => {},
    })
    response.json(result)
  } catch (error) { next(error) }
})

router.delete('/uploaded', authenticate, async (request, response, next) => {
  try {
    const url = request.body?.url
    if (!belongsToUser(url, request.user.id)) throw new ApiError(400, 'Choose a valid voice recording.')
    const used = await pool.query(`
      SELECT 1 FROM products WHERE owner_user_id = $1 AND voice_file = $2
      UNION ALL SELECT 1 FROM services WHERE owner_user_id = $1 AND voice_file = $2
      UNION ALL SELECT 1 FROM hiring_requirements WHERE owner_user_id = $1 AND voice_file = $2 LIMIT 1
    `, [request.user.id, url])
    if (!used.rowCount) await removeVoice(url)
    response.status(204).end()
  } catch (error) { next(error) }
})

export default router
