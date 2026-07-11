import { PGlite } from '@electric-sql/pglite';
import type { Db } from './types';
import { applySchema } from './schema';

export interface TestDb extends Db {
  close(): Promise<void>;
}

/** A fresh in-process Postgres (PGlite) with the schema applied. Isolated per call. */
export async function makeTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  const query: Db['query'] = (text, params) =>
    pg.query(text, (params ?? []) as unknown[]) as Promise<{ rows: never[] }>;
  await applySchema({ query });
  return { query, close: () => pg.close() };
}
