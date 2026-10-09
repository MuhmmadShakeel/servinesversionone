import pool from '../common/database/connection.js'
import { ApiError } from '../common/utils/ApiError.js'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const validId = (value) => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new ApiError(400, 'Invalid chat reference.')
  return value
}

const conversationColumns = `c.id, c.listing_type AS "listingType", c.listing_id AS "listingId",
  c.listing_title AS "listingTitle", c.requester_user_id AS "requesterUserId",
  c.owner_user_id AS "ownerUserId", c.updated_at AS "updatedAt",
  CASE WHEN c.owner_user_id = $1 THEN requester.name ELSE owner.name END AS "otherUserName",
  CASE WHEN c.owner_user_id = $1 THEN requester.id ELSE owner.id END AS "otherUserId",
  (SELECT m.body FROM chat_messages m WHERE m.conversation_id = c.id
   AND m.created_at > COALESCE(CASE WHEN c.owner_user_id = $1 THEN c.owner_cleared_at ELSE c.requester_cleared_at END, '-infinity'::timestamptz)
   ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS "lastMessage"`
const conversationFrom = `FROM chat_conversations c
  JOIN users requester ON requester.id = c.requester_user_id
  JOIN users owner ON owner.id = c.owner_user_id`

async function resolveContext(context, id, userId, database = pool) {
  const queries = {
    service: `SELECT id AS "listingId", owner_user_id AS "ownerUserId", title AS "listingTitle",
      $2::uuid AS "requesterUserId", 'service' AS "listingType"
      FROM services WHERE id = $1 AND status = 'active'`,
    hiring: `SELECT id AS "listingId", owner_user_id AS "ownerUserId", title AS "listingTitle",
      $2::uuid AS "requesterUserId", 'hiring' AS "listingType"
      FROM hiring_requirements WHERE id = $1 AND status = 'open'`,
    product: `SELECT id AS "listingId", owner_user_id AS "ownerUserId", title AS "listingTitle",
      $2::uuid AS "requesterUserId", 'product' AS "listingType"
      FROM products WHERE id = $1 AND status = 'active' AND quantity > 0`,
    cart: `SELECT p.id AS "listingId", p.owner_user_id AS "ownerUserId", p.title AS "listingTitle",
      c.user_id AS "requesterUserId", 'product' AS "listingType"
      FROM product_cart c JOIN products p ON p.id = c.product_id
      WHERE c.product_id = $1 AND c.user_id = $2`,
    booking: `SELECT service_id AS "listingId", owner_user_id AS "ownerUserId",
      service_title AS "listingTitle", buyer_user_id AS "requesterUserId", 'service' AS "listingType"
      FROM service_bookings WHERE id = $1 AND (buyer_user_id = $2 OR owner_user_id = $2)`,
    proposal: `SELECT p.requirement_id AS "listingId", h.owner_user_id AS "ownerUserId",
      h.title AS "listingTitle", p.worker_user_id AS "requesterUserId", 'hiring' AS "listingType"
      FROM hiring_proposals p JOIN hiring_requirements h ON h.id = p.requirement_id
      WHERE p.id = $1 AND (p.worker_user_id = $2 OR h.owner_user_id = $2)`,
    order: `SELECT product_id AS "listingId", seller_user_id AS "ownerUserId",
      product_title AS "listingTitle", buyer_user_id AS "requesterUserId", 'product' AS "listingType"
      FROM product_orders WHERE id = $1 AND (buyer_user_id = $2 OR seller_user_id = $2)`,
  }
  if (!Object.hasOwn(queries, context)) throw new ApiError(400, 'Choose a valid listing or order to start a chat.')
  const result = await database.query(queries[context], [id, userId])
  if (!result.rowCount) throw new ApiError(404, 'This listing or activity is unavailable.')
  const item = result.rows[0]
  if (item.ownerUserId === item.requesterUserId) throw new ApiError(403, 'You cannot start a chat with yourself.')
  return item
}

async function readConversation(id, userId, database = pool) {
  const result = await database.query(
    `SELECT ${conversationColumns} ${conversationFrom}
     WHERE c.id = $2 AND (c.requester_user_id = $1 OR c.owner_user_id = $1)`,
    [userId, id],
  )
  return result.rows[0]
}

export async function startConversation(request, response, next) {
  let client
  try {
    const { context, id } = request.body || {}
    if (!request.body || Object.keys(request.body).some((key) => !['context', 'id'].includes(key))) {
      throw new ApiError(400, 'Only context and id are accepted.')
    }
    client = await pool.connect()
    await client.query('BEGIN')
    const item = await resolveContext(context, validId(id), request.user.id, client)
    const result = await client.query(
      `INSERT INTO chat_conversations
       (listing_type, listing_id, listing_title, requester_user_id, owner_user_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (listing_type, listing_id, requester_user_id)
       DO UPDATE SET listing_title = EXCLUDED.listing_title
       RETURNING id`,
      [item.listingType, item.listingId, item.listingTitle, item.requesterUserId, item.ownerUserId],
    )
    const conversation = await readConversation(result.rows[0].id, request.user.id, client)
    await client.query('COMMIT')
    response.status(200).json({ conversation })
  } catch (error) {
    if (client) try { await client.query('ROLLBACK') } catch { /* Connection may be closed. */ }
    next(error)
  } finally { client?.release() }
}

export async function listConversations(request, response, next) {
  try {
    const result = await pool.query(
      `SELECT ${conversationColumns} ${conversationFrom}
       WHERE c.requester_user_id = $1 OR c.owner_user_id = $1
       ORDER BY c.updated_at DESC, c.id DESC`,
      [request.user.id],
    )
    response.json({ conversations: result.rows })
  } catch (error) { next(error) }
}

