import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { MockEbayAdapter } from '../../ebay/mock';
import { createItem, getItem } from '../../db/repos/items';
import { listCompsByItem } from '../../db/repos/comps';
import { recordIdentity } from './identify';
import { researchPrice } from './price';

describe('researchPrice', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('saves comps, computes an estimate within the comp range, and advances status', async () => {
    db = await makeTestDb();
    const adapter = new MockEbayAdapter();
    const item = await createItem(db, { photos: ['x'], sellerNotes: "Levi's 501 jeans" });
    await recordIdentity(db, item.id, {
      brand: "Levi's", productType: 'Straight Leg Jeans', aspects: { Size: '34x32' },
      condition: 'used_good', confidence: 0.85,
    });

    const est = await researchPrice(db, adapter, item.id);

    expect(est.comps.length).toBeGreaterThanOrEqual(3);
    expect(est.low).toBeLessThanOrEqual(est.suggested);
    expect(est.suggested).toBeLessThanOrEqual(est.high);
    expect(est.currency).toBe('USD');

    const saved = await listCompsByItem(db, item.id);
    expect(saved.length).toBe(est.comps.length);
    expect((await getItem(db, item.id))?.status).toBe('priced');
  });

  it('throws if the item was never identified', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await expect(researchPrice(db, new MockEbayAdapter(), item.id)).rejects.toThrow(/identified/);
  });
});
