import pool from '../common/database/connection.js'
import { ApiError } from '../common/utils/ApiError.js'
import { productIdPattern } from './productValidation.js'

function productId(request) {
  if (!productIdPattern.test(request.params.id || '')) throw new ApiError(400, 'Choose a valid product.')
  return request.params.id
}

function bidDetails(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['amount', 'note'].includes(key))) {
    throw new ApiError(400, 'Enter a valid bid.')
  }
  const amount = String(body.amount ?? '')
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    throw new ApiError(400, 'Enter a positive bid amount with up to two decimal places.')
  }
  const note = body.note === undefined || body.note === null || body.note === '' ? null : body.note
  if (note !== null && (typeof note !== 'string' || note.trim().length > 500)) {
    throw new ApiError(400, 'A bid note must be 500 characters or less.')
  }
  return { amount, note: note?.trim() || null }
}

export async function listProductBids(request, response, next) {
  try {
    const id = productId(request)
    const product = await pool.query('SELECT owner_user_id, status, quantity, price, bidding_enabled, bidding_started_at, bidding_ends_at FROM products WHERE id = $1', [id])
    if (!product.rowCount || (product.rows[0].owner_user_id !== request.user.id && (product.rows[0].status !== 'active' || product.rows[0].quantity < 1 || !product.rows[0].bidding_enabled))) {
      throw new ApiError(404, 'Product not found.')
    }
    const result = await pool.query(
      `SELECT b.id, b.product_id AS "productId", b.bidder_user_id AS "bidderUserId",
       u.name AS "bidderName", b.amount, b.note, b.created_at AS "createdAt"
       FROM product_bids b JOIN users u ON u.id = b.bidder_user_id
       WHERE b.product_id = $1 AND b.created_at >= $2 ORDER BY b.amount DESC, b.created_at DESC`,
      [id, product.rows[0].bidding_started_at],
    )
    response.json({ bids: result.rows, openingPrice: product.rows[0].price, biddingEndsAt: product.rows[0].bidding_ends_at })
  } catch (error) { next(error) }
}

export async function listReceivedBids(request, response, next) {
  try {
    const result = await pool.query(
      `SELECT b.id, b.product_id AS "productId", b.bidder_user_id AS "bidderUserId",
       u.name AS "bidderName", b.amount, b.note, b.created_at AS "createdAt"
       FROM product_bids b JOIN products p ON p.id = b.product_id
       JOIN users u ON u.id = b.bidder_user_id
       WHERE p.owner_user_id = $1 ORDER BY b.created_at DESC`,
      [request.user.id],
    )
    response.json({ bids: result.rows })
  } catch (error) { next(error) }
}

export async function placeBid(request, response, next) {
  let client
  try {
    const id = productId(request)
    const { amount, note } = bidDetails(request.body)
    client = await pool.connect()
    await client.query('BEGIN')
    const product = await client.query('SELECT owner_user_id, status, quantity, price, bidding_enabled, bidding_started_at, bidding_ends_at FROM products WHERE id = $1 FOR UPDATE', [id])
    if (!product.rowCount || product.rows[0].status !== 'active' || product.rows[0].quantity < 1 || !product.rows[0].bidding_enabled) throw new ApiError(404, 'Active Live Deal not found.')
    if (product.rows[0].owner_user_id === request.user.id) throw new ApiError(403, 'You cannot bid on your own product.')
    if (!product.rows[0].bidding_ends_at || new Date(product.rows[0].bidding_ends_at) <= new Date()) throw new ApiError(409, 'Bidding has ended for this product.')
    const highest = await client.query('SELECT MAX(amount) AS amount FROM product_bids WHERE product_id = $1 AND created_at >= $2', [id, product.rows[0].bidding_started_at])
    const minimum = highest.rows[0].amount || product.rows[0].price
    if (Number(amount) <= Number(minimum)) throw new ApiError(409, `Bid more than Rs. ${minimum}.`)
    const result = await client.query(
      `INSERT INTO product_bids (product_id, bidder_user_id, amount, note) VALUES ($1, $2, $3, $4)
       RETURNING id, product_id AS "productId", bidder_user_id AS "bidderUserId", amount, note, created_at AS "createdAt"`,
      [id, request.user.id, amount, note],
    )
    await client.query('COMMIT')
    response.status(201).json({ bid: { ...result.rows[0], bidderName: request.user.name } })
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    next(error)
  } finally { client?.release() }
}
