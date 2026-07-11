import { neon } from '@neondatabase/serverless';
import type { Db } from './types';

/**
 * Production Db backed by Neon's HTTP driver (`neon()`), not the WebSocket
 * `Pool` — HTTP needs no WebSocket global (works on Node 20) and is the
 * preferred path for serverless single-shot queries. Reads DATABASE_URL lazily.
 */
export function getDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const sql = neon(connectionString);
  return {
    query: (text, params) =>
      sql.query(text, params ?? []).then((rows) => ({ rows })) as Promise<{ rows: never[] }>,
  };
}
