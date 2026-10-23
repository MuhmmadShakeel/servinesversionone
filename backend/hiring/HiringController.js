import pool from '../common/database/connection.js'
import { ApiError } from '../common/utils/ApiError.js'
import { assertUuid, validateProposal, validateRequirement } from './hiringValidation.js'
import { readVoice, removeVoice, saveVoice } from '../common/voice/voiceStorage.js'
import { boostJoin, boostOrder, boostPercentage } from '../boosts/boostRanking.js'

const requirementColumns = `h.id, h.owner_user_id AS "ownerUserId", u.name AS "ownerName",
  h.title, h.category, h.description, h.budget_min AS "budgetMin", h.budget_max AS "budgetMax",
  h.status, h.share_count AS "shareCount", (h.voice_file IS NOT NULL) AS "hasVoice",
  h.voice_duration_seconds AS "voiceDurationSeconds", h.created_at AS "createdAt", h.updated_at AS "updatedAt",
  COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM job_reviews r WHERE r.requirement_id = h.id), 0) AS "ratingAverage",
  (SELECT COUNT(*)::integer FROM job_reviews r WHERE r.requirement_id = h.id) AS "ratingCount",
  (SELECT COUNT(*)::integer FROM hiring_proposals p WHERE p.requirement_id = h.id) AS "proposalCount",
  COALESCE((SELECT json_agg(json_build_object('id', m.id, 'kind', m.kind, 'mimeType', m.mime_type,
    'fileName', m.file_name, 'sizeBytes', m.size_bytes) ORDER BY m.created_at)
    FROM hiring_media m WHERE m.requirement_id = h.id), '[]'::json) AS media`

async function readRequirement(client, id, viewerId) {
  const result = await client.query(
    `SELECT ${requirementColumns} FROM hiring_requirements h JOIN users u ON u.id = h.owner_user_id
     WHERE h.id = $1 AND (h.status = 'open' OR h.owner_user_id = $2 OR EXISTS
       (SELECT 1 FROM hiring_proposals p WHERE p.requirement_id = h.id AND p.worker_user_id = $2))`,
    [id, viewerId],
  )
  if (!result.rowCount) throw new ApiError(404, 'Requirement not found.')
  return result.rows[0]
}

