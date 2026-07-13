import { describe, it, expect } from 'vitest';
import { MockEbayAdapter } from './mock';
import { getEbayAdapter } from './index';
import type { PublishListingInput } from './types';

const INPUT: PublishListingInput = {
  title: 'X', description: 'Y', price: 10, categoryId: '1', condition: 'new',
  aspects: {}, photoUrls: [], postalCode: '94103',
};

describe('MockEbayAdapter', () => {
  const adapter = new MockEbayAdapter();

  it('identifies an item from seller notes deterministically', async () => {
    const a = await adapter.identifyByImage({ images: ['x'], sellerNotes: "Levi's 501 jeans 34x32" });
    const b = await adapter.identifyByImage({ images: ['x'], sellerNotes: "Levi's 501 jeans 34x32" });
    expect(a).toEqual(b); // deterministic
    expect(a.brand).toBe("Levi's");
    expect(a.productType.length).toBeGreaterThan(0);
    expect(a.confidence).toBeGreaterThan(0);
    expect(a.confidence).toBeLessThanOrEqual(1);
  });

  it('flags ambiguity when notes are sparse', async () => {
    const id = await adapter.identifyByImage({ images: ['x'] });
    expect(id.ambiguities.length).toBeGreaterThan(0);
    expect(id.confidence).toBeLessThan(0.6);
  });

  it('returns comps priced around a plausible number', async () => {
    const id = await adapter.identifyByImage({ images: ['x'], sellerNotes: "Levi's 501 jeans" });
    const comps = await adapter.findComps({ identity: id });
    expect(comps.length).toBeGreaterThanOrEqual(3);
    for (const c of comps) {
      expect(c.price).toBeGreaterThan(0);
      expect(typeof c.sold).toBe('boolean');
    }
  });

});

describe('MockEbayAdapter publish/verify', () => {
  it('verify always ok', async () => {
    expect(await new MockEbayAdapter().verifyListing(INPUT)).toEqual({ ok: true, errors: [] });
  });
  it('publish returns a mock id + url', async () => {
    const r = await new MockEbayAdapter().publishListing(INPUT);
    expect(r.ebayListingId).toMatch(/^MOCK-/);
    expect(r.url).toContain(r.ebayListingId);
  });
});

describe('getEbayAdapter', () => {
  it('returns the mock adapter by default', () => {
    delete process.env.EBAY_BACKEND;
    expect(getEbayAdapter()).toBeInstanceOf(MockEbayAdapter);
  });

  it('throws on an unknown backend', () => {
    process.env.EBAY_BACKEND = 'wat';
    expect(() => getEbayAdapter()).toThrow(/EBAY_BACKEND/);
    delete process.env.EBAY_BACKEND;
  });
});