export async function listMessages(request, response, next) {
  try {
    const conversationId = validId(request.params.id)
    if (!await readConversation(conversationId, request.user.id)) throw new ApiError(404, 'Chat not found.')
    const before = request.query.before ? validId(request.query.before) : null
    let cursor = null
    if (before) {
      const found = await pool.query('SELECT created_at, id FROM chat_messages WHERE id = $1 AND conversation_id = $2', [before, conversationId])
      if (!found.rowCount) throw new ApiError(400, 'Invalid message cursor.')
      cursor = found.rows[0]
    }
    const result = await pool.query(
      `SELECT m.id, m.conversation_id AS "conversationId", m.sender_user_id AS "senderUserId",
        u.name AS "senderName", m.body, m.created_at AS "createdAt", m.edited_at AS "editedAt"
       FROM chat_messages m JOIN users u ON u.id = m.sender_user_id
       JOIN chat_conversations c ON c.id = m.conversation_id
       WHERE m.conversation_id = $1
         AND m.created_at > COALESCE(CASE WHEN c.owner_user_id = $4 THEN c.owner_cleared_at ELSE c.requester_cleared_at END, '-infinity'::timestamptz)
         AND ($2::timestamptz IS NULL OR (m.created_at, m.id) < ($2::timestamptz, $3::uuid))
       ORDER BY m.created_at DESC, m.id DESC LIMIT 51`,
      [conversationId, cursor?.created_at || null, cursor?.id || null, request.user.id],
    )
    const page = result.rows.slice(0, 50)
    response.json({ messages: page.reverse(), nextCursor: result.rows.length > 50 ? result.rows[49].id : null })
  } catch (error) { next(error) }
}

export async function sendMessage(request, response, next) {
  let client
  try {
    const conversationId = validId(request.params.id)
    if (!request.body || Object.keys(request.body).some((key) => key !== 'body')) throw new ApiError(400, 'Only a message is accepted.')
    const body = request.body.body
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 2000) throw new ApiError(400, 'Write a message of 1 to 2000 characters.')
    client = await pool.connect()
    await client.query('BEGIN')
    const result = await client.query(
      `INSERT INTO chat_messages (conversation_id, sender_user_id, body)
       SELECT c.id, $2, $3 FROM chat_conversations c
       WHERE c.id = $1 AND (c.requester_user_id = $2 OR c.owner_user_id = $2)
       RETURNING id, conversation_id AS "conversationId", sender_user_id AS "senderUserId", body, created_at AS "createdAt", edited_at AS "editedAt"`,
      [conversationId, request.user.id, body.trim()],
    )
    if (!result.rowCount) throw new ApiError(404, 'Chat not found.')
    await client.query('UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1', [conversationId])
    await client.query('COMMIT')
    response.status(201).json({ message: { ...result.rows[0], senderName: request.user.name } })
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    next(error)
  } finally { client?.release() }
}

export async function editMessage(request, response, next) {
  try {
    const conversationId = validId(request.params.id)
    const messageId = validId(request.params.messageId)
    if (!request.body || Object.keys(request.body).some((key) => key !== 'body')) throw new ApiError(400, 'Only a message is accepted.')
    const body = request.body.body
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 2000) throw new ApiError(400, 'Write a message of 1 to 2000 characters.')
    const result = await pool.query(
      `UPDATE chat_messages m SET body = $4, edited_at = NOW()
       FROM chat_conversations c
       WHERE m.id = $1 AND m.conversation_id = $2 AND c.id = m.conversation_id
         AND m.sender_user_id = $3
         AND (c.owner_user_id = $3 OR c.requester_user_id = $3)
         AND m.created_at > COALESCE(CASE WHEN c.owner_user_id = $3 THEN c.owner_cleared_at ELSE c.requester_cleared_at END, '-infinity'::timestamptz)
       RETURNING m.id, m.conversation_id AS "conversationId", m.sender_user_id AS "senderUserId",
         m.body, m.created_at AS "createdAt", m.edited_at AS "editedAt"`,
      [messageId, conversationId, request.user.id, body.trim()],
    )
    if (!result.rowCount) throw new ApiError(404, 'Your message was not found.')
    response.json({ message: { ...result.rows[0], senderName: request.user.name } })
  } catch (error) { next(error) }
}

export async function deleteMessage(request, response, next) {
  try {
    const result = await pool.query(
      `DELETE FROM chat_messages m USING chat_conversations c
       WHERE m.id = $1 AND m.conversation_id = $2 AND c.id = m.conversation_id
         AND m.sender_user_id = $3
         AND (c.owner_user_id = $3 OR c.requester_user_id = $3)
         AND m.created_at > COALESCE(CASE WHEN c.owner_user_id = $3 THEN c.owner_cleared_at ELSE c.requester_cleared_at END, '-infinity'::timestamptz)
       RETURNING m.id`,
      [validId(request.params.messageId), validId(request.params.id), request.user.id],
    )
    if (!result.rowCount) throw new ApiError(404, 'Your message was not found.')
    response.status(204).end()
  } catch (error) { next(error) }
}

export async function clearConversation(request, response, next) {
  try {
    const result = await pool.query(
      `UPDATE chat_conversations SET
         requester_cleared_at = CASE WHEN requester_user_id = $2 THEN NOW() ELSE requester_cleared_at END,
         owner_cleared_at = CASE WHEN owner_user_id = $2 THEN NOW() ELSE owner_cleared_at END
       WHERE id = $1 AND (requester_user_id = $2 OR owner_user_id = $2)
       RETURNING id`,
      [validId(request.params.id), request.user.id],
    )
    if (!result.rowCount) throw new ApiError(404, 'Chat not found.')
    response.status(204).end()
  } catch (error) { next(error) }
}