async function saveMedia(client, requirementId, media) {
  for (const file of media || []) {
    await client.query(
      `INSERT INTO hiring_media (requirement_id, kind, mime_type, file_name, content, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [requirementId, file.kind, file.mimeType, file.fileName, file.content, file.content.length],
    )
  }
}

export async function browseRequirements(request, response, next) {
  try {
    const result = await pool.query(`SELECT ${requirementColumns}, ranking.expires_at AS "boostExpiresAt", ${boostPercentage}
      FROM hiring_requirements h JOIN users u ON u.id = h.owner_user_id
      ${boostJoin('hiring', 'h')}
      WHERE h.status = 'open' ORDER BY ${boostOrder}, h.created_at DESC, h.id LIMIT 100`)
    response.json({ requirements: result.rows })
  } catch (error) { next(error) }
}

export async function myRequirements(request, response, next) {
  try {
    const result = await pool.query(`SELECT ${requirementColumns} FROM hiring_requirements h JOIN users u ON u.id = h.owner_user_id WHERE h.owner_user_id = $1 ORDER BY h.created_at DESC`, [request.user.id])
    response.json({ requirements: result.rows })
  } catch (error) { next(error) }
}

export async function getRequirement(request, response, next) {
  try { response.json({ requirement: await readRequirement(pool, assertUuid(request.params.id), request.user.id) }) }
  catch (error) { next(error) }
}

export async function createRequirement(request, response, next) {
  let client
  let savedVoice
  let committed = false
  try {
    const item = validateRequirement(request.body)
    savedVoice = await saveVoice(item.voice, request.user.id)
    client = await pool.connect()
    await client.query('BEGIN')
    const result = await client.query(
      `INSERT INTO hiring_requirements (owner_user_id, title, category, description, budget_min, budget_max, status, voice_file, voice_mime_type, voice_duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [request.user.id, item.title, item.category, item.description, item.budgetMin, item.budgetMax, item.status,
        savedVoice?.file || null, savedVoice?.mimeType || null, savedVoice?.durationSeconds || null],
    )
    const id = result.rows[0].id
    await saveMedia(client, id, item.media)
    await client.query('COMMIT')
    committed = true
    response.status(201).json({ requirement: await readRequirement(pool, id, request.user.id) })
  } catch (error) {
    if (client && !committed) await client.query('ROLLBACK')
    if (savedVoice && !committed) await removeVoice(savedVoice.file).catch(console.error)
    next(error)
  } finally { client?.release() }
}

export async function updateRequirement(request, response, next) {
  let client
  let savedVoice
  let committed = false
  try {
    const id = assertUuid(request.params.id)
    const item = validateRequirement(request.body)
    savedVoice = await saveVoice(item.voice, request.user.id)
    client = await pool.connect()
    await client.query('BEGIN')
    const current = await client.query('SELECT status, voice_file FROM hiring_requirements WHERE id = $1 AND owner_user_id = $2 FOR UPDATE', [id, request.user.id])
    if (!current.rowCount) throw new ApiError(404, 'Requirement not found.')
    if (current.rows[0].status === 'awarded') throw new ApiError(409, 'An awarded requirement cannot be edited.')
    const voiceSql = item.voice === undefined ? '' : ', voice_file = $9, voice_mime_type = $10, voice_duration_seconds = $11'
    const values = [id, request.user.id, item.title, item.category, item.description, item.budgetMin, item.budgetMax, item.status]
    if (item.voice !== undefined) values.push(savedVoice?.file || null, savedVoice?.mimeType || null, savedVoice?.durationSeconds || null)
    await client.query(
      `UPDATE hiring_requirements SET title = $3, category = $4, description = $5,
       budget_min = $6, budget_max = $7, status = $8${voiceSql}, updated_at = NOW()
       WHERE id = $1 AND owner_user_id = $2`,
      values,
    )
    if (item.media !== undefined) {
      await client.query('DELETE FROM hiring_media WHERE requirement_id = $1', [id])
      await saveMedia(client, id, item.media)
    }
    await client.query('COMMIT')
    committed = true
    if (item.voice !== undefined && current.rows[0].voice_file) await removeVoice(current.rows[0].voice_file).catch(console.error)
    response.json({ requirement: await readRequirement(pool, id, request.user.id) })
  } catch (error) {
    if (client && !committed) await client.query('ROLLBACK')
    if (savedVoice && !committed) await removeVoice(savedVoice.file).catch(console.error)
    next(error)
  } finally { client?.release() }
}

export async function deleteRequirement(request, response, next) {
  try {
    const result = await pool.query('DELETE FROM hiring_requirements WHERE id = $1 AND owner_user_id = $2 RETURNING id, voice_file', [assertUuid(request.params.id), request.user.id])
    if (!result.rowCount) throw new ApiError(404, 'Requirement not found.')
    if (result.rows[0].voice_file) await removeVoice(result.rows[0].voice_file).catch(console.error)
    response.status(204).end()
  } catch (error) { next(error) }
}

export async function getRequirementVoice(request, response, next) {
  try {
    const result = await pool.query(
      `SELECT h.voice_file, h.voice_mime_type FROM hiring_requirements h WHERE h.id = $1
       AND (h.status = 'open' OR h.owner_user_id = $2 OR EXISTS
         (SELECT 1 FROM hiring_proposals p WHERE p.requirement_id = h.id AND p.worker_user_id = $2))`,
      [assertUuid(request.params.id), request.user.id],
    )
    if (!result.rowCount || !result.rows[0].voice_file) throw new ApiError(404, 'Voice note not found.')
    response.set('Cache-Control', 'private, no-store')
    response.set('X-Content-Type-Options', 'nosniff')
    response.type(result.rows[0].voice_mime_type).send(await readVoice(result.rows[0].voice_file))
  } catch (error) { next(error) }
}

export async function getMedia(request, response, next) {
  try {
    const result = await pool.query(
      `SELECT m.content, m.mime_type
       FROM hiring_media m JOIN hiring_requirements h ON h.id = m.requirement_id
       WHERE m.id = $1 AND (h.status = 'open' OR h.owner_user_id = $2 OR EXISTS
         (SELECT 1 FROM hiring_proposals p WHERE p.requirement_id = h.id AND p.worker_user_id = $2))`,
      [assertUuid(request.params.id), request.user.id],
    )
    const file = result.rows[0]
    if (!file) throw new ApiError(404, 'Attachment not found.')
    response.set('Cache-Control', 'no-store')
    response.set('X-Content-Type-Options', 'nosniff')
    response.type(file.mime_type).send(file.content)
  } catch (error) { next(error) }
}

export async function myProposals(request, response, next) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.requirement_id AS "requirementId", p.worker_user_id AS "workerUserId",
       p.cover_letter AS "coverLetter", p.bid_amount AS "bidAmount", p.delivery_days AS "deliveryDays",
       p.status, p.created_at AS "createdAt", p.updated_at AS "updatedAt",
       h.title AS "requirementTitle", h.status AS "requirementStatus", h.category,
       owner.name AS "clientName"
       FROM hiring_proposals p JOIN hiring_requirements h ON h.id = p.requirement_id
       JOIN users owner ON owner.id = h.owner_user_id
       WHERE p.worker_user_id = $1 ORDER BY p.created_at DESC`,
      [request.user.id],
    )
    response.json({ proposals: result.rows })
  } catch (error) { next(error) }
}

export async function listProposals(request, response, next) {
  try {
    const id = assertUuid(request.params.id)
    const owner = await pool.query('SELECT 1 FROM hiring_requirements WHERE id = $1 AND owner_user_id = $2', [id, request.user.id])
    if (!owner.rowCount) throw new ApiError(404, 'Requirement not found.')
    const result = await pool.query(
      `SELECT p.id, p.requirement_id AS "requirementId", p.worker_user_id AS "workerUserId",
       worker.name AS "workerName", p.cover_letter AS "coverLetter", p.bid_amount AS "bidAmount",
       p.delivery_days AS "deliveryDays", p.status, p.created_at AS "createdAt"
       FROM hiring_proposals p JOIN users worker ON worker.id = p.worker_user_id
       WHERE p.requirement_id = $1 ORDER BY p.created_at DESC`, [id],
    )
    response.json({ proposals: result.rows })
  } catch (error) { next(error) }
}

export async function submitProposal(request, response, next) {
  let client
  try {
    const id = assertUuid(request.params.id)
    const proposal = validateProposal(request.body)
    client = await pool.connect()
    await client.query('BEGIN')
    const requirement = await client.query('SELECT owner_user_id, status FROM hiring_requirements WHERE id = $1 FOR UPDATE', [id])
    if (!requirement.rowCount || requirement.rows[0].status !== 'open') throw new ApiError(404, 'Open requirement not found.')
    if (requirement.rows[0].owner_user_id === request.user.id) throw new ApiError(403, 'You cannot propose on your own requirement.')
    const result = await client.query(
      `INSERT INTO hiring_proposals (requirement_id, worker_user_id, cover_letter, bid_amount, delivery_days)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [id, request.user.id, proposal.coverLetter, proposal.bidAmount, proposal.deliveryDays],
    )
    await client.query('COMMIT')
    response.status(201).json({ id: result.rows[0].id, message: 'Proposal submitted.' })
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    next(error.code === '23505' ? new ApiError(409, 'You already proposed on this requirement.') : error)
  } finally { client?.release() }
}

