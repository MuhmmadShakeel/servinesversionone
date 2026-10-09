import { fileURLToPath } from 'node:url'
import path from 'node:path'
import app from './app.js'
import { env } from './common/config/env.js'
import pool from './common/database/connection.js'
import { migrate } from './common/database/migrate.js'

export async function startServer() {
  await pool.query('SELECT 1')
  await migrate()
  app.listen(env.port, () => console.log(`Servnix API listening on port ${env.port}`))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((error) => {
    console.error('Unable to start Servnix API:', error)
    process.exit(1)
  })
}

export default app
