import { describe, it, expect } from 'vitest';
import { lintListing } from './linter';
import type { ListingDraft } from '../types';

function draft(over: Partial<ListingDraft> = {}): ListingDraft {
  return {
    title: "Levi's 501 Vintage Jeans Men's 34x32 Straight Leg Dark Wash",
    aspects: { Brand: "Levi's", Size: '34x32' },
    description: "Men's Levi's 501s, 34x32, dark wash. Small fade at the left knee, shown in photo 3. Ships next day.",
    price: 48,
    condition: 'used_good',
    ...over,
  };
}

describe('lintListing — compliance (blocking)', () => {
  it('passes a clean, human-sounding listing', () => {
    const r = lintListing(draft());
    expect(r.ok).toBe(true);
    expect(r.blocking).toEqual([]);
  });

  it('blocks an email address in the description', () => {
    const r = lintListing(draft({ description: 'Questions? email me at seller@gmail.com' }));
    expect(r.ok).toBe(false);
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(true);
  });

  it('blocks a phone number (10+ digits) in the description', () => {
    const r = lintListing(draft({ description: 'Call or text 415 555 2671 to buy.' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(true);
  });

  it('does NOT flag measurements as a phone number', () => {
    const r = lintListing(draft({ description: 'Waist 34, inseam 32, rise 11. Great shape.' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(false);
  });

  it('blocks a URL in the description', () => {
    const r = lintListing(draft({ description: 'See more at www.mystore.com today.' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(true);
  });

  it('blocks off-platform solicitation', () => {
    const r = lintListing(draft({ description: 'Cheaper if you pay with Venmo, message me off eBay.' }));
    expect(r.blocking.some((i) => i.code === 'off_platform')).toBe(true);
  });

  it('blocks a title longer than 80 characters', () => {
    const r = lintListing(draft({ title: 'x'.repeat(81) }));
    expect(r.blocking.some((i) => i.code === 'title_too_long')).toBe(true);
  });

  it('blocks an aspect value longer than 65 characters', () => {
    const r = lintListing(draft({ aspects: { Brand: 'y'.repeat(66) } }));
    expect(r.blocking.some((i) => i.code === 'aspect_too_long')).toBe(true);
  });
});
