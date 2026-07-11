import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { MockEbayAdapter } from '../../ebay/mock';
import { createItem, getItem } from '../../db/repos/items';
import { listEventsByItem } from '../../db/repos/events';
import { identifyItem } from './identify';

describe('identifyItem', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('identifies the item, persists the identity, advances status, and logs an event', async () => {
    db = await makeTestDb();
    const adapter = new MockEbayAdapter();
    const item = await createItem(db, { photos: ['blob://a.jpg'], sellerNotes: "Levi's 501 jeans 34x32" });

    const identity = await identifyItem(db, adapter, item.id);

    expect(identity.brand).toBe("Levi's");
    const saved = await getItem(db, item.id);
    expect((saved?.identity as { brand: string }).brand).toBe("Levi's");
    expect(saved?.status).toBe('identifying');
    const events = await listEventsByItem(db, item.id);
    expect(events.some((e) => e.kind === 'identified')).toBe(true);
  });

  it('throws for a missing item', async () => {
    db = await makeTestDb();
    await expect(identifyItem(db, new MockEbayAdapter(), '00000000-0000-0000-0000-000000000000'))
      .rejects.toThrow(/not found/);
  });
});
