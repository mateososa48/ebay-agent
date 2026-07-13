import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { createItem } from '../../db/repos/items';
import { createListing, getListing, updateListing } from '../../db/repos/listings';
import { applyListingEdit } from './editListing';

async function seed(db: TestDb) {
  const item = await createItem(db, { photos: [] });
  return createListing(db, {
    itemId: item.id,
    title: 'Old title',
    specifics: { Brand: 'X' },
    description: 'clean and honest',
    price: 40,
    condition: 'used_good',
  });
}

describe('applyListingEdit', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('updates the given fields, leaves the rest, and re-lints', async () => {
    db = await makeTestDb();
    const l = await seed(db);
    const res = await applyListingEdit(db, l.id, { price: 55, title: 'New clean title' });
    expect(res.ok).toBe(true);
    const after = await getListing(db, l.id);
    expect(after?.price).toBe(55);
    expect(after?.title).toBe('New clean title');
    expect(after?.specifics.Brand).toBe('X');
  });

  it('refuses a policy-breaking edit and leaves the listing unchanged', async () => {
    db = await makeTestDb();
    const l = await seed(db);
    const res = await applyListingEdit(db, l.id, { description: 'contact me at test@example.com' });
    expect(res.ok).toBe(false);
    expect((await getListing(db, l.id))?.description).toBe('clean and honest');
  });

  it('refuses editing a listing that is already live', async () => {
    db = await makeTestDb();
    const l = await seed(db);
    await updateListing(db, l.id, { status: 'live' });
    const res = await applyListingEdit(db, l.id, { price: 99 });
    expect(res.ok).toBe(false);
  });
});
