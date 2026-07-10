# Core Library (eBay Adapter + Slop-Linter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the framework-independent heart of the eBay selling agent — the typed eBay adapter with a deterministic mock backend, and the slop-linter that enforces eBay compliance (blocking) and anti-AI-slop style (warnings) — fully unit-tested, with zero dependency on eve, Next.js, or Supabase.

**Architecture:** A plain TypeScript library under `lib/`. All eBay access sits behind one `EbayAdapter` interface with a `mock` backend selected by env (`live` backend is a later plan). The slop-linter is a pure function `lintListing(draft) → LinterReport` driven by the rules in [`VOICE.md`](../../../VOICE.md). Both are consumed later by eve tools and the dashboard, so they must be dependency-light and exhaustively tested here.

**Tech Stack:** TypeScript (strict), pnpm, Vitest, Zod. Node ≥ 24 (to match eve later). No runtime framework yet.

**Scope note:** This is Plan 1 of 4 for v1. Follow-ons (own plans, written after this lands): **Plan 2** — Supabase schema + repositories; **Plan 3** — eve agent wiring (`agent/` dir, tools calling this library, `instructions.md` from `VOICE.md`); **Plan 4** — Next.js "eBay-native, elevated" dashboard. This plan produces a standalone, tested library.

---

## File Structure

```
package.json            # pnpm project, scripts: test, typecheck
tsconfig.json           # strict TS
vitest.config.ts        # node test env
.nvmrc                  # 24
lib/
  types.ts              # domain types (ItemIdentity, Comp, PriceEstimate, ListingDraft, ItemCondition)
  ebay/
    types.ts            # EbayAdapter interface + I/O types
    mock.ts             # MockEbayAdapter (deterministic fixtures)
    index.ts            # getEbayAdapter() — selects backend by EBAY_BACKEND env
    mock.test.ts        # tests for the mock adapter + selector
  voice/
    blocklist.ts        # AI-slop word/phrase lists (the living blocklist)
    linter.ts           # lintListing(): compliance (blocking) + style (warnings)
    linter.test.ts      # exhaustive linter tests, incl. VOICE.md before/after examples
```

Each file has one responsibility. The linter never imports from `ebay/`; the adapter never imports from `voice/`. They share only `lib/types.ts`.

---

## Task 1: Project setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.nvmrc`

- [ ] **Step 1: Initialize pnpm and add dev deps**