export async function updateProposal(request, response, next) {
  let client
  try {
    const id = assertUuid(request.params.id)
    const proposal = validateProposal(request.body)
    client = await pool.connect()
    await client.query('BEGIN')
    const existing = await client.query('SELECT requirement_id FROM hiring_proposals WHERE id = $1 AND worker_user_id = $2', [id, request.user.id])
    if (!existing.rowCount) throw new ApiError(404, 'Editable proposal not found.')
    await client.query('SELECT id FROM hiring_requirements WHERE id = $1 FOR UPDATE', [existing.rows[0].requirement_id])
    const result = await client.query(
      `UPDATE hiring_proposals p SET cover_letter = $3, bid_amount = $4, delivery_days = $5, updated_at = NOW()
       WHERE p.id = $1 AND p.worker_user_id = $2 AND p.status = 'pending'
       AND EXISTS (SELECT 1 FROM hiring_requirements h WHERE h.id = p.requirement_id AND h.status = 'open')
       RETURNING p.id`,
      [id, request.user.id, proposal.coverLetter, proposal.bidAmount, proposal.deliveryDays],
    )
    if (!result.rowCount) throw new ApiError(404, 'Editable proposal not found.')
    await client.query('COMMIT')
    response.json({ message: 'Proposal updated.' })
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    next(error)
  } finally { client?.release() }
}

