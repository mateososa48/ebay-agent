# eBay Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a real fixed-price eBay listing to the connected account when the seller clicks Approve & Publish, via Trading API `AddFixedPriceItem` with a `Verify` preflight.

**Architecture:** A thin Trading API client (`lib/ebay/trading.ts`) sends XML built by a pure builder (`lib/ebay/listing-xml.ts`); category comes from the Taxonomy API (`lib/ebay/category.ts`); condition maps via `lib/ebay/condition.ts`. `LiveEbayAdapter` gains `verifyListing` + real `publishListing`. A testable step (`lib/agent/steps/publish.ts`) orchestrates verify→publish→status updates against the DB; a server action wires it to the (now interactive) `ActionBar`.

**Tech Stack:** Next.js 15 server actions, TypeScript, Neon/PGlite (`Db` interface), Vitest, eBay Trading API (XML) + Commerce Taxonomy API (JSON), OAuth user token via `getUserAccessToken()`.

---

### Task 1: Condition → eBay ConditionID map

**Files:**
- Create: `lib/ebay/condition.ts`
- Test: `lib/ebay/condition.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ebay/condition.test.ts
import { describe, it, expect } from 'vitest';
import { conditionToEbayId } from './condition';

describe('conditionToEbayId', () => {
  it('maps new to 1000', () => expect(conditionToEbayId('new')).toBe(1000));
  it('maps open_box to 1500', () => expect(conditionToEbayId('open_box')).toBe(1500));
  it('maps used grades to 3000', () => {
    expect(conditionToEbayId('used_like_new')).toBe(3000);
    expect(conditionToEbayId('used_good')).toBe(3000);
    expect(conditionToEbayId('used_fair')).toBe(3000);
  });
  it('maps for_parts to 7000', () => expect(conditionToEbayId('for_parts')).toBe(7000));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ebay/condition.test.ts`
Expected: FAIL — cannot find module `./condition`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ebay/condition.ts
import type { ItemCondition } from '../types';

/** Map our condition grades to eBay ConditionID. Universal IDs; category-specific
 *  invalids (e.g. media wanting 2750) are caught by the Verify preflight. */
