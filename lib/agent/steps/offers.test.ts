import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { createListing, updateListing } from '../../db/repos/listings';
import { listDraftedOffers } from '../../db/repos/offers';
import { listPendingApprovals } from '../../db/repos/approvals';
import { pollOffers, computeOfferPrice } from './offers';
import type { EbayAdapter } from '../../ebay/types';

function fakeAdapter(eligibleIds: string[]): EbayAdapter {
  return {
    identifyByImage: async () => ({ productType: 'x', categoryId: '1', aspects: {}, confidence: 0, ambiguities: [] }),
    findComps: async () => [],
    verifyListing: async () => ({ ok: true, errors: [] }),
    publishListing: async () => ({ ebayListingId: 'x', url: 'x' }),
    getRecentSales: async () => [],
    getBuyerQuestions: async () => [],
    replyToBuyerQuestion: async () => {},
    getEligibleOfferListingIds: async () => eligibleIds,
    sendOfferToInterestedBuyers: async () => {},
    getActiveListings: async () => [],
    getItemDetails: async () => null,
    reviseListingPrice: async () => {},
  };
}

async function makeListing(db: TestDb, ebayId: string, status = 'live', price: number | null = 100) {
  const { rows } = await db.query<{ id: string }>(`insert into items default values returning id`);
  const item = rows[0];
  if (!item) throw new Error('failed to create test item');
  const listing = await createListing(db, {
    itemId: item.id,
    title: 'adidas F50 Cleats',
    specifics: {},
    description: 'd',
    price,
  });
  await updateListing(db, listing.id, { status, ebayListingId: ebayId });
  return listing.id;
}

describe('computeOfferPrice', () => {
  it('applies the discount', () => {
    expect(computeOfferPrice(100, 10)).toBe(90);
  });
  it('floors at 70% of list price even for oversized discounts', () => {
    expect(computeOfferPrice(100, 50)).toBe(70);
  });
  it('clamps a runaway discount setting to the 50% band, then floors', () => {
    expect(computeOfferPrice(100, 90)).toBe(70);
  });
  it('rounds to cents', () => {
    expect(computeOfferPrice(39.99, 10)).toBe(35.99);
  });
});

describe('pollOffers', () => {
  let db: TestDb | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('drafts one offer + enqueues an offer approval for an eligible live listing', async () => {
    db = await makeTestDb();
    const listingId = await makeListing(db, '110088');
    const res = await pollOffers(db, fakeAdapter(['110088']), 10);
    expect(res).toEqual({ eligible: 1, drafted: 1 });
    const offers = await listDraftedOffers(db);
    expect(offers).toHaveLength(1);
    expect(offers[0]?.listingId).toBe(listingId);
    expect(offers[0]?.offerPrice).toBe(90);
    const approvals = await listPendingApprovals(db);
    expect(approvals.some((a) => a.type === 'offer' && a.refId === offers[0]?.id)).toBe(true);
  });

  it('never drafts a second offer for the same listing', async () => {
    db = await makeTestDb();
    await makeListing(db, '110088');
    await pollOffers(db, fakeAdapter(['110088']), 10);
    const second = await pollOffers(db, fakeAdapter(['110088']), 10);
    expect(second.drafted).toBe(0);
  });

  it('skips non-live listings and unknown eBay ids', async () => {
    db = await makeTestDb();
    await makeListing(db, '110077', 'draft');
    const res = await pollOffers(db, fakeAdapter(['110077', '424242']), 10);
    expect(res).toEqual({ eligible: 2, drafted: 0 });
  });
});
