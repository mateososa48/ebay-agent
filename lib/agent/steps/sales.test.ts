import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { createListing, updateListing, getListing } from '../../db/repos/listings';
import { listEventsByItem } from '../../db/repos/events';
import { pollSales } from './sales';
import type { EbayAdapter, EbaySale } from '../../ebay/types';

function fakeAdapter(sales: EbaySale[]): EbayAdapter {
  return {
    identifyByImage: async () => ({ productType: 'x', categoryId: '1', aspects: {}, confidence: 0, ambiguities: [] }),
    findComps: async () => [],
    verifyListing: async () => ({ ok: true, errors: [] }),
    publishListing: async () => ({ ebayListingId: 'x', url: 'x' }),
    getRecentSales: async () => sales,
    getBuyerQuestions: async () => [],
    replyToBuyerQuestion: async () => {},
    getEligibleOfferListingIds: async () => [],
    sendOfferToInterestedBuyers: async () => {},
  };
}

async function makeLiveListing(db: TestDb, ebayId: string) {
  const { rows } = await db.query<{ id: string }>(`insert into items default values returning id`);
  const item = rows[0];
  if (!item) throw new Error('failed to create test item');
  const listing = await createListing(db, {
    itemId: item.id,
    title: 'Test item',
    specifics: {},
    description: 'd',
    price: 399,
  });
  await updateListing(db, listing.id, { status: 'live', ebayListingId: ebayId });
  return listing.id;
}

describe('pollSales', () => {
  let db: TestDb | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('marks a matching listing sold and logs an event', async () => {
    db = await makeTestDb();
    const id = await makeLiveListing(db, '110012345');
    const res = await pollSales(db, fakeAdapter([{ ebayListingId: '110012345', salePrice: 380, soldAt: '2026-07-01T00:00:00.000Z' }]));
    expect(res).toEqual({ checked: 1, marked: 1 });
    const after = await getListing(db, id);
    expect(after?.status).toBe('sold');
    expect(after?.salePrice).toBe(380);
    const events = await listEventsByItem(db, after!.itemId);
    expect(events.some((e) => e.kind === 'sale.detected')).toBe(true);
  });

  it('is idempotent — a second poll of the same sale marks nothing', async () => {
    db = await makeTestDb();
    await makeLiveListing(db, '110012345');
    const sale = [{ ebayListingId: '110012345', salePrice: 380, soldAt: null }];
    await pollSales(db, fakeAdapter(sale));
    const second = await pollSales(db, fakeAdapter(sale));
    expect(second.marked).toBe(0);
  });

  it('ignores sales for items not listed here', async () => {
    db = await makeTestDb();
    await makeLiveListing(db, '110012345');
    const res = await pollSales(db, fakeAdapter([{ ebayListingId: '999999999', salePrice: 10, soldAt: null }]));
    expect(res).toEqual({ checked: 1, marked: 0 });
  });
});
