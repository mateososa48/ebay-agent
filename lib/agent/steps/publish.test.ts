// lib/agent/steps/publish.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { createItem, getItem } from '../../db/repos/items';
import { createListing, getListing } from '../../db/repos/listings';
import { enqueueApproval, getApproval } from '../../db/repos/approvals';
import { MockEbayAdapter } from '../../ebay/mock';
import type { EbayAdapter } from '../../ebay/types';
import { publishApprovedListing } from './publish';

const DEPS = { resolveCategoryId: async () => '11483', getPostalCode: async () => '94103' };

async function seed(db: TestDb) {
  const item = await createItem(db, { photos: ['https://blob/a.jpg'] });
  const listing = await createListing(db, {
    itemId: item.id, title: 'Levi 501', specifics: { Brand: "Levi's" },
    description: 'clean', price: 40, condition: 'used_good',
  });
  const approval = await enqueueApproval(db, { type: 'listing', refId: listing.id });
  return { item, listing, approval };
}

describe('publishApprovedListing', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('publishes: listing→live with id, item→listed, approval→approved', async () => {
    db = await makeTestDb();
    const { item, listing, approval } = await seed(db);
    const res = await publishApprovedListing(db, new MockEbayAdapter(), listing.id, DEPS);
    expect(res.ok).toBe(true);
    const after = await getListing(db, listing.id);
    expect(after?.status).toBe('live');
    expect(after?.ebayListingId).toBeTruthy();
    expect(after?.ebayCategoryId).toBe('11483');
    expect((await getItem(db, item.id))?.status).toBe('listed');
    expect((await getApproval(db, approval.id))?.state).toBe('approved');
  });

  it('surfaces verify errors and leaves status unchanged', async () => {
    db = await makeTestDb();
    const { listing } = await seed(db);
    const failing: EbayAdapter = Object.assign(new MockEbayAdapter(), {
      verifyListing: async () => ({ ok: false, errors: ['Brand required'] }),
    });
    const res = await publishApprovedListing(db, failing, listing.id, DEPS);
    expect(res).toEqual({ ok: false, errors: ['Brand required'] });
    expect((await getListing(db, listing.id))?.status).toBe('draft');
  });
});
