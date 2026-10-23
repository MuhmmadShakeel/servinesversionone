import pool from '../common/database/connection.js'
import { ApiError } from '../common/utils/ApiError.js'
import { serviceIdPattern, validateService } from './serviceValidation.js'
import { readVoice, removeVoice, saveVoice } from '../common/voice/voiceStorage.js'
import { boostJoin, boostOrder, boostPercentage } from '../boosts/boostRanking.js'

const columns = `id, owner_user_id AS "ownerUserId", title, category, city, description,
  price, original_price AS "originalPrice", experience_years AS "experienceYears", status, share_count AS "shareCount",
  (image_content IS NOT NULL) AS "hasImage",
  (voice_file IS NOT NULL) AS "hasVoice", voice_duration_seconds AS "voiceDurationSeconds",
  created_at AS "createdAt", updated_at AS "updatedAt"`

function serviceId(request) {
  if (!serviceIdPattern.test(request.params.id)) throw new ApiError(400, 'Choose a valid service.')
  return request.params.id
}

export async function listServices(request, response, next) {
  try {
    const result = await pool.query(`SELECT ${columns},
      COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM service_reviews r WHERE r.service_id = services.id), 0) AS "ratingAverage",
      (SELECT COUNT(*)::integer FROM service_reviews r WHERE r.service_id = services.id) AS "ratingCount"
      FROM services WHERE owner_user_id = $1 ORDER BY updated_at DESC`, [request.user.id])
    response.json({ services: result.rows })
  } catch (error) { next(error) }
}

export async function browseServices(_request, response, next) {
  try {
    const result = await pool.query(
      `SELECT s.id, s.owner_user_id AS "ownerUserId", u.name AS "ownerName",
       s.title, s.category, s.city, s.price, s.original_price AS "originalPrice",
       (s.image_content IS NOT NULL) AS "hasImage",
       s.experience_years AS "experienceYears", s.status, s.share_count AS "shareCount",
       COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM service_reviews r WHERE r.service_id = s.id), 0) AS "ratingAverage",
       (SELECT COUNT(*)::integer FROM service_reviews r WHERE r.service_id = s.id) AS "ratingCount",
       (s.voice_file IS NOT NULL) AS "hasVoice", s.voice_duration_seconds AS "voiceDurationSeconds",
       s.created_at AS "createdAt", s.updated_at AS "updatedAt", ranking.expires_at AS "boostExpiresAt", ${boostPercentage}
       FROM services s JOIN users u ON u.id = s.owner_user_id
       ${boostJoin('service', 's')}
       WHERE s.status = 'active' ORDER BY ${boostOrder}, s.updated_at DESC, s.id`,
    )
    response.json({ services: result.rows })
  } catch (error) { next(error) }
}

export async function getService(request, response, next) {
  try {
    const result = await pool.query(`SELECT ${columns} FROM services WHERE id = $1 AND owner_user_id = $2`, [serviceId(request), request.user.id])
    if (!result.rowCount) throw new ApiError(404, 'Service not found.')
    response.json({ service: result.rows[0] })
  } catch (error) { next(error) }
}

export async function createService(request, response, next) {
  let savedVoice
  let created = false
  try {
    const service = validateService(request.body)
    if (service.status === 'active' && !service.image) throw new ApiError(400, 'Add a service image before publishing.')
    savedVoice = await saveVoice(service.voice, request.user.id)
    const result = await pool.query(
      `INSERT INTO services (owner_user_id, title, category, description, price, experience_years, status, voice_file, voice_mime_type, voice_duration_seconds, original_price, image_mime_type, image_file_name, image_content, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING ${columns}`,
      [request.user.id, service.title, service.category, service.description, service.price, service.experienceYears, service.status,
        savedVoice?.file || null, savedVoice?.mimeType || null, savedVoice?.durationSeconds || null, service.originalPrice,
        service.image?.mimeType || null, service.image?.fileName || null, service.image?.content || null, service.city || null],
    )
    created = true
    response.status(201).json({ service: result.rows[0] })
  } catch (error) { if (savedVoice && !created) await removeVoice(savedVoice.file).catch(console.error); next(error) }
}

