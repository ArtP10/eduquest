import { Pool } from 'pg';
import { config } from './config.js';

// Constructing a `Pool` does not open a connection — pg connects lazily on
// first query — so importing this module is always safe even if Postgres is
// never started. Auth routes are responsible for catching connection errors
// per-request (see auth/errors.ts) rather than letting them crash the process.
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: config.databaseUrl });
  }
  return pool;
}
