import pool from '../common/database/connection.js'
import { ApiError } from '../common/utils/ApiError.js'

const listings = {
  service: { table: 'services', status: 'active' },
  hiring: { table: 'hiring_requirements', status: 'open' },
  product: { table: 'products', status: 'active' },
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function recordShare(request, response, next) {
  try {
    const listing = listings[request.params.type]
    if (!listing || !uuidPattern.test(request.params.id || '')) throw new ApiError(400, 'Choose a valid listing to share.')
    const result = await pool.query(
      `UPDATE ${listing.table} SET share_count = share_count + 1
       WHERE id = $1 AND status = $2 RETURNING share_count AS "shareCount"`,
      [request.params.id, listing.status],
    )
    if (!result.rowCount) throw new ApiError(404, 'This listing is unavailable for sharing.')
    response.json(result.rows[0])
  } catch (error) { next(error) }
}
