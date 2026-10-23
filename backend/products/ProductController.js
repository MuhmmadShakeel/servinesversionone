import pool from '../common/database/connection.js'
import { ApiError } from '../common/utils/ApiError.js'
import { productIdPattern, validateProduct } from './productValidation.js'
import { readVoice, removeVoice, saveVoice } from '../common/voice/voiceStorage.js'
import { boostJoin, boostOrder, boostPercentage } from '../boosts/boostRanking.js'

const columns = `id, owner_user_id AS "ownerUserId", title, category, description,
  price, original_price AS "originalPrice", quantity, status, bidding_enabled AS "biddingEnabled",
  bidding_started_at AS "biddingStartedAt", bidding_ends_at AS "biddingEndsAt",
  (bidding_ends_at <= NOW()) AS "biddingExpired",
  share_count AS "shareCount", (image_content IS NOT NULL) AS "hasImage",
  image_file_name AS "imageFileName", created_at AS "createdAt", updated_at AS "updatedAt"`
const voiceColumns = `, (voice_file IS NOT NULL) AS "hasVoice", voice_duration_seconds AS "voiceDurationSeconds"`

function productId(request) {
  if (!productIdPattern.test(request.params.id || '')) throw new ApiError(400, 'Choose a valid product.')
  return request.params.id
}

function validateActive(item, hasImage) {
  if (item.status === 'active' && (!hasImage || item.quantity === 0)) {
    throw new ApiError(400, 'Add an image and at least one item in stock before publishing.')
  }
}

export async function listMyProducts(request, response, next) {
  try {
    const result = await pool.query(`SELECT ${columns}${voiceColumns},
      COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM product_reviews r WHERE r.product_id = products.id), 0) AS "ratingAverage",
      (SELECT COUNT(*)::integer FROM product_reviews r WHERE r.product_id = products.id) AS "ratingCount",
      (SELECT COUNT(*)::integer FROM product_bids b WHERE b.product_id = products.id AND b.created_at >= products.bidding_started_at) AS "bidCount"
      FROM products WHERE owner_user_id = $1 ORDER BY updated_at DESC`, [request.user.id])
    response.json({ products: result.rows })
  } catch (error) { next(error) }
}

