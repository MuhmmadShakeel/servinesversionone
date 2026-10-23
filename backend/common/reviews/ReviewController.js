import pool from '../database/connection.js'
import { ApiError } from '../utils/ApiError.js'

const types = {
  service: {
    listing: 'services', table: 'service_reviews', key: 'service_id', live: "status = 'active'",
  },
  product: {
    listing: 'products', table: 'product_reviews', key: 'product_id', live: "status = 'active' AND quantity > 0",
  },
  job: {
    listing: 'hiring_requirements', table: 'job_reviews', key: 'requirement_id', live: "status = 'open'",
  },
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function context(request) {
  const { type, id } = request.params
  const config = types[type]
  if (!config || !uuid.test(id)) throw new ApiError(400, 'Choose a valid listing.')
  const listing = await pool.query(`SELECT owner_user_id, ${config.live} AS live FROM ${config.listing} WHERE id = $1`, [id])
  if (!listing.rowCount) throw new ApiError(404, 'Listing not found.')
  const canReview = listing.rows[0].owner_user_id !== request.user.id && listing.rows[0].live
  if (!listing.rows[0].live && listing.rows[0].owner_user_id !== request.user.id) {
    const previousReview = await pool.query(`SELECT 1 FROM ${config.table} WHERE ${config.key} = $1 AND reviewer_user_id = $2`, [id, request.user.id])
    if (!previousReview.rowCount) throw new ApiError(404, 'Listing not found.')
  }
  return { config, id, canReview }
}

export async function listReviews(request, response, next) {
  try {
    const { config, id, canReview } = await context(request)
    const result = await pool.query(
      `SELECT r.rating, r.body, r.created_at AS "createdAt", r.updated_at AS "updatedAt",
        r.reviewer_user_id AS "reviewerUserId", u.name AS "reviewerName"
       FROM ${config.table} r JOIN users u ON u.id = r.reviewer_user_id
       WHERE r.${config.key} = $1 ORDER BY r.updated_at DESC, r.id LIMIT 100`, [id],
    )
    const summary = await pool.query(
      `SELECT COUNT(*)::integer AS count, COALESCE(ROUND(AVG(rating), 1), 0) AS average
       FROM ${config.table} WHERE ${config.key} = $1`, [id],
    )
    response.json({ reviews: result.rows, rating: summary.rows[0], canReview })
  } catch (error) { next(error) }
}

export async function saveReview(request, response, next) {
  try {
    const { config, id, canReview } = await context(request)
    if (!canReview) throw new ApiError(403, 'Only other members can review an active listing.')
    const { rating, body } = request.body || {}
    const text = typeof body === 'string' ? body.trim() : ''
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 10 || text.length > 1000) {
      throw new ApiError(400, 'Choose 1 to 5 stars and write 10 to 1000 characters.')
    }
    const result = await pool.query(
      `INSERT INTO ${config.table} (${config.key}, reviewer_user_id, rating, body)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (${config.key}, reviewer_user_id) DO UPDATE SET
         rating = EXCLUDED.rating, body = EXCLUDED.body, updated_at = NOW()
       RETURNING id`, [id, request.user.id, rating, text],
    )
    response.status(200).json({ id: result.rows[0].id })
  } catch (error) { next(error) }
}

export async function deleteReview(request, response, next) {
  try {
    const { config, id } = await context(request)
    const result = await pool.query(
      `DELETE FROM ${config.table} WHERE ${config.key} = $1 AND reviewer_user_id = $2 RETURNING id`,
      [id, request.user.id],
    )
    if (!result.rowCount) throw new ApiError(404, 'Your review was not found.')
    response.status(204).end()
  } catch (error) { next(error) }
}
