import type { EbayAdapter, IdentifyByImageInput, PublishResult, PublishListingInput, VerifyResult } from './types';
import type { ItemIdentity, Comp } from '../types';

/** Tiny deterministic hash so mock output is stable per input (no Math.random). */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const KNOWN_BRANDS = ["Levi's", 'Nike', 'Sony', 'Apple', 'Patagonia', 'Carhartt'];

export class MockEbayAdapter implements EbayAdapter {
  async identifyByImage(input: IdentifyByImageInput): Promise<ItemIdentity> {
    const notes = (input.sellerNotes ?? '').trim();
    const brand = KNOWN_BRANDS.find((b) => notes.toLowerCase().includes(b.toLowerCase().replace(/[^a-z]/g, '')) || notes.toLowerCase().includes(b.toLowerCase()));
    const sizeMatch = notes.match(/\b(\d{2}x\d{2}|\d{1,2}(\.\d)?)\b/);
    const aspects: Record<string, string> = {};
    if (brand) aspects.Brand = brand;
    if (sizeMatch) aspects.Size = sizeMatch[0];

    const hasStrongSignal = Boolean(brand) && notes.length > 8;
    const confidence = hasStrongSignal ? 0.85 : notes.length > 0 ? 0.5 : 0.3;

    const ambiguities: string[] = [];
    if (!brand) ambiguities.push('Brand not clear from photos — please confirm.');
    if (!sizeMatch) ambiguities.push('Size/measurements not detected — please provide.');

    return {
      brand,
      productType: brand ? 'Straight Leg Jeans' : 'Unidentified item',
      model: notes.match(/\b\d{3}\b/)?.[0],
      categoryId: '11483',
      aspects,
      confidence,
      ambiguities,
    };
  }

  async findComps(query: { identity: ItemIdentity }): Promise<Comp[]> {
    const seed = hashString(JSON.stringify(query.identity.aspects) + query.identity.productType);
    const base = 30 + (seed % 40); // deterministic 30..69
    const capturedAt = '2026-07-10T00:00:00.000Z';
    return [0, 1, 2, 3].map((i) => ({
      source: 'ebay-active',
      title: `${query.identity.brand ?? 'Item'} ${query.identity.productType} comp ${i + 1}`,
      price: base + i * 5,
      sold: i % 2 === 0,
      ref: `mock-comp-${seed}-${i}`,
      capturedAt,
    }));
  }

  async verifyListing(_input: PublishListingInput): Promise<VerifyResult> {
    return { ok: true, errors: [] };
  }

  async publishListing(input: PublishListingInput): Promise<PublishResult> {
    const id = `MOCK-${hashString(input.title + input.price)}`;
    return { ebayListingId: id, url: `https://mock.ebay.local/itm/${id}` };
  }
}