Run:
```bash
cd "/Users/mateososaalbrecht/ebay agent"
corepack enable
printf '24\n' > .nvmrc
pnpm init
pnpm add -D typescript vitest @types/node
pnpm add zod
```
Expected: `package.json`, `pnpm-lock.yaml`, and `node_modules/` are created.

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "outDir": "dist",
    "declaration": true
  },
  "include": ["lib"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add scripts to `package.json`**

Set the `"scripts"` and `"type"` fields (merge into the generated file):
```json
{
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 5: Verify the toolchain runs**

Run: `pnpm test`
Expected: Vitest runs and reports "No test files found" (exit 0 or the "no tests" notice). This confirms the toolchain is wired.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts .nvmrc
git commit -m "chore: scaffold TypeScript library toolchain (pnpm, vitest, zod)"
```

---

## Task 2: Domain types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write `lib/types.ts`**

```ts
// Core domain types shared across the eBay adapter and the voice linter.

export type ItemCondition =
  | 'new'
  | 'open_box'
  | 'used_like_new'
  | 'used_good'
  | 'used_fair'
  | 'for_parts';

/** What the agent believes the item is, after identification. */
export interface ItemIdentity {
  brand?: string;
  productType: string; // e.g. "Straight Leg Jeans"
  model?: string;
  categoryId?: string; // eBay leaf category id
  aspects: Record<string, string>; // item specifics: { Size: "34x32", Color: "Blue" }
  confidence: number; // 0..1
  ambiguities: string[]; // things to confirm with the seller
}

/** A comparable listing used as price evidence. Never expose `ref` to buyers. */
export interface Comp {
  source: string; // e.g. "ebay-active"
  title: string;
  price: number; // USD dollars
  sold: boolean;
  ref?: string; // opaque internal reference, NOT a buyer-facing URL
  capturedAt: string; // ISO 8601
}

export interface PriceEstimate {
  suggested: number;
  low: number;
  high: number;
  currency: 'USD';
  rationale: string;
  comps: Comp[];
}

/** A publish-ready listing draft. */
export interface ListingDraft {
  title: string;
  aspects: Record<string, string>;
  description: string;
  price: number; // USD dollars
  condition: ItemCondition;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add core domain types"
```

---

## Task 3: eBay adapter interface + mock backend

**Files:**
- Create: `lib/ebay/types.ts`, `lib/ebay/mock.ts`, `lib/ebay/index.ts`
- Test: `lib/ebay/mock.test.ts`

- [ ] **Step 1: Write the adapter interface `lib/ebay/types.ts`**

```ts
import type { ItemIdentity, Comp, ListingDraft } from '../types';

export interface IdentifyByImageInput {
  images: string[]; // base64 data or storage refs (opaque to the adapter contract)
  sellerNotes?: string;
}

export interface PublishResult {
  ebayListingId: string;
  url: string;
}

/**
 * The single seam between the agent and eBay. Two implementations exist:
 * `mock` (deterministic fixtures, used everywhere until the keyset lands) and
 * `live` (real eBay APIs — added in a later plan). Listing publish maps to the
 * Trading API AddFixedPriceItem in `live`, so listings are Negotiation-API-eligible.
 */
export interface EbayAdapter {
  identifyByImage(input: IdentifyByImageInput): Promise<ItemIdentity>;
  findComps(query: { identity: ItemIdentity }): Promise<Comp[]>;
  publishListing(draft: ListingDraft): Promise<PublishResult>;
}
```

- [ ] **Step 2: Write the failing test `lib/ebay/mock.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { MockEbayAdapter } from './mock';
import { getEbayAdapter } from './index';

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

  it('publishes and returns an id + url', async () => {
    const res = await adapter.publishListing({
      title: "Levi's 501 Vintage Jeans Men's 34x32",
      aspects: { Brand: "Levi's", Size: '34x32' },
      description: 'Solid pair, light wear at the knee. Ships next day.',
      price: 48,
      condition: 'used_good',
    });
    expect(res.ebayListingId).toMatch(/^MOCK-/);
    expect(res.url).toContain(res.ebayListingId);
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run lib/ebay/mock.test.ts`
Expected: FAIL — cannot find module `./mock` / `./index`.

- [ ] **Step 4: Implement `lib/ebay/mock.ts`**

```ts
import type { EbayAdapter, IdentifyByImageInput, PublishResult } from './types';
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

  async publishListing(): Promise<PublishResult> {
    const id = `MOCK-${Date.now()}`;
    return { ebayListingId: id, url: `https://mock.ebay.local/itm/${id}` };
  }
}
```

- [ ] **Step 5: Implement `lib/ebay/index.ts`**

```ts
import type { EbayAdapter } from './types';
import { MockEbayAdapter } from './mock';

export type { EbayAdapter } from './types';
export { MockEbayAdapter } from './mock';

