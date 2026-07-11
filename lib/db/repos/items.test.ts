import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { createItem, getItem, listItems, updateItemStatus, setItemEnrichment } from './items';

describe('items repo', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('creates and reads an item', async () => {
    db = await makeTestDb();
    const created = await createItem(db, { photos: ['blob://a.jpg', 'blob://b.jpg'], sellerNotes: "Levi's 501" });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.photos).toEqual(['blob://a.jpg', 'blob://b.jpg']);
    expect(created.sellerNotes).toBe("Levi's 501");
    expect(created.status).toBe('draft');

    const fetched = await getItem(db, created.id);
    expect(fetched?.id).toBe(created.id);
  });

  it('returns null for a missing item', async () => {
    db = await makeTestDb();
    expect(await getItem(db, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('lists items newest-first', async () => {
    db = await makeTestDb();
    const a = await createItem(db, { photos: [] });
    const b = await createItem(db, { photos: [] });
    const all = await listItems(db);
    expect(all.map((i) => i.id).slice(0, 2)).toEqual([b.id, a.id]);
  });

  it('updates status', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await updateItemStatus(db, item.id, 'priced');
    expect((await getItem(db, item.id))?.status).toBe('priced');
  });

  it('stores enrichment (identity/condition/measurements) as jsonb round-trips', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await setItemEnrichment(db, item.id, {
      identity: { brand: "Levi's", productType: 'Jeans', aspects: { Size: '34x32' }, confidence: 0.9, ambiguities: [] },
      condition: { grade: 'used_good', flaws: ['knee fade'] },
      measurements: { waistIn: 34 },
    });
    const got = await getItem(db, item.id);
    expect((got?.identity as { brand: string }).brand).toBe("Levi's");
    expect((got?.condition as { flaws: string[] }).flaws).toEqual(['knee fade']);
    expect((got?.measurements as { waistIn: number }).waistIn).toBe(34);
  });

  it('setItemEnrichment leaves omitted fields untouched', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await setItemEnrichment(db, item.id, { identity: { brand: "Levi's" } });
    await setItemEnrichment(db, item.id, { condition: { grade: 'used_good' } });
    const got = await getItem(db, item.id);
    // The second call omitted identity — it must NOT have been wiped.
    expect((got?.identity as { brand: string }).brand).toBe("Levi's");
    expect((got?.condition as { grade: string }).grade).toBe('used_good');
  });

  it('rejects an invalid status via the DB CHECK constraint', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await expect(updateItemStatus(db, item.id, 'bogus')).rejects.toThrow();
  });
});
