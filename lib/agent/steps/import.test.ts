import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { MockEbayAdapter } from '../../ebay/mock';
import type { EbayAdapter, EbayActiveListing, EbayItemDetails } from '../../ebay/types';
import { listListings } from '../../db/repos/listings';
import { importListings, stripHtml } from './import';
import { applyListingEdit } from './editListing';

const DETAILS: EbayItemDetails = {
  ebayListingId: '110055',
  title: 'Sony WH-1000XM4 Headphones Black',
  description: '<p>Great&nbsp;condition.<br>Comes with the case.</p>',
  price: 179.99,
  photoUrls: ['https://i.ebayimg.com/x.jpg'],
  categoryId: '112529',
  conditionId: 3000,
  specifics: { Brand: 'Sony', Model: 'WH-1000XM4' },
  startTime: '2026-06-01T12:00:00.000Z',
};

function importAdapter(active: EbayActiveListing[], details: Record<string, EbayItemDetails>): EbayAdapter {
  return Object.assign(new MockEbayAdapter(), {
    getActiveListings: async () => active,
    getItemDetails: async (id: string) => details[id] ?? null,
  });
}

describe('stripHtml', () => {
  it('flattens tags + entities to readable text', () => {
    expect(stripHtml('<p>Great&nbsp;condition.<br>Comes with the case.</p>')).toBe(
      'Great condition.\nComes with the case.',
    );
  });
});

describe('importListings', () => {
  let db: TestDb | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('imports an external live listing as a live app listing', async () => {
    db = await makeTestDb();
    const res = await importListings(
      db,
      importAdapter([{ ebayListingId: '110055', title: DETAILS.title, price: 179.99 }], { '110055': DETAILS }),
    );
    expect(res).toEqual({ active: 1, imported: 1 });
    const all = await listListings(db);
    expect(all).toHaveLength(1);
    const l = all[0]!;
    expect(l.status).toBe('live');
    expect(l.ebayListingId).toBe('110055');
    expect(l.price).toBe(179.99);
    expect(l.specifics).toEqual({ Brand: 'Sony', Model: 'WH-1000XM4' });
    expect(l.condition).toBe('used_good');
    expect(l.description).toContain('Great condition.');
  });

  it('is idempotent — a second run imports nothing', async () => {
    db = await makeTestDb();
    const adapter = importAdapter([{ ebayListingId: '110055', title: DETAILS.title, price: 179.99 }], {
      '110055': DETAILS,
    });
    await importListings(db, adapter);
    const second = await importListings(db, adapter);
    expect(second).toEqual({ active: 1, imported: 0 });
    expect(await listListings(db)).toHaveLength(1);
  });

  it('caps GetItem calls per run and picks up the rest next run', async () => {
    db = await makeTestDb();
    const active = ['1', '2', '3'].map((id) => ({ ebayListingId: id, title: `t${id}`, price: 10 }));
    const details = Object.fromEntries(active.map((a) => [a.ebayListingId, { ...DETAILS, ebayListingId: a.ebayListingId }]));
    const adapter = importAdapter(active, details);
    expect((await importListings(db, adapter, 2)).imported).toBe(2);
    expect((await importListings(db, adapter, 2)).imported).toBe(1);
  });
});

describe('applyListingEdit on a live (imported) listing', () => {
  let db: TestDb | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  async function importOne(db: TestDb) {
    await importListings(
      db,
      importAdapter([{ ebayListingId: '110055', title: DETAILS.title, price: 179.99 }], { '110055': DETAILS }),
    );
    const [l] = await listListings(db);
    return l!;
  }

  it('revises the price on eBay first, then mirrors it locally', async () => {
    db = await makeTestDb();
    const listing = await importOne(db);
    const calls: [string, number][] = [];
    const res = await applyListingEdit(db, listing.id, { price: 149.99 }, {
      reviseLivePrice: async (id, p) => {
        calls.push([id, p]);
      },
    });
    expect(res.ok).toBe(true);
    expect(calls).toEqual([['110055', 149.99]]);
    const [after] = await listListings(db);
    expect(after!.price).toBe(149.99);
  });

  it('keeps the local price untouched when eBay rejects the revise', async () => {
    db = await makeTestDb();
    const listing = await importOne(db);
    const res = await applyListingEdit(db, listing.id, { price: 149.99 }, {
      reviseLivePrice: async () => {
        throw new Error('nope');
      },
    });
    expect(res.ok).toBe(false);
    const [after] = await listListings(db);
    expect(after!.price).toBe(179.99);
  });

  it('refuses non-price edits on live listings', async () => {
    db = await makeTestDb();
    const listing = await importOne(db);
    const res = await applyListingEdit(db, listing.id, { title: 'New title' }, { reviseLivePrice: async () => {} });
    expect(res.ok).toBe(false);
  });
});