export function getEbayAdapter(): EbayAdapter {
  const backend = process.env.EBAY_BACKEND ?? 'mock';
  switch (backend) {
    case 'mock':
      return new MockEbayAdapter();
    // case 'live': return new LiveEbayAdapter();  // added in a later plan
    default:
      throw new Error(`Unknown EBAY_BACKEND: ${backend}`);
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run lib/ebay/mock.test.ts`
Expected: PASS (6 tests).

Note: the `publishListing` test uses `Date.now()`, which is fine in the mock (tests only assert the id prefix and that the url contains the id).

- [ ] **Step 7: Commit**

```bash
git add lib/ebay
git commit -m "feat: eBay adapter interface + deterministic mock backend"
```

---

## Task 4: The slop blocklist

**Files:**
- Create: `lib/voice/blocklist.ts`

- [ ] **Step 1: Write `lib/voice/blocklist.ts`**

```ts
// The living AI-slop blocklist. Sourced from VOICE.md. Refresh periodically —
// the vocabulary rotates as models and readers adapt. No single hit is proof;
// density is the signal.

/** Signature LLM vocabulary (drop or replace). */
export const SIGNATURE_WORDS: string[] = [
  'delve', 'delves', 'boasts', 'boast', 'testament', 'tapestry', 'underscore',
  'underscores', 'pivotal', 'vibrant', 'meticulous', 'meticulously', 'intricate',
  'landscape', 'crucial', 'significant', 'notable', 'additionally', 'bolstered',
  'garner', 'interplay', 'enduring', 'realm', 'elevate', 'unleash', 'seamless',
  'curated', 'nestled',
];

/** Travel-brochure / promotional phrases. */
export const PROMO_PHRASES: string[] = [
  'in the heart of', 'look no further', 'perfect for', 'dive into',
  'when it comes to', 'in the world of', 'commitment to', 'diverse array',
  'rich history', 'a testament to', 'stands as', 'serves as',
];

/** Copula-dressing verbs: inflated stand-ins for plain "is/are". */
export const COPULA_DRESSING: string[] = [
  'boasts', 'features', 'showcases', 'exemplifies', 'represents', 'serves as',
  'stands as', 'marks', 'maintains',
];

/** Words that read as spam in eBay titles (ranking + perception). */
export const TITLE_SPAM_TOKENS: string[] = ['l@@k', 'wow', 'must see', 'rare!', '~'];
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/voice/blocklist.ts
git commit -m "feat: add anti-slop blocklist (from VOICE.md)"
```

---

## Task 5: Linter — compliance (blocking) rules

**Files:**
- Create: `lib/voice/linter.ts`
- Test: `lib/voice/linter.test.ts`

- [ ] **Step 1: Write the failing test `lib/voice/linter.test.ts` (compliance cases)**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/voice/linter.test.ts`
Expected: FAIL — cannot find module `./linter`.

- [ ] **Step 3: Implement `lib/voice/linter.ts` (types + compliance)**

```ts
import type { ListingDraft } from '../types';
import {
  SIGNATURE_WORDS,
  PROMO_PHRASES,
  COPULA_DRESSING,
  TITLE_SPAM_TOKENS,
} from './blocklist';

export type IssueSeverity = 'blocking' | 'warning';
export type IssueField = 'title' | 'description' | 'aspects' | 'listing';

export interface LintIssue {
  code: string;
  severity: IssueSeverity;
  field: IssueField;
  message: string;
  matches?: string[];
}

export interface LinterReport {
  ok: boolean; // true when there are no blocking issues
  blocking: LintIssue[];
  warnings: LintIssue[];
}

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+\.(?:com|net|org|io|co|shop|store)\b(?:\/[^\s]*)?)/i;
const OFF_PLATFORM_RE =
  /\b(paypal|venmo|zelle|cash\s?app|whats\s?app|text me|email me|call me|off[-\s]?ebay|outside (?:of )?ebay|contact me (?:at|on))\b/i;

/** Phone = a run containing at least 10 digits (so measurements like "34 24 34" don't trip). */
function findPhoneNumbers(text: string): string[] {
  const candidates = text.match(/\d[\d\s().+-]{7,}\d/g) ?? [];
  return candidates.filter((c) => c.replace(/\D/g, '').length >= 10);
}

function complianceIssues(d: ListingDraft): LintIssue[] {
  const issues: LintIssue[] = [];
  const haystacks: Array<[IssueField, string]> = [
    ['title', d.title],
    ['description', d.description],
    ['aspects', Object.values(d.aspects).join(' ')],
  ];

  for (const [field, text] of haystacks) {
    const contactMatches: string[] = [];
    const email = text.match(EMAIL_RE);
    if (email) contactMatches.push(email[0]);
    const url = text.match(URL_RE);
    if (url) contactMatches.push(url[0]);
    contactMatches.push(...findPhoneNumbers(text));
    if (contactMatches.length > 0) {
      issues.push({
        code: 'contact_info',
        severity: 'blocking',
        field,
        message: 'Contact info / links are not allowed before a sale. Remove and direct buyers to "Ask a question".',
        matches: contactMatches,
      });
    }
    const offPlatform = text.match(OFF_PLATFORM_RE);
    if (offPlatform) {
      issues.push({
        code: 'off_platform',
        severity: 'blocking',
        field,
        message: 'Off-platform solicitation is prohibited. Keep the transaction on eBay.',
        matches: [offPlatform[0]],
      });
    }
  }

  if (d.title.length > 80) {
    issues.push({
      code: 'title_too_long',
      severity: 'blocking',
      field: 'title',
      message: `Title is ${d.title.length} chars; eBay's limit is 80 (including spaces).`,
    });
  }

  for (const [key, value] of Object.entries(d.aspects)) {
    if (value.length > 65) {
      issues.push({
        code: 'aspect_too_long',
        severity: 'blocking',
        field: 'aspects',
        message: `Item specific "${key}" is ${value.length} chars; the limit is 65.`,
      });
    }
  }

  return issues;
}

