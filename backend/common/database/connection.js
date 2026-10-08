import pg from 'pg'
import { env } from '../config/env.js'
const { Pool } = pg
export default new Pool({
  connectionString: env.databaseUrl,
  onConnect: env.databaseSchema ? async (client) => {
    const { rowCount } = await client.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [env.databaseSchema])
    if (!rowCount) throw new Error(`Database schema "${env.databaseSchema}" does not exist`)
    await client.query('SELECT set_config($1, $2, false)', ['search_path', env.databaseSchema])
  } : undefined,
})
