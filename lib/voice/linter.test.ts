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

describe('lintListing — style (warnings)', () => {
  it('warns on signature-word / copula-dressing density', () => {
    const r = lintListing(draft({
      description: 'This vibrant, meticulous piece boasts an intricate design and stands as a testament to quality.',
    }));
    expect(r.ok).toBe(true); // style issues never block
    expect(r.warnings.some((i) => i.code === 'slop_vocabulary')).toBe(true);
  });

  it('warns on negative parallelism', () => {
    const r = lintListing(draft({
      description: "It's not just a jacket, but a statement. Warm and clean.",
    }));
    expect(r.warnings.some((i) => i.code === 'negative_parallelism')).toBe(true);
  });

  it('warns on em-dash overuse', () => {
    const r = lintListing(draft({
      description: 'Solid jacket — barely worn — a great deal — ships fast.',
    }));
    expect(r.warnings.some((i) => i.code === 'em_dash_overuse')).toBe(true);
  });

  it('warns on curly quotes', () => {
    const r = lintListing(draft({ description: 'A “great” find in clean shape.' }));
    expect(r.warnings.some((i) => i.code === 'curly_quotes')).toBe(true);
  });

  it('warns on ALL-CAPS spam tokens in the title', () => {
    const r = lintListing(draft({ title: "Levi's 501 Jeans L@@K RARE! 34x32" }));
    expect(r.warnings.some((i) => i.code === 'title_spam')).toBe(true);
  });

  it('leaves a clean listing with no warnings', () => {
    const r = lintListing(draft());
    expect(r.warnings).toEqual([]);
  });
});

describe('lintListing — compliance regressions (code review)', () => {
  // FIX 2: identifiers must not be mistaken for phone numbers.
  it('does NOT flag a bare serial number as a phone', () => {
    const r = lintListing(draft({ description: 'Serial number 1234567890 on the back' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(false);
  });

  it('does NOT flag a UPC aspect as a phone', () => {
    const r = lintListing(draft({ aspects: { UPC: '012345678905' } }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(false);
  });

  it('does NOT flag an ISBN aspect as a phone', () => {
    const r = lintListing(draft({ aspects: { ISBN: '9780134685991' } }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(false);
  });

  // FIX 1: aspect values are scanned independently, so concatenation can't forge a digit run.
  it('does NOT forge a phone by joining separate aspect values', () => {
    const r = lintListing(draft({ aspects: { 'Model Year': '2015', Mileage: '125000' } }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(false);
  });

  // FIX 2: genuine phone numbers are still blocked.
  it('blocks "Call or text 415 555 2671"', () => {
    const r = lintListing(draft({ description: 'Call or text 415 555 2671' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(true);
  });

  it('blocks a parenthesized phone "(415) 555-2671"', () => {
    const r = lintListing(draft({ description: '(415) 555-2671' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(true);
  });

  it('blocks a bare phone run when a contact cue precedes it', () => {
    const r = lintListing(draft({ description: 'call 4155552671 anytime' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(true);
  });

  // FIX 3: bare-domain URL false positives (uppercase TLDs / dropped co,io).
  it('does NOT flag "in.Store" as a URL', () => {
    const r = lintListing(draft({ description: 'Available in.Store pickup only' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(false);
  });

  it('does NOT flag "shop.Store" as a URL', () => {
    const r = lintListing(draft({ description: 'Ships from our shop.Store hours vary' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(false);
  });

  it('does NOT flag "Bench.co" as a URL', () => {
    const r = lintListing(draft({ description: 'Model: Bench.co jacket' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(false);
  });

  it('blocks a www URL', () => {
    const r = lintListing(draft({ description: 'See more at www.mystore.com' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(true);
  });

  it('blocks a bare .com domain', () => {
    const r = lintListing(draft({ description: 'buy at mystore.com today' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(true);
  });

  it('blocks an http URL', () => {
    const r = lintListing(draft({ description: 'http://mystore.com' }));
    expect(r.blocking.some((i) => i.code === 'contact_info')).toBe(true);
  });
});

describe('lintListing — style regressions (code review)', () => {
  // FIX 4: a single slop word (with plural/verb variants) must not trip the density threshold.
  it('does NOT warn slop_vocabulary on a single slop word', () => {
    const r = lintListing(draft({ description: 'This jacket boasts a full zip.' }));
    expect(r.warnings.some((i) => i.code === 'slop_vocabulary')).toBe(false);
  });

  // FIX 4: trimmed everyday words no longer count as slop.
  it('does NOT warn slop_vocabulary on everyday words (significant, notable)', () => {
    const r = lintListing(draft({ description: 'Significant wear on the sole, notable fade at the cuff.' }));
    expect(r.warnings.some((i) => i.code === 'slop_vocabulary')).toBe(false);
  });

  it('still warns slop_vocabulary on 2+ distinct slop words', () => {
    const r = lintListing(draft({ description: 'A vibrant, seamless piece, meticulously curated.' }));
    expect(r.warnings.some((i) => i.code === 'slop_vocabulary')).toBe(true);
  });

  // FIX 5: allowlisted acronyms in a title must not warn.
  it('does NOT warn title_spam on allowlisted acronyms', () => {
    const r = lintListing(draft({ title: "Nike Dri-FIT Shirt NWT OEM USB LED Men's L" }));
    expect(r.warnings.some((i) => i.code === 'title_spam')).toBe(false);
  });

  it('warns title_spam on non-acronym all-caps hype', () => {
    const r = lintListing(draft({ title: 'STUNNING Vintage Jacket RARE!' }));
    expect(r.warnings.some((i) => i.code === 'title_spam')).toBe(true);
  });
});
