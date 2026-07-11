import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { createItem } from '../../db/repos/items';
import { getListing } from '../../db/repos/listings';
import { listPendingApprovals } from '../../db/repos/approvals';
import type { ListingDraft } from '../../types';
import { saveListingDraft } from './saveDraft';

const cleanDraft: ListingDraft = {
  title: "Levi's 501 Vintage Jeans Men's 34x32 Straight Leg Dark Wash",
  aspects: { Brand: "Levi's", Size: '34x32' },
  description: "Men's Levi's 501s, 34x32, dark wash. Small fade at the left knee, shown in photo 3. Ships next day.",
  price: 48,
  condition: 'used_good',
};

describe('saveListingDraft', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('saves a clean draft, attaches the linter report, and enqueues an approval', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });

    const res = await saveListingDraft(db, item.id, cleanDraft);

    const listing = await getListing(db, res.listingId);
    expect(listing?.title).toBe(cleanDraft.title);
    expect(listing?.status).toBe('draft');
    expect((listing?.linterReport as { ok: boolean }).ok).toBe(true);

    const pending = await listPendingApprovals(db);
    expect(pending.some((a) => a.type === 'listing' && a.refId === res.listingId)).toBe(true);
  });

  it('refuses to save a draft with blocking compliance issues', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    const bad: ListingDraft = { ...cleanDraft, description: 'Email me at seller@gmail.com to buy.' };
    await expect(saveListingDraft(db, item.id, bad)).rejects.toThrow(/blocking/);
    // nothing queued
    expect(await listPendingApprovals(db)).toHaveLength(0);
  });
});
