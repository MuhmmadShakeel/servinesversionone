import pg from 'pg'
import { env } from '../config/env.js'
const { Pool } = pg
const pool = new Pool({
  connectionString: env.databaseUrl,
  onConnect: env.databaseSchema ? async (client) => {
    const { rowCount } = await client.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [env.databaseSchema])
    if (!rowCount) throw new Error(`Database schema "${env.databaseSchema}" does not exist`)
  } : undefined,
})

// Transaction poolers may reset session settings between statements. Set the
// schema inside each transaction so every query resolves the same tables.
if (env.databaseSchema) {
  const connect = pool.connect.bind(pool)
  pool.queryQualified = async (sql, values) => {
    const client = await connect()
    try { return await client.query(sql, values) }
    finally { client.release() }
  }
  pool.connect = async () => {
    const client = await connect()
    const originalQuery = client.query
    const originalRelease = client.release
    const query = (...args) => originalQuery.call(client, ...args)
    client.query = async (sql, values) => typeof sql === 'string' && /^\s*BEGIN\s*;?\s*$/i.test(sql)
      ? query(`BEGIN; SET LOCAL search_path TO ${env.databaseSchema}`)
      : query(sql, values)
    client.release = (...args) => {
      client.query = originalQuery
      client.release = originalRelease
      return originalRelease.apply(client, args)
    }
    return client
  }
  pool.query = async (sql, values) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(sql, values)
      await client.query('COMMIT')
      return result
    } catch (error) {
      try { await client.query('ROLLBACK') } catch { /* The connection may already be gone. */ }
      throw error
    } finally {
      client.release()
    }
  }
}

export default pool
