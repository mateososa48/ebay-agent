import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { createItem } from './items';
import { replaceCompsForItem, listCompsByItem } from './comps';

describe('comps repo', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('replaces comps for an item and reads them back with numeric prices', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await replaceCompsForItem(db, item.id, [
      { source: 'ebay-active', title: 'comp 1', price: 40, sold: false, ref: 'r1', capturedAt: '2026-07-10T00:00:00.000Z' },
      { source: 'ebay-active', title: 'comp 2', price: 45.25, sold: true },
    ]);
    const comps = await listCompsByItem(db, item.id);
    expect(comps).toHaveLength(2);
    expect(comps[0]?.price).toBe(40);
    expect(comps.find((c) => c.title === 'comp 2')?.price).toBe(45.25);
    expect(comps.find((c) => c.title === 'comp 2')?.sold).toBe(true);
  });

  it('replacing clears the previous comps', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await replaceCompsForItem(db, item.id, [{ source: 's', title: 'old', price: 1, sold: false }]);
    await replaceCompsForItem(db, item.id, [{ source: 's', title: 'new', price: 2, sold: false }]);
    const comps = await listCompsByItem(db, item.id);
    expect(comps.map((c) => c.title)).toEqual(['new']);
  });
});
