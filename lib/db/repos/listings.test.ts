import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { createItem } from './items';
import { createListing, getListing, getListingByItem, updateListing, listListings } from './listings';

describe('listings repo', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('creates a draft listing and reads it back with correct types', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    const draft = await createListing(db, {
      itemId: item.id,
      title: "Levi's 501 34x32",
      specifics: { Brand: "Levi's", Size: '34x32' },
      description: 'Clean pair.',
      price: 48.5,
    });
    expect(draft.status).toBe('draft');
    expect(draft.price).toBe(48.5);              // numeric mapped to number, not string
    expect(draft.specifics).toEqual({ Brand: "Levi's", Size: '34x32' });

    const byId = await getListing(db, draft.id);
    expect(byId?.id).toBe(draft.id);
    const byItem = await getListingByItem(db, item.id);
    expect(byItem?.id).toBe(draft.id);
  });

  it('updates editable fields and status', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    const draft = await createListing(db, { itemId: item.id, title: 't', specifics: {}, description: '', price: 10 });
    await updateListing(db, draft.id, {
      title: 'better title',
      price: 55,
      status: 'live',
      ebayListingId: 'MOCK-1',
      linterReport: { ok: true, blocking: [], warnings: [] },
    });
    const updated = await getListing(db, draft.id);
    expect(updated?.title).toBe('better title');
    expect(updated?.price).toBe(55);
    expect(updated?.status).toBe('live');
    expect(updated?.ebayListingId).toBe('MOCK-1');
    expect((updated?.linterReport as { ok: boolean }).ok).toBe(true);
  });

  it('lists listings newest-first', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    const a = await createListing(db, { itemId: item.id, title: 'a', specifics: {}, description: '', price: 1 });
    const b = await createListing(db, { itemId: item.id, title: 'b', specifics: {}, description: '', price: 2 });
    const all = await listListings(db);
    expect(all.map((l) => l.id).slice(0, 2)).toEqual([b.id, a.id]);
  });
});
