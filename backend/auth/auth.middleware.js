import jwt from 'jsonwebtoken'
import pool from '../common/database/connection.js'
import { env } from '../common/config/env.js'
import { ApiError } from '../common/utils/ApiError.js'

const schemaPrefix = env.databaseSchema ? `${env.databaseSchema}.` : ''
const sessionQuery = env.databaseSchema ? pool.queryQualified : pool.query.bind(pool)

export async function authenticate(request, _response, next) {
  const match = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)
  if (!match) return next(new ApiError(401, 'Please log in to continue.'))

  try {
    const claims = jwt.verify(match[1], env.jwtSecret, { algorithms: ['HS256'] })
    if (!claims.jti || !claims.sub) throw new ApiError(401, 'Your session is invalid or has expired.')
    const result = await sessionQuery(
      `SELECT u.id, u.name, u.email, (u.profile_image_content IS NOT NULL) AS "hasProfileImage" FROM ${schemaPrefix}auth_sessions s
       JOIN ${schemaPrefix}users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
      [claims.jti, claims.sub],
    )
    if (!result.rowCount) throw new ApiError(401, 'Your session is invalid or has expired.')
    request.user = result.rows[0]
    request.sessionId = claims.jti
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, 'Your session is invalid or has expired.'))
    }
    next(error)
  }
}