export function conditionToEbayId(condition: ItemCondition): number {
  switch (condition) {
    case 'new': return 1000;
    case 'open_box': return 1500;
    case 'used_like_new':
    case 'used_good':
    case 'used_fair': return 3000;
    case 'for_parts': return 7000;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ebay/condition.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ebay/condition.ts lib/ebay/condition.test.ts
git commit -m "feat: map item condition to eBay ConditionID"
```

---

### Task 2: `PublishListingInput` type + AddFixedPriceItem XML builder

**Files:**
- Modify: `lib/ebay/types.ts` (add types)
- Create: `lib/ebay/listing-xml.ts`
- Test: `lib/ebay/listing-xml.test.ts`

- [ ] **Step 1: Add the types**

Append to `lib/ebay/types.ts` (after `PublishResult`):

```ts
import type { ItemCondition } from '../types';

/** Everything the Trading API needs to list one fixed-price item. */
export interface PublishListingInput {
  title: string;
  description: string;
  price: number; // USD dollars
  categoryId: string; // eBay leaf category id
  condition: ItemCondition;
  aspects: Record<string, string>; // item specifics
  photoUrls: string[]; // public image URLs (Vercel Blob)
  postalCode: string; // ship-from ZIP
}

export interface VerifyResult {
  ok: boolean;
  errors: string[]; // eBay error LongMessages; empty when ok
}
```

- [ ] **Step 2: Write the failing test**

```ts
// lib/ebay/listing-xml.test.ts
import { describe, it, expect } from 'vitest';
import { buildFixedPriceItemXml } from './listing-xml';
import type { PublishListingInput } from './types';

const INPUT: PublishListingInput = {
  title: 'Levi\'s 501 Jeans 34x32 <blue>',
  description: 'Great & clean pair',
  price: 48,
  categoryId: '11483',
  condition: 'used_good',
  aspects: { Brand: "Levi's", Size: '34x32' },
  photoUrls: ['https://blob.example/a.jpg', 'https://blob.example/b.jpg'],
  postalCode: '94103',
};

describe('buildFixedPriceItemXml', () => {
  it('uses the Verify root when verify=true', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: true });
    expect(xml).toContain('<VerifyAddFixedPriceItemRequest');
  });
  it('uses the Add root when verify=false', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('<AddFixedPriceItemRequest');
  });
  it('escapes XML-unsafe characters in the title', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('Levi&apos;s 501 Jeans 34x32 &lt;blue&gt;');
  });
  it('emits category, price, condition, GTC, quantity, postal code', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('<CategoryID>11483</CategoryID>');
    expect(xml).toContain('<StartPrice currencyID="USD">48.00</StartPrice>');
    expect(xml).toContain('<ConditionID>3000</ConditionID>');
    expect(xml).toContain('<ListingDuration>GTC</ListingDuration>');
    expect(xml).toContain('<Quantity>1</Quantity>');
    expect(xml).toContain('<PostalCode>94103</PostalCode>');
  });
  it('emits each aspect as a NameValueList', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('<Name>Brand</Name><Value>Levi&apos;s</Value>');
    expect(xml).toContain('<Name>Size</Name><Value>34x32</Value>');
  });
  it('emits every photo as a PictureURL', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('<PictureURL>https://blob.example/a.jpg</PictureURL>');
    expect(xml).toContain('<PictureURL>https://blob.example/b.jpg</PictureURL>');
  });
  it('sets free shipping and 30-day returns', () => {
    const xml = buildFixedPriceItemXml(INPUT, { verify: false });
    expect(xml).toContain('<FreeShipping>true</FreeShipping>');
    expect(xml).toContain('<ReturnsWithinOption>Days_30</ReturnsWithinOption>');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/ebay/listing-xml.test.ts`
Expected: FAIL — cannot find module `./listing-xml`.

- [ ] **Step 4: Write minimal implementation**

```ts
// lib/ebay/listing-xml.ts
import type { PublishListingInput } from './types';
import { conditionToEbayId } from './condition';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Build the shared Item body for Verify/AddFixedPriceItem. Free shipping,
 *  30-day returns, GTC, quantity 1, US/USD, Managed Payments (no PaymentMethods). */
export function buildFixedPriceItemXml(
  input: PublishListingInput,
  opts: { verify: boolean },
): string {
  const root = opts.verify ? 'VerifyAddFixedPriceItemRequest' : 'AddFixedPriceItemRequest';
  const specifics = Object.entries(input.aspects)
    .filter(([, v]) => v && v.trim())
    .map(([name, value]) => `<NameValueList><Name>${esc(name)}</Name><Value>${esc(value)}</Value></NameValueList>`)
    .join('');
  const pictures = input.photoUrls
    .map((u) => `<PictureURL>${esc(u)}</PictureURL>`)
    .join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<${root} xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${esc(input.title)}</Title>
    <Description><![CDATA[${input.description}]]></Description>
    <PrimaryCategory><CategoryID>${esc(input.categoryId)}</CategoryID></PrimaryCategory>
    <StartPrice currencyID="USD">${input.price.toFixed(2)}</StartPrice>
    <ConditionID>${conditionToEbayId(input.condition)}</ConditionID>
    <Country>US</Country>
    <Currency>USD</Currency>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <Quantity>1</Quantity>
    <PostalCode>${esc(input.postalCode)}</PostalCode>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ItemSpecifics>${specifics}</ItemSpecifics>
    <PictureDetails>${pictures}</PictureDetails>
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>USPSGroundAdvantage</ShippingService>
        <ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost>
        <FreeShipping>true</FreeShipping>
      </ShippingServiceOptions>
    </ShippingDetails>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
    </ReturnPolicy>
  </Item>
</${root}>`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/ebay/listing-xml.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/ebay/types.ts lib/ebay/listing-xml.ts lib/ebay/listing-xml.test.ts
git commit -m "feat: build AddFixedPriceItem/Verify XML from a publish input"
```

---

### Task 3: Trading API response parsers + client

**Files:**
- Create: `lib/ebay/trading.ts`
- Test: `lib/ebay/trading.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ebay/trading.test.ts
import { describe, it, expect } from 'vitest';
import { parseTradingResponse, parseGetUserPostalCode } from './trading';

const SUCCESS = `<?xml version="1.0"?><AddFixedPriceItemResponse><Ack>Success</Ack><ItemID>110566893738</ItemID></AddFixedPriceItemResponse>`;
const FAILURE = `<?xml version="1.0"?><AddFixedPriceItemResponse><Ack>Failure</Ack>
  <Errors><SeverityCode>Error</SeverityCode><ShortMessage>Missing brand</ShortMessage><LongMessage>The item specific Brand is required.</LongMessage></Errors>
  <Errors><SeverityCode>Warning</SeverityCode><ShortMessage> w</ShortMessage><LongMessage>ignore me</LongMessage></Errors>
</AddFixedPriceItemResponse>`;
const USER = `<?xml version="1.0"?><GetUserResponse><Ack>Success</Ack><User><RegistrationAddress><PostalCode>94103</PostalCode></RegistrationAddress></User></GetUserResponse>`;

describe('parseTradingResponse', () => {
  it('reads Ack + ItemID on success', () => {
    const r = parseTradingResponse(SUCCESS);
    expect(r.ack).toBe('Success');
    expect(r.itemId).toBe('110566893738');
    expect(r.errors).toEqual([]);
  });
  it('collects only Error-severity LongMessages on failure', () => {
    const r = parseTradingResponse(FAILURE);
    expect(r.ack).toBe('Failure');
    expect(r.errors).toEqual(['The item specific Brand is required.']);
  });
});

describe('parseGetUserPostalCode', () => {
  it('reads the postal code', () => expect(parseGetUserPostalCode(USER)).toBe('94103'));
  it('returns null when absent', () => expect(parseGetUserPostalCode('<x/>')).toBeNull());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ebay/trading.test.ts`
Expected: FAIL — cannot find module `./trading`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ebay/trading.ts
import { ebayApiBase, getUserAccessToken } from './oauth';

export interface TradingResponse {
  ack: string;
  itemId?: string;
  errors: string[]; // Error-severity LongMessages
}

const TRADING_COMPAT_LEVEL = '1193';

/** Pull Ack/ItemID and Error-severity messages out of a Trading XML response. */
export function parseTradingResponse(xml: string): TradingResponse {
  const ack = xml.match(/<Ack>(\w+)<\/Ack>/)?.[1] ?? 'Unknown';
  const itemId = xml.match(/<ItemID>(\d+)<\/ItemID>/)?.[1];
  const errors: string[] = [];
  for (const block of xml.match(/<Errors>[\s\S]*?<\/Errors>/g) ?? []) {
    const severity = block.match(/<SeverityCode>(\w+)<\/SeverityCode>/)?.[1];
    if (severity && severity !== 'Error') continue;
    const msg = block.match(/<LongMessage>([\s\S]*?)<\/LongMessage>/)?.[1]
      ?? block.match(/<ShortMessage>([\s\S]*?)<\/ShortMessage>/)?.[1];
    if (msg) errors.push(msg.trim());
  }
  return { ack, itemId, errors };
}

export function parseGetUserPostalCode(xml: string): string | null {
  return xml.match(/<PostalCode>([^<]+)<\/PostalCode>/)?.[1]?.trim() ?? null;
}

/** POST a Trading API call with the user OAuth token (IAF header). */
export async function tradingRequest(callName: string, body: string): Promise<TradingResponse> {
  const token = await getUserAccessToken();
  const res = await fetch(`${ebayApiBase()}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_COMPAT_LEVEL,
      'X-EBAY-API-IAF-TOKEN': token,
      'Content-Type': 'text/xml',
    },
    body,
  });
  const xml = await res.text();
  return parseTradingResponse(xml);
}

/** The connected seller's registration ZIP, or null if eBay doesn't return one. */
export async function getSellerPostalCode(): Promise<string | null> {
  const token = await getUserAccessToken();
  const res = await fetch(`${ebayApiBase()}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': 'GetUser',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_COMPAT_LEVEL,
      'X-EBAY-API-IAF-TOKEN': token,
      'Content-Type': 'text/xml',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents"><DetailLevel>ReturnAll</DetailLevel></GetUserRequest>`,
  });
  return parseGetUserPostalCode(await res.text());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ebay/trading.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ebay/trading.ts lib/ebay/trading.test.ts
git commit -m "feat: Trading API client + response parsers (Add/Verify/GetUser)"
```

---

### Task 4: Category resolver (Taxonomy API)

**Files:**
- Create: `lib/ebay/category.ts`
- Test: `lib/ebay/category.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/ebay/category.test.ts
import { describe, it, expect } from 'vitest';
import { parseCategorySuggestion } from './category';

describe('parseCategorySuggestion', () => {
  it('returns the first suggestion leaf categoryId', () => {
    const json = { categorySuggestions: [
      { category: { categoryId: '11483', categoryName: 'Jeans' } },
      { category: { categoryId: '999', categoryName: 'Other' } },
    ] };
    expect(parseCategorySuggestion(json)).toBe('11483');
  });
  it('returns null when there are no suggestions', () => {
    expect(parseCategorySuggestion({ categorySuggestions: [] })).toBeNull();
    expect(parseCategorySuggestion({})).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ebay/category.test.ts`
Expected: FAIL — cannot find module `./category`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/ebay/category.ts
import { ebayApiBase, getAppToken } from './oauth';

interface CategorySuggestionResponse {
  categorySuggestions?: { category?: { categoryId?: string } }[];
}

/** First suggested leaf category id, or null. Pure — unit tested. */
export function parseCategorySuggestion(json: CategorySuggestionResponse): string | null {
  return json.categorySuggestions?.[0]?.category?.categoryId ?? null;
}

const cache = new Map<string, string>();
let treeIdCache: string | undefined;

async function defaultCategoryTreeId(token: string): Promise<string> {
  if (treeIdCache) return treeIdCache;
  const res = await fetch(
    `${ebayApiBase()}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_US`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Taxonomy tree id failed (${res.status})`);
  const data = (await res.json()) as { categoryTreeId?: string };
  if (!data.categoryTreeId) throw new Error('Taxonomy returned no categoryTreeId');
  treeIdCache = data.categoryTreeId;
  return treeIdCache;
}

/** Resolve a leaf category id from a listing title, or null if none found. */
export async function suggestCategoryId(title: string): Promise<string | null> {
  const key = title.trim().toLowerCase();
  if (!key) return null;
  const cached = cache.get(key);
  if (cached) return cached;

  const token = await getAppToken();
  const treeId = await defaultCategoryTreeId(token);
  const res = await fetch(
    `${ebayApiBase()}/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(title)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Taxonomy suggestions failed (${res.status})`);
  const id = parseCategorySuggestion((await res.json()) as CategorySuggestionResponse);
  if (id) cache.set(key, id);
  return id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ebay/category.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ebay/category.ts lib/ebay/category.test.ts
git commit -m "feat: resolve eBay leaf category from title via Taxonomy API"
```

---

### Task 5: Extend the adapter interface + mock

**Files:**
- Modify: `lib/ebay/types.ts:19-23` (the `EbayAdapter` interface)
- Modify: `lib/ebay/mock.ts:57-60` (mock publish + add verify)
- Modify: `lib/ebay/live.ts:37-42` (satisfy new interface; keep stubs)
- Test: `lib/ebay/mock.test.ts`

- [ ] **Step 1: Update the interface**

Replace `publishListing(draft: ListingDraft): Promise<PublishResult>;` in `lib/ebay/types.ts` and update the import line. The interface becomes:

```ts
export interface EbayAdapter {
  identifyByImage(input: IdentifyByImageInput): Promise<ItemIdentity>;
  findComps(query: { identity: ItemIdentity }): Promise<Comp[]>;
  verifyListing(input: PublishListingInput): Promise<VerifyResult>;
  publishListing(input: PublishListingInput): Promise<PublishResult>;
}
```

Remove the now-unused `ListingDraft` import from `lib/ebay/types.ts` if present (keep `ItemIdentity, Comp`).

- [ ] **Step 2: Write the failing test**

```ts
// lib/ebay/mock.test.ts
import { describe, it, expect } from 'vitest';
import { MockEbayAdapter } from './mock';
import type { PublishListingInput } from './types';

const INPUT: PublishListingInput = {
  title: 'X', description: 'Y', price: 10, categoryId: '1', condition: 'new',
  aspects: {}, photoUrls: [], postalCode: '94103',
};

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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/ebay/mock.test.ts`
Expected: FAIL — `verifyListing` not a function / type error.

- [ ] **Step 4: Update mock + live to the new interface**

In `lib/ebay/mock.ts`: change the import to include `PublishListingInput, VerifyResult`, drop `ListingDraft`. Replace `publishListing` and add `verifyListing`:

```ts
  async verifyListing(_input: PublishListingInput): Promise<VerifyResult> {
    return { ok: true, errors: [] };
  }

  async publishListing(input: PublishListingInput): Promise<PublishResult> {
    const id = `MOCK-${hashString(input.title + input.price)}`;
    return { ebayListingId: id, url: `https://mock.ebay.local/itm/${id}` };
  }
```

(Use `hashString` — already in the file — instead of `Date.now()`, which is banned in this codebase.)

In `lib/ebay/live.ts`: update the import to add `PublishListingInput, VerifyResult`, and replace the `publishListing` stub with two interface-satisfying stubs (real impl in Task 6):

```ts
  verifyListing(_input: PublishListingInput): Promise<VerifyResult> {
    throw new Error('verifyListing not wired yet');
  }

  publishListing(_input: PublishListingInput): Promise<PublishResult> {
    throw new Error('publishListing not wired yet');
  }
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run lib/ebay/mock.test.ts && npx tsc --noEmit`
Expected: mock tests PASS; tsc clean (interface satisfied everywhere).

- [ ] **Step 6: Commit**

```bash
git add lib/ebay/types.ts lib/ebay/mock.ts lib/ebay/live.ts lib/ebay/mock.test.ts
git commit -m "feat: adapter gains verifyListing + publishListing(input)"
```

---

### Task 6: Live adapter — real verify + publish

**Files:**
- Modify: `lib/ebay/live.ts` (implement the two methods from Task 5)

- [ ] **Step 1: Implement verify + publish**

Add imports at the top of `lib/ebay/live.ts`:

```ts
import type { PublishListingInput, VerifyResult } from './types';
import { buildFixedPriceItemXml } from './listing-xml';
import { tradingRequest } from './trading';
```

Replace the two stub methods with:

```ts
  async verifyListing(input: PublishListingInput): Promise<VerifyResult> {
    const res = await tradingRequest(
      'VerifyAddFixedPriceItem',
      buildFixedPriceItemXml(input, { verify: true }),
    );
    return { ok: res.ack === 'Success' || res.ack === 'Warning', errors: res.errors };
  }

  async publishListing(input: PublishListingInput): Promise<PublishResult> {
    const res = await tradingRequest(
      'AddFixedPriceItem',
      buildFixedPriceItemXml(input, { verify: false }),
    );
    if ((res.ack !== 'Success' && res.ack !== 'Warning') || !res.itemId) {
      throw new Error(res.errors.join('; ') || `eBay AddFixedPriceItem returned ${res.ack}`);
    }
    return { ebayListingId: res.itemId, url: `https://www.ebay.com/itm/${res.itemId}` };
  }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Full test run (no regressions)**

Run: `npx vitest run`
Expected: all existing + new tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/ebay/live.ts
git commit -m "feat: LiveEbayAdapter publishes via Trading API AddFixedPriceItem"
```

---

### Task 7: Persist condition + category on the listing

**Files:**
- Modify: `lib/db/schema.ts` (add ALTER statements)
- Modify: `lib/db/repos/listings.ts` (row type, create, update)
- Modify: `lib/agent/steps/saveDraft.ts:22-28` (pass condition)
- Test: `lib/db/repos/listings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/db/repos/listings.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { createItem } from './items';
import { createListing, updateListing, getListing } from './listings';

describe('listings condition + category', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('persists condition on create and category on update', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    const l = await createListing(db, {
      itemId: item.id, title: 'T', specifics: {}, description: 'd',
      price: 10, condition: 'used_good',
    });
    expect(l.condition).toBe('used_good');
    await updateListing(db, l.id, { ebayCategoryId: '11483', status: 'live', ebayListingId: '42' });
    const after = await getListing(db, l.id);
    expect(after?.ebayCategoryId).toBe('11483');
    expect(after?.status).toBe('live');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/db/repos/listings.test.ts`
Expected: FAIL — `condition` not accepted / `ebayCategoryId` undefined.

- [ ] **Step 3: Add the columns**

In `lib/db/schema.ts`, append two statements to the `SCHEMA_STATEMENTS` array (after the `create table … listings` entry is fine; ALTERs are idempotent):

```ts
  `alter table listings add column if not exists condition text`,
  `alter table listings add column if not exists ebay_category_id text`,
```

- [ ] **Step 4: Update the listings repo**

In `lib/db/repos/listings.ts`:

Add to `ListingRow`: `condition: string | null;` and `ebayCategoryId: string | null;`
Add to `RawListing`: `condition: string | null;` and `ebay_category_id: string | null;`
In `mapListing`, add: `condition: r.condition, ebayCategoryId: r.ebay_category_id,`

Change `createListing` to accept `condition?: ItemCondition` and insert it (import `ItemCondition` from `../../types`):

```ts
export async function createListing(
  db: Db,
  input: {
    itemId: string;
    title: string;
    specifics: Record<string, string>;
    description: string;
    price: number | null;
    priceRange?: unknown;
    condition?: ItemCondition;
  },
): Promise<ListingRow> {
  const { rows } = await db.query<RawListing>(
    `insert into listings (item_id, title, specifics, description, price, price_range, condition)
     values ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7)
     returning *`,
    [
      input.itemId,
      input.title,
      JSON.stringify(input.specifics),
      input.description,
      input.price,
      JSON.stringify(input.priceRange ?? null),
      input.condition ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error('createListing: insert returned no row');
  return mapListing(row);
}
```

Add to `ListingUpdate`: `condition?: string; ebayCategoryId?: string | null;` and, in `updateListing`, before the `if (sets.length === 0)` guard:

```ts
  if (patch.condition !== undefined) add('condition', patch.condition);
  if (patch.ebayCategoryId !== undefined) add('ebay_category_id', patch.ebayCategoryId);
```

- [ ] **Step 5: Pass condition from saveDraft**

In `lib/agent/steps/saveDraft.ts`, change the `createListing` call to include the draft condition:

```ts
  const listing = await createListing(db, {
    itemId,
    title: draft.title,
    specifics: draft.aspects,
    description: draft.description,
    price: draft.price,
    condition: draft.condition,
  });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/db/repos/listings.test.ts && npx vitest run lib/agent/steps`
Expected: PASS (new test + existing saveDraft tests still green).

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts lib/db/repos/listings.ts lib/agent/steps/saveDraft.ts lib/db/repos/listings.test.ts
git commit -m "feat: persist condition + eBay category id on listings"
```

---

### Task 8: Publish step + pending-approval lookup

**Files:**
- Modify: `lib/db/repos/approvals.ts` (add `getPendingApprovalByRef`)
- Create: `lib/agent/steps/publish.ts`
- Test: `lib/agent/steps/publish.test.ts`

- [ ] **Step 1: Add the approval lookup**

Append to `lib/db/repos/approvals.ts`:

```ts
export async function getPendingApprovalByRef(db: Db, refId: string): Promise<ApprovalRow | null> {
  const { rows } = await db.query<RawApproval>(
    `select * from approvals where ref_id = $1 and state = 'pending' order by created_at desc, ctid desc limit 1`,
    [refId],
  );
  const row = rows[0];
  return row ? mapApproval(row) : null;
}
```

- [ ] **Step 2: Write the failing test**

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/agent/steps/publish.test.ts`
Expected: FAIL — cannot find module `./publish`.

- [ ] **Step 4: Write the step**

```ts
// lib/agent/steps/publish.ts
import type { Db } from '../../db/types';
import type { EbayAdapter, PublishListingInput } from '../../ebay/types';
import type { ItemCondition } from '../../types';
import { getListing, updateListing } from '../../db/repos/listings';
import { getItem, updateItemStatus } from '../../db/repos/items';
import { getPendingApprovalByRef, decideApproval } from '../../db/repos/approvals';
import { recordEvent } from '../../db/repos/events';

export interface PublishDeps {
  resolveCategoryId: (title: string) => Promise<string | null>;
  getPostalCode: () => Promise<string | null>;
}

export type PublishOutcome = { ok: true; url: string } | { ok: false; errors: string[] };

/** Verify then publish an approved listing draft to eBay, updating all statuses. */
export async function publishApprovedListing(
  db: Db,
  adapter: EbayAdapter,
  listingId: string,
  deps: PublishDeps,
): Promise<PublishOutcome> {
  const listing = await getListing(db, listingId);
  if (!listing) return { ok: false, errors: ['Listing not found.'] };
  if (listing.status === 'live') return { ok: false, errors: ['This listing is already live.'] };

  const item = await getItem(db, listing.itemId);
  if (!item) return { ok: false, errors: ['Item not found.'] };

  const categoryId = listing.ebayCategoryId ?? (await deps.resolveCategoryId(listing.title));
  if (!categoryId) return { ok: false, errors: ['Could not determine an eBay category for this item.'] };
  if (!listing.ebayCategoryId) await updateListing(db, listingId, { ebayCategoryId: categoryId });

  const postalCode = await deps.getPostalCode();
  if (!postalCode) return { ok: false, errors: ['No ship-from ZIP. Set SELLER_POSTAL_CODE or add an address to your eBay account.'] };

  if (listing.price === null) return { ok: false, errors: ['Listing has no price.'] };

  const input: PublishListingInput = {
    title: listing.title,
    description: listing.description,
    price: listing.price,
    categoryId,
    condition: (listing.condition as ItemCondition) ?? 'used_good',
    aspects: listing.specifics,
    photoUrls: item.photos,
    postalCode,
  };

  const verify = await adapter.verifyListing(input);
  if (!verify.ok) return { ok: false, errors: verify.errors };

  let result;
  try {
    result = await adapter.publishListing(input);
  } catch (e) {
    await recordEvent(db, { itemId: item.id, kind: 'publish_failed', data: { message: (e as Error).message } });
    return { ok: false, errors: [(e as Error).message] };
  }

  await updateListing(db, listingId, { status: 'live', ebayListingId: result.ebayListingId });
  await updateItemStatus(db, item.id, 'listed');
  const approval = await getPendingApprovalByRef(db, listingId);
  if (approval) await decideApproval(db, approval.id, 'approved');
  await recordEvent(db, { itemId: item.id, kind: 'published', data: { ebayListingId: result.ebayListingId, url: result.url } });

  return { ok: true, url: result.url };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/agent/steps/publish.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/db/repos/approvals.ts lib/agent/steps/publish.ts lib/agent/steps/publish.test.ts
git commit -m "feat: publish step — verify, list, flip statuses, resolve approval"
```

---

### Task 9: Server actions

**Files:**
- Create: `app/listings/[id]/actions.ts`

- [ ] **Step 1: Write the actions**

```ts
// app/listings/[id]/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { getEbayAdapter } from '@/lib/ebay';
import { suggestCategoryId } from '@/lib/ebay/category';
import { getSellerPostalCode } from '@/lib/ebay/trading';
import { publishApprovedListing, type PublishOutcome } from '@/lib/agent/steps/publish';
import { getPendingApprovalByRef, decideApproval } from '@/lib/db/repos/approvals';
import { getListing } from '@/lib/db/repos/listings';
import { updateItemStatus } from '@/lib/db/repos/items';
import { recordEvent } from '@/lib/db/repos/events';

const isLive = () =>
  (process.env.EBAY_BACKEND ?? (process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID ? 'live' : 'mock')) === 'live';

export async function publishListingAction(listingId: string): Promise<PublishOutcome> {
  const db = getDb();
  const outcome = await publishApprovedListing(db, getEbayAdapter(), listingId, {
    // Live category/ZIP come from eBay; mock backend never calls these (its verify short-circuits nothing),
    // so a static fallback keeps local/mock runs working without network.
    resolveCategoryId: (title) => (isLive() ? suggestCategoryId(title) : Promise.resolve('11483')),
    getPostalCode: () => (isLive() ? getSellerPostalCode() : Promise.resolve(process.env.SELLER_POSTAL_CODE ?? '94103')),
  });
  if (outcome.ok) revalidatePath(`/listings/${listingId}`);
  return outcome;
}

export async function rejectListingAction(listingId: string): Promise<{ ok: boolean }> {
  const db = getDb();
  const listing = await getListing(db, listingId);
  if (!listing) return { ok: false };
  const approval = await getPendingApprovalByRef(db, listingId);
  if (approval) await decideApproval(db, approval.id, 'rejected');
  await updateItemStatus(db, listing.itemId, 'draft');
  await recordEvent(db, { itemId: listing.itemId, kind: 'sent_back', data: { listingId } });
  revalidatePath(`/listings/${listingId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/listings/[id]/actions.ts
git commit -m "feat: publish + reject server actions for the review screen"
```

---

### Task 10: Wire the ActionBar UI

**Files:**
- Modify: `components/review/action-bar.tsx`
- Modify: `app/listings/[id]/page.tsx:70` (pass `listingId`, `status`, `isSample`)

- [ ] **Step 1: Make the ActionBar interactive**

Replace `components/review/action-bar.tsx` with:

```tsx
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { publishListingAction, rejectListingAction } from '@/app/listings/[id]/actions';

type State =
  | { kind: 'idle' }
  | { kind: 'done'; url: string }
  | { kind: 'errors'; errors: string[] };

export function ActionBar({
  listingId, price, status, disabled,
}: { listingId: string; price: number; status: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<State>(
    status === 'live' ? { kind: 'done', url: '' } : { kind: 'idle' },
  );

  const publish = () =>
    start(async () => {
      const r = await publishListingAction(listingId);
      setState(r.ok ? { kind: 'done', url: r.url } : { kind: 'errors', errors: r.errors });
    });
  const reject = () => start(async () => { await rejectListingAction(listingId); });

  const live = state.kind === 'done';

  return (
    <div className="sticky bottom-6 z-20 mt-8" style={{ animationDelay: '260ms' }}>
      {state.kind === 'errors' && (
        <ul className="mb-2 space-y-1 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300">
          {state.errors.map((e, i) => <li key={i}>· {e}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface/85 px-5 py-3.5 shadow-float backdrop-blur-xl">
        <div className="flex items-center gap-2.5 pl-1">
          {live ? (
            <>
              <span className="text-[13px] text-ink-muted">Live on eBay</span>
              {state.kind === 'done' && state.url && (
                <Link href={state.url} target="_blank" className="font-display text-[15px] font-bold text-ink underline">
                  View listing
                </Link>
              )}
            </>
          ) : (
            <>
              <span className="text-[13px] text-ink-muted">Goes live at</span>
              <span className="font-display text-[19px] font-bold text-ink tnum">${price}</span>
              <span className="ml-1 hidden text-[12px] text-ink-faint sm:inline">· free shipping · 30-day returns</span>
            </>
          )}
        </div>

        {!live && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={reject}
              disabled={pending || disabled}
              className="h-10 rounded-full px-4 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              Send back
            </button>
            <button
              onClick={publish}
              disabled={pending || disabled}
              className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold text-white transition-[transform,filter] hover:-translate-y-px hover:brightness-[1.06] active:scale-[0.97] disabled:opacity-60"
              style={{
                background: 'var(--ebay-green-deep)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 8px 18px -8px var(--ebay-green-deep)',
              }}
            >
              <Icon.Check className="size-4" strokeWidth={2.4} />
              {pending ? 'Publishing…' : 'Approve & Publish'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Pass the new props from the page**

In `app/listings/[id]/page.tsx`, the sample fallback has no real listing to publish, so disable actions when showing the sample. Update the `ActionBar` usage (line ~70):

```tsx
          <ActionBar listingId={l.id} price={l.price} status={l.status} disabled={real === null} />
```

Add `status` to the `ListingDetail` view model so `l.status` exists. In `lib/sample-listing.ts`, add `status: string;` to the `ListingDetail` interface and `status: 'draft'` to `SAMPLE_LISTING`. In `lib/queries.ts` `getListingDetail`, select `l.status` in the query and add `status: String(r.status)` to the returned object.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npx next build`
Expected: clean compile, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/review/action-bar.tsx app/listings/[id]/page.tsx lib/sample-listing.ts lib/queries.ts
git commit -m "feat: wire Approve & Publish / Send back to server actions"
```

---

### Task 11: Env documentation

**Files:**
- Modify: `.env.example` (if present) or create it

- [ ] **Step 1: Document the fallback ZIP**

Add to `.env.example`:

```
# Optional ship-from ZIP used when eBay GetUser has no registration postal code
SELLER_POSTAL_CODE=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document SELLER_POSTAL_CODE fallback"
```

---

## Self-Review

- **Spec coverage:** Trading API publish (T2,3,6), Verify preflight (T6,8), auto-category (T4,8,9), condition map + persist (T1,7), free shipping + 30-day returns (T2), ZIP from GetUser + env fallback (T3,9), approval-gated server action + status flips (T8,9), interactive UI with error surfacing (T10), tests (T1–8). All spec sections map to a task.
- **Type consistency:** `PublishListingInput`/`VerifyResult`/`PublishResult` defined in T2/T5 and used identically in T6/T8/T9. `EbayAdapter` gains `verifyListing`+`publishListing(input)` in T5, implemented in T5 (mock/stub) and T6 (live). `ListingRow.condition`/`ebayCategoryId` added in T7, read in T8. `PublishOutcome` defined in T8, returned by the action in T9, consumed in T10.
- **Deferred (not in this plan, per spec):** inline field editing, per-category required-aspect prefetch, offers/messaging. "Send back" is included (cheap) though marked fast-follow in the spec.