export function lintListing(d: ListingDraft): LinterReport {
  const blocking = complianceIssues(d).filter((i) => i.severity === 'blocking');
  const warnings: LintIssue[] = []; // style rules added in Task 6
  return { ok: blocking.length === 0, blocking, warnings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/voice/linter.test.ts`
Expected: PASS (8 compliance tests). The clean-listing test passes because no style rules exist yet.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/linter.ts lib/voice/linter.test.ts
git commit -m "feat: slop-linter compliance rules (blocking) — contact info, off-platform, char limits"
```

---

## Task 6: Linter — style (warning) rules

**Files:**
- Modify: `lib/voice/linter.ts`
- Modify: `lib/voice/linter.test.ts`

- [ ] **Step 1: Add failing style tests to `lib/voice/linter.test.ts`**

Append this `describe` block to the existing test file:
```ts
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm vitest run lib/voice/linter.test.ts`
Expected: FAIL — the 5 new warning assertions fail (warnings array is empty); the clean-listing warning test passes.

- [ ] **Step 3: Add the style rules to `lib/voice/linter.ts`**

Add this function above `lintListing`:
```ts
const NEG_PARALLELISM_RES = [
  /\bnot just\b[^.?!]*\bbut\b/i,
  /\bit'?s not\b[^.?!]*\bit'?s\b/i,
  /\bnot only\b[^.?!]*\bbut also\b/i,
];

function countOccurrences(haystack: string, needles: string[]): string[] {
  const lower = haystack.toLowerCase();
  return needles.filter((n) => lower.includes(n.toLowerCase()));
}

function styleWarnings(d: ListingDraft): LintIssue[] {
  const warnings: LintIssue[] = [];
  const body = `${d.title} ${d.description}`;

  const slopHits = [
    ...countOccurrences(body, SIGNATURE_WORDS),
    ...countOccurrences(body, PROMO_PHRASES),
    ...countOccurrences(body, COPULA_DRESSING),
  ];
  const uniqueHits = [...new Set(slopHits)];
  if (uniqueHits.length >= 2) {
    warnings.push({
      code: 'slop_vocabulary',
      severity: 'warning',
      field: 'description',
      message: 'Reads as AI: too many stock LLM words/phrases. Rewrite plainer and more specific.',
      matches: uniqueHits,
    });
  }

  for (const re of NEG_PARALLELISM_RES) {
    const m = d.description.match(re);
    if (m) {
      warnings.push({
        code: 'negative_parallelism',
        severity: 'warning',
        field: 'description',
        message: 'Negative-parallelism ("not just X, but Y") is a classic AI tell. Just say the thing.',
        matches: [m[0]],
      });
      break;
    }
  }

  const emDashes = (d.description.match(/—/g) ?? []).length;
  if (emDashes >= 2) {
    warnings.push({
      code: 'em_dash_overuse',
      severity: 'warning',
      field: 'description',
      message: `Em-dash overuse (${emDashes}). Prefer periods or commas; it reads as AI.`,
    });
  }

  if (/[‘’“”]/.test(body)) {
    warnings.push({
      code: 'curly_quotes',
      severity: 'warning',
      field: 'description',
      message: 'Curly quotes/apostrophes read as AI-pasted. Use straight quotes.',
    });
  }

  const spamHits = countOccurrences(d.title, TITLE_SPAM_TOKENS);
  const hasAllCaps = /\b[A-Z]{3,}\b/.test(d.title.replace(/\bUSA\b/g, '')); // allow common acronyms like USA
  if (spamHits.length > 0 || hasAllCaps) {
    warnings.push({
      code: 'title_spam',
      severity: 'warning',
      field: 'title',
      message: 'Title has spammy caps/markers that hurt search ranking. Use plain keywords buyers search.',
      matches: spamHits.length > 0 ? spamHits : undefined,
    });
  }

  return warnings;
}
```

- [ ] **Step 4: Wire `styleWarnings` into `lintListing`**

Replace the body of `lintListing` with:
```ts
export function lintListing(d: ListingDraft): LinterReport {
  const blocking = complianceIssues(d).filter((i) => i.severity === 'blocking');
  const warnings = styleWarnings(d);
  return { ok: blocking.length === 0, blocking, warnings };
}
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `pnpm vitest run lib/voice/linter.test.ts`
Expected: PASS (all compliance + style tests). Confirm the clean `draft()` still yields zero warnings (its "small fade at the left knee, shown in photo 3" copy contains no blocklist terms, no negative parallelism, ≤1 em-dash, straight quotes).

- [ ] **Step 6: Commit**

```bash
git add lib/voice/linter.ts lib/voice/linter.test.ts
git commit -m "feat: slop-linter style warnings — slop vocabulary, negative parallelism, em-dash/curly-quote/title-spam tells"
```

---

## Task 7: Full-suite green + library entry point

**Files:**
- Create: `lib/index.ts`

- [ ] **Step 1: Write `lib/index.ts` (public surface)**

```ts
export * from './types';
export { getEbayAdapter, MockEbayAdapter } from './ebay';
export type { EbayAdapter } from './ebay';
export { lintListing } from './voice/linter';
export type { LinterReport, LintIssue, IssueSeverity, IssueField } from './voice/linter';
```

- [ ] **Step 2: Run the whole suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: ALL tests PASS, typecheck clean.

- [ ] **Step 3: Commit**

```bash
git add lib/index.ts
git commit -m "feat: public library entry point (adapter + linter)"
```

---

## Self-review results (done while writing this plan)

- **Spec coverage:** This plan implements the eBay adapter seam (spec §4.1) and the slop-linter incl. blocking compliance + style warnings (spec §5 step 4, §8). Data model (§6), eve wiring (§4/§5), and dashboard (§7) are explicitly deferred to Plans 2–4.
- **Placeholder scan:** none — every step has complete code or an exact command.
- **Type consistency:** `ListingDraft`, `ItemIdentity`, `Comp` used identically across tasks; `EbayAdapter` methods (`identifyByImage`, `findComps`, `publishListing`) match between interface, mock, and tests; `LinterReport`/`LintIssue` shapes consistent across linter and tests.

---

## Roadmap (subsequent plans)

- **Plan 2 — Supabase data layer:** migrations for `items`, `listings`, `comps`, `approvals`, `events`; typed repositories; Storage bucket for photos. Testable against a local Supabase instance.
- **Plan 3 — eve agent wiring:** `npx eve@latest init`; `agent/instructions.md` generated from `VOICE.md`; `agent/agent.ts` on `anthropic/claude-opus-4-8`; tools (`identify_item`, `research_price`, `lint_listing`, `submit_for_approval`) that call this library; end-to-end mock session via the documented HTTP API (`POST /eve/v1/session`).
- **Plan 4 — Dashboard:** Next.js "eBay-native, elevated" UI (Queue, New Item, Listing Review, Listings, Settings) talking to eve over HTTP and Supabase; built with the frontend-design skill + screenshot-compare loop.
```
