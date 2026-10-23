import { fileURLToPath } from 'node:url'
import path from 'node:path'
import app from './app.js'
import { env } from './common/config/env.js'
import { setReady } from './common/config/readiness.js'
import pool from './common/database/connection.js'
import { migrate } from './common/database/migrate.js'

const transientCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH'])

function isTransientConnectionError(error) {
  return Boolean(error && (
    transientCodes.has(error.code) ||
    /connection terminated unexpectedly|connection timeout|server closed the connection/i.test(error.message || '') ||
    isTransientConnectionError(error.cause) ||
    error.errors?.some(isTransientConnectionError)
  ))
}

async function retryDatabase(operation) {
  for (let attempt = 1; ; attempt += 1) {
    try { return await operation() }
    catch (error) {
      if (!isTransientConnectionError(error)) throw error
      const delay = Math.min(1000 * 2 ** Math.min(attempt - 1, 5), 30000)
      console.warn(`Database connection unavailable (${error.message || error.code}); retrying in ${delay / 1000}s.`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

export async function startServer() {
  setReady(false)
  await new Promise((resolve, reject) => {
    const server = app.listen(env.port, resolve)
    server.once('error', reject)
  })
  console.log(`Servnix HTTP server listening on port ${env.port}; waiting for database.`)
  await retryDatabase(() => pool.query('SELECT 1'))
  await retryDatabase(migrate)
  setReady(true)
  console.log(`Servnix API ready on port ${env.port}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error('Unable to start Servnix API:', error.message)
    process.exit(1)
  })
}

export default app