export async function updateService(request, response, next) {
  let client
  let savedVoice
  let committed = false
  try {
    const id = serviceId(request)
    const service = validateService(request.body)
    savedVoice = await saveVoice(service.voice, request.user.id)
    client = await pool.connect()
    await client.query('BEGIN')
    const existing = await client.query('SELECT voice_file, image_content IS NOT NULL AS "hasImage", status FROM services WHERE id = $1 AND owner_user_id = $2 FOR UPDATE', [id, request.user.id])
    if (!existing.rowCount) throw new ApiError(404, 'Service not found.')
    const hasImage = service.image === undefined ? existing.rows[0].hasImage : Boolean(service.image)
    const keepsLegacyListing = existing.rows[0].status === 'active' && !existing.rows[0].hasImage && service.image === undefined
    if (service.status === 'active' && !hasImage && !keepsLegacyListing) throw new ApiError(400, 'Add a service image before publishing.')
    const values = [id, request.user.id, service.title, service.category, service.description, service.price, service.experienceYears, service.status]
    const voiceSql = service.voice === undefined ? '' : ', voice_file = $10, voice_mime_type = $11, voice_duration_seconds = $12'
    values.push(service.originalPrice)
    if (service.voice !== undefined) values.push(savedVoice?.file || null, savedVoice?.mimeType || null, savedVoice?.durationSeconds || null)
    const imageSql = service.image === undefined ? '' : `, image_mime_type = $${values.length + 1}, image_file_name = $${values.length + 2}, image_content = $${values.length + 3}`
    if (service.image !== undefined) values.push(service.image?.mimeType || null, service.image?.fileName || null, service.image?.content || null)
    const citySql = service.city === undefined ? '' : `, city = $${values.length + 1}`
    if (service.city !== undefined) values.push(service.city)
    const result = await client.query(
      `UPDATE services SET title = $3, category = $4, description = $5, price = $6,
       experience_years = $7, status = $8, original_price = $9${voiceSql}${imageSql}${citySql}, updated_at = NOW()
       WHERE id = $1 AND owner_user_id = $2 RETURNING ${columns}`,
      values,
    )
    await client.query('COMMIT')
    committed = true
    if (service.voice !== undefined && existing.rows[0].voice_file) await removeVoice(existing.rows[0].voice_file).catch(console.error)
    response.json({ service: result.rows[0] })
  } catch (error) {
    if (client && !committed) await client.query('ROLLBACK')
    if (savedVoice && !committed) await removeVoice(savedVoice.file).catch(console.error)
    next(error)
  } finally { client?.release() }
}

export async function deleteService(request, response, next) {
  try {
    const id = serviceId(request)
    const owned = await pool.query('SELECT 1 FROM services WHERE id = $1 AND owner_user_id = $2', [id, request.user.id])
    if (!owned.rowCount) throw new ApiError(404, 'Service not found.')
    const booked = await pool.query('SELECT 1 FROM service_bookings WHERE service_id = $1 LIMIT 1', [id])
    if (booked.rowCount) throw new ApiError(409, 'This service has booking history. Change it to Draft instead of deleting it.')
    const result = await pool.query('DELETE FROM services WHERE id = $1 AND owner_user_id = $2 RETURNING id, voice_file', [id, request.user.id])
    if (!result.rowCount) throw new ApiError(404, 'Service not found.')
    if (result.rows[0].voice_file) await removeVoice(result.rows[0].voice_file).catch(console.error)
    response.status(204).end()
  } catch (error) {
    next(error.code === '23503' ? new ApiError(409, 'This service has booking history. Change it to Draft instead of deleting it.') : error)
  }
}

export async function getServiceVoice(request, response, next) {
  try {
    const result = await pool.query(
      `SELECT s.voice_file, s.voice_mime_type FROM services s WHERE s.id = $1
       AND (s.owner_user_id = $2 OR s.status = 'active' OR EXISTS
         (SELECT 1 FROM service_bookings b WHERE b.service_id = s.id AND b.buyer_user_id = $2))`,
      [serviceId(request), request.user.id],
    )
    if (!result.rowCount || !result.rows[0].voice_file) throw new ApiError(404, 'Voice note not found.')
    response.set('Cache-Control', 'private, no-store')
    response.set('X-Content-Type-Options', 'nosniff')
    response.type(result.rows[0].voice_mime_type).send(await readVoice(result.rows[0].voice_file))
  } catch (error) { next(error) }
}

export async function getServiceImage(request, response, next) {
  try {
    const result = await pool.query(
      `SELECT s.image_content, s.image_mime_type FROM services s WHERE s.id = $1
       AND (s.owner_user_id = $2 OR s.status = 'active' OR EXISTS
         (SELECT 1 FROM service_bookings b WHERE b.service_id = s.id AND b.buyer_user_id = $2))`,
      [serviceId(request), request.user.id],
    )
    if (!result.rowCount || !result.rows[0].image_content) throw new ApiError(404, 'Service image not found.')
    response.set('Cache-Control', 'private, no-store')
    response.set('X-Content-Type-Options', 'nosniff')
    response.type(result.rows[0].image_mime_type).send(result.rows[0].image_content)
  } catch (error) { next(error) }
}