export async function deleteProposal(request, response, next) {
  let client
  try {
    const id = assertUuid(request.params.id)
    client = await pool.connect()
    await client.query('BEGIN')
    const existing = await client.query('SELECT requirement_id FROM hiring_proposals WHERE id = $1 AND worker_user_id = $2', [id, request.user.id])
    if (!existing.rowCount) throw new ApiError(404, 'Withdrawable proposal not found.')
    await client.query('SELECT id FROM hiring_requirements WHERE id = $1 FOR UPDATE', [existing.rows[0].requirement_id])
    const result = await client.query(
      `DELETE FROM hiring_proposals p WHERE p.id = $1 AND p.worker_user_id = $2 AND p.status = 'pending'
       AND EXISTS (SELECT 1 FROM hiring_requirements h WHERE h.id = p.requirement_id AND h.status = 'open') RETURNING id`,
      [id, request.user.id],
    )
    if (!result.rowCount) throw new ApiError(404, 'Withdrawable proposal not found.')
    await client.query('COMMIT')
    response.status(204).end()
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    next(error)
  } finally { client?.release() }
}

export async function acceptProposal(request, response, next) {
  let client
  try {
    const requirementId = assertUuid(request.params.id)
    const proposalId = assertUuid(request.params.proposalId)
    client = await pool.connect()
    await client.query('BEGIN')
    const requirement = await client.query('SELECT status FROM hiring_requirements WHERE id = $1 AND owner_user_id = $2 FOR UPDATE', [requirementId, request.user.id])
    if (!requirement.rowCount) throw new ApiError(404, 'Requirement not found.')
    if (requirement.rows[0].status !== 'open') throw new ApiError(409, 'Only an open requirement can accept a proposal.')
    const chosen = await client.query('SELECT id FROM hiring_proposals WHERE id = $1 AND requirement_id = $2 AND status = $3', [proposalId, requirementId, 'pending'])
    if (!chosen.rowCount) throw new ApiError(404, 'Proposal not found.')
    await client.query("UPDATE hiring_proposals SET status = 'rejected', updated_at = NOW() WHERE requirement_id = $1 AND status = 'pending' AND id <> $2", [requirementId, proposalId])
    await client.query("UPDATE hiring_proposals SET status = 'accepted', updated_at = NOW() WHERE id = $1", [proposalId])
    await client.query("UPDATE hiring_requirements SET status = 'awarded', updated_at = NOW() WHERE id = $1", [requirementId])
    await client.query('COMMIT')
    response.json({ message: 'Proposal accepted.' })
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    next(error)
  } finally { client?.release() }
}

export async function rejectProposal(request, response, next) {
  let client
  try {
    const requirementId = assertUuid(request.params.id)
    const proposalId = assertUuid(request.params.proposalId)
    client = await pool.connect()
    await client.query('BEGIN')
    const requirement = await client.query('SELECT status FROM hiring_requirements WHERE id = $1 AND owner_user_id = $2 FOR UPDATE', [requirementId, request.user.id])
    if (!requirement.rowCount) throw new ApiError(404, 'Requirement not found.')
    if (requirement.rows[0].status !== 'open') throw new ApiError(409, 'Only an open requirement can reject a proposal.')
    const rejected = await client.query("UPDATE hiring_proposals SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND requirement_id = $2 AND status = 'pending' RETURNING id", [proposalId, requirementId])
    if (!rejected.rowCount) throw new ApiError(404, 'Pending proposal not found.')
    await client.query('COMMIT')
    response.json({ message: 'Proposal rejected.' })
  } catch (error) {
    if (client) await client.query('ROLLBACK')
    next(error)
  } finally { client?.release() }
}
