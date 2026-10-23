import pool from '../common/database/connection.js'
import { ApiError } from '../common/utils/ApiError.js'

const types = { service: { table: 'services', live: "status = 'active'" }, product: { table: 'products', live: "status = 'active' AND quantity > 0" }, hiring: { table: 'hiring_requirements', live: "status = 'open'" } }
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const columns = `listing_type AS "listingType", listing_id AS "listingId", budget,
  duration_count AS "durationCount", duration_unit AS "durationUnit",
  created_at AS "createdAt", updated_at AS "updatedAt"`

function target(request) {
  const { type, id } = request.params
  if (!types[type] || !idPattern.test(id)) throw new ApiError(400, 'Choose a valid listing.')
  return { type, id, ...types[type] }
}

async function ownedListing(request, { table, live, id }, requireLive = false) {
  const result = await pool.query(`SELECT id, ${live} AS "isLive" FROM ${table} WHERE id = $1 AND owner_user_id = $2`, [id, request.user.id])
  if (!result.rowCount) throw new ApiError(404, 'Listing not found.')
  if (requireLive && !result.rows[0].isLive) throw new ApiError(409, 'Publish this listing before boosting it.')
}

export function validateBoost(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['budget', 'durationCount', 'durationUnit'].includes(key))) throw new ApiError(400, 'Enter valid boost details.')
  const budget = String(body.budget ?? '')
  const count = Number(body.durationCount)
  const unit = body.durationUnit
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(budget) || Number(budget) <= 0) throw new ApiError(400, 'Enter a budget greater than zero.')
  if (!Number.isInteger(count) || count < 1 || count > 365 || String(body.durationCount ?? '') !== String(count)) throw new ApiError(400, 'Duration must be 1–365.')
  if (!['day', 'week', 'month', 'year'].includes(unit)) throw new ApiError(400, 'Choose days, weeks, months, or years.')
  return { budget, count, unit }
}

export async function getBoost(request, response, next) {
  try {
    const listing = target(request)
    await ownedListing(request, listing)
    const result = await pool.query(`SELECT ${columns} FROM listing_boosts WHERE listing_type = $1 AND listing_id = $2 AND owner_user_id = $3`, [listing.type, listing.id, request.user.id])
    response.json({ boost: result.rows[0] || null })
  } catch (error) { next(error) }
}

export async function getBoostBenchmark(request, response, next) {
  try {
    const config = types[request.params.type]
    if (!config) throw new ApiError(400, 'Choose a valid listing type.')
    const days = "CASE b.duration_unit WHEN 'day' THEN 1 WHEN 'week' THEN 7 WHEN 'month' THEN 30 ELSE 365 END"
    const result = await pool.query(`
      WITH recent_posts AS (
        SELECT id, owner_user_id FROM ${config.table}
        WHERE ${config.live}
        ORDER BY created_at DESC LIMIT 30
      )
      SELECT b.budget, b.duration_count AS "durationCount", b.duration_unit AS "durationUnit",
        ROUND(b.budget / (b.duration_count * ${days}), 4) AS "dailyBudget"
      FROM recent_posts post
      JOIN listing_boosts b ON b.listing_id = post.id
        AND b.listing_type = $1 AND b.owner_user_id = post.owner_user_id
      WHERE b.owner_user_id <> $2
        AND b.updated_at + (b.duration_count * ${days}) * INTERVAL '1 day' > NOW()
      ORDER BY b.budget / (b.duration_count * ${days}) DESC, b.updated_at DESC
      LIMIT 1`, [request.params.type, request.user.id])
    response.json({ benchmark: result.rows[0] || null })
  } catch (error) { next(error) }
}

export async function saveBoost(request, response, next) {
  try {
    const listing = target(request)
    const boost = validateBoost(request.body)
    await ownedListing(request, listing, true)
    const result = await pool.query(`INSERT INTO listing_boosts (listing_type, listing_id, owner_user_id, budget, duration_count, duration_unit)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (listing_type, listing_id) DO UPDATE SET budget = EXCLUDED.budget,
      duration_count = EXCLUDED.duration_count, duration_unit = EXCLUDED.duration_unit, updated_at = NOW()
      WHERE listing_boosts.owner_user_id = EXCLUDED.owner_user_id RETURNING ${columns}`,
    [listing.type, listing.id, request.user.id, boost.budget, boost.count, boost.unit])
    if (!result.rowCount) throw new ApiError(409, 'This boost belongs to another account.')
    response.json({ boost: result.rows[0] })
  } catch (error) { next(error) }
}

export async function deleteBoost(request, response, next) {
  try {
    const listing = target(request)
    await ownedListing(request, listing)
    await pool.query('DELETE FROM listing_boosts WHERE listing_type = $1 AND listing_id = $2 AND owner_user_id = $3', [listing.type, listing.id, request.user.id])
    response.status(204).end()
  } catch (error) { next(error) }
}