export async function browseProducts(_request, response, next) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.owner_user_id AS "ownerUserId", u.name AS "ownerName",
       p.title, p.category, p.price, p.original_price AS "originalPrice", p.quantity, p.status,
       p.bidding_enabled AS "biddingEnabled", p.bidding_ends_at AS "biddingEndsAt",
       (p.bidding_ends_at <= NOW()) AS "biddingExpired", p.share_count AS "shareCount",
       COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM product_reviews r WHERE r.product_id = p.id), 0) AS "ratingAverage",
       (SELECT COUNT(*)::integer FROM product_reviews r WHERE r.product_id = p.id) AS "ratingCount",
       (p.image_content IS NOT NULL) AS "hasImage", (p.voice_file IS NOT NULL) AS "hasVoice",
       p.voice_duration_seconds AS "voiceDurationSeconds", p.updated_at AS "updatedAt", ranking.expires_at AS "boostExpiresAt",
       (SELECT COUNT(*)::integer FROM product_bids b WHERE b.product_id = p.id AND b.created_at >= p.bidding_started_at) AS "bidCount", ${boostPercentage}
       FROM products p JOIN users u ON u.id = p.owner_user_id
       ${boostJoin('product', 'p')}
       WHERE p.status = 'active' AND p.quantity > 0
       ${_request.query.liveDeals === '1' ? 'AND p.bidding_enabled AND p.bidding_ends_at > NOW()' : ''}
       ORDER BY ${boostOrder}, p.created_at ASC, p.id`,
    )
    response.json({ products: result.rows })
  } catch (error) { next(error) }
}

export async function createProduct(request, response, next) {
  let savedVoice
  let created = false
  try {
    const item = validateProduct(request.body)
    validateActive(item, Boolean(item.image))
    if (item.biddingEnabled && !item.biddingDurationHours) throw new ApiError(400, 'Choose a bidding duration before enabling Live Deals.')
    savedVoice = await saveVoice(item.voice, request.user.id)
    const result = await pool.query(
      `INSERT INTO products (owner_user_id, title, category, description, price, quantity, status,
       image_mime_type, image_file_name, image_content, voice_file, voice_mime_type, voice_duration_seconds, original_price,
       bidding_enabled, bidding_started_at, bidding_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
       CASE WHEN $15 THEN NOW() END, CASE WHEN $15 THEN NOW() + $16::integer * INTERVAL '1 hour' END)
       RETURNING ${columns}${voiceColumns}`,
      [request.user.id, item.title, item.category, item.description, item.price, item.quantity, item.status,
        item.image?.mimeType || null, item.image?.fileName || null, item.image?.content || null,
        savedVoice?.file || null, savedVoice?.mimeType || null, savedVoice?.durationSeconds || null, item.originalPrice,
        item.biddingEnabled ?? false, item.biddingDurationHours ?? null],
    )
    created = true
    response.status(201).json({ product: result.rows[0] })
  } catch (error) { if (savedVoice && !created) await removeVoice(savedVoice.file).catch(console.error); next(error) }
}

export async function updateProduct(request, response, next) {
  let client
  let savedVoice
  let previousVoice
  let committed = false
  try {
    const id = productId(request)
    const item = validateProduct(request.body)
    savedVoice = await saveVoice(item.voice, request.user.id)
    client = await pool.connect()
    await client.query('BEGIN')
    const existing = await client.query('SELECT image_content IS NOT NULL AS "hasImage", voice_file, bidding_enabled, bidding_ends_at FROM products WHERE id = $1 AND owner_user_id = $2 FOR UPDATE', [id, request.user.id])
    if (!existing.rowCount) throw new ApiError(404, 'Product not found.')
    previousVoice = existing.rows[0].voice_file
    validateActive(item, item.image === undefined ? existing.rows[0].hasImage : Boolean(item.image))
    const biddingEnabled = item.biddingEnabled ?? existing.rows[0].bidding_enabled
    if (biddingEnabled && !existing.rows[0].bidding_enabled && !item.biddingDurationHours) throw new ApiError(400, 'Choose a bidding duration before enabling Live Deals.')
    const values = [id, request.user.id, item.title, item.category, item.description, item.price, item.quantity, item.status]
    values.push(item.originalPrice)
    const imageSql = item.image === undefined ? '' : ', image_mime_type = $10, image_file_name = $11, image_content = $12'
    if (item.image !== undefined) values.push(item.image?.mimeType || null, item.image?.fileName || null, item.image?.content || null)
    const voiceSql = item.voice === undefined ? '' : `, voice_file = $${values.length + 1}, voice_mime_type = $${values.length + 2}, voice_duration_seconds = $${values.length + 3}`
    if (item.voice !== undefined) values.push(savedVoice?.file || null, savedVoice?.mimeType || null, savedVoice?.durationSeconds || null)
    values.push(biddingEnabled, item.biddingDurationHours ?? null)
    const enabledIndex = values.length - 1
    const durationIndex = values.length
    const result = await client.query(
      `UPDATE products SET title = $3, category = $4, description = $5, price = $6,
       quantity = $7, status = $8, original_price = $9${imageSql}${voiceSql},
       bidding_enabled = $${enabledIndex},
       bidding_started_at = CASE WHEN NOT $${enabledIndex} THEN NULL WHEN $${durationIndex}::integer IS NOT NULL THEN NOW() ELSE bidding_started_at END,
       bidding_ends_at = CASE WHEN NOT $${enabledIndex} THEN NULL WHEN $${durationIndex}::integer IS NOT NULL THEN NOW() + $${durationIndex}::integer * INTERVAL '1 hour' ELSE bidding_ends_at END,
       updated_at = NOW()
       WHERE id = $1 AND owner_user_id = $2 RETURNING ${columns}${voiceColumns}`,
      values,
    )
    await client.query('COMMIT')
    committed = true
    if (item.voice !== undefined && previousVoice) await removeVoice(previousVoice).catch(console.error)
    response.json({ product: result.rows[0] })
  } catch (error) {
    if (client && !committed) await client.query('ROLLBACK')
    if (savedVoice && !committed) await removeVoice(savedVoice.file).catch(console.error)
    next(error)
  } finally { client?.release() }
}

export async function deleteProduct(request, response, next) {
  try {
    const id = productId(request)
    const owned = await pool.query('SELECT 1 FROM products WHERE id = $1 AND owner_user_id = $2', [id, request.user.id])
    if (!owned.rowCount) throw new ApiError(404, 'Product not found.')
    const history = await pool.query('SELECT 1 FROM product_orders WHERE product_id = $1 UNION ALL SELECT 1 FROM product_bids WHERE product_id = $1 LIMIT 1', [id])
    if (history.rowCount) throw new ApiError(409, 'This product has order or bid history. Change it to Draft instead of deleting it.')
    const result = await pool.query('DELETE FROM products WHERE id = $1 AND owner_user_id = $2 RETURNING id, voice_file', [id, request.user.id])
    if (!result.rowCount) throw new ApiError(404, 'Product not found.')
    if (result.rows[0].voice_file) await removeVoice(result.rows[0].voice_file).catch(console.error)
    response.status(204).end()
  } catch (error) { next(error.code === '23503' ? new ApiError(409, 'This product has order or bid history. Change it to Draft instead of deleting it.') : error) }
}

export async function getProductVoice(request, response, next) {
  try {
    const result = await pool.query(
      `SELECT p.voice_file, p.voice_mime_type FROM products p WHERE p.id = $1
       AND (p.owner_user_id = $2 OR (p.status = 'active' AND p.quantity > 0)
         OR EXISTS (SELECT 1 FROM product_orders o WHERE o.product_id = p.id AND o.buyer_user_id = $2))`,
      [productId(request), request.user.id],
    )
    if (!result.rowCount || !result.rows[0].voice_file) throw new ApiError(404, 'Voice note not found.')
    const content = await readVoice(result.rows[0].voice_file)
    response.set('Cache-Control', 'private, no-store')
    response.set('X-Content-Type-Options', 'nosniff')
    response.type(result.rows[0].voice_mime_type).send(content)
  } catch (error) { next(error) }
}

export async function getProductImage(request, response, next) {
  try {
    const result = await pool.query(
      `SELECT p.image_content, p.image_mime_type FROM products p WHERE p.id = $1
       AND (p.owner_user_id = $2 OR (p.status = 'active' AND p.quantity > 0)
         OR EXISTS (SELECT 1 FROM product_orders o WHERE o.product_id = p.id AND o.buyer_user_id = $2))`,
      [productId(request), request.user.id],
    )
    if (!result.rowCount || !result.rows[0].image_content) throw new ApiError(404, 'Product image not found.')
    response.set('Cache-Control', 'no-store')
    response.set('X-Content-Type-Options', 'nosniff')
    response.type(result.rows[0].image_mime_type).send(result.rows[0].image_content)
  } catch (error) { next(error) }
}
