import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from './testdb';

describe('applySchema', () => {
  let db: TestDb | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('creates all six tables', async () => {
    db = await makeTestDb();
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(['approvals', 'comps', 'ebay_connection', 'events', 'items', 'listings']);
  });

  it('is idempotent (safe to apply twice)', async () => {
    db = await makeTestDb();
    // makeTestDb already applied once; applying again must not throw.
    const { applySchema } = await import('./schema');
    await expect(applySchema(db)).resolves.toBeUndefined();
  });
});
