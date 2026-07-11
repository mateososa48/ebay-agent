# eve Agent Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the eve agent so it drives the full listing pipeline end-to-end against mock eBay data: given an item (photos + notes), it identifies the item, researches a price, writes a human-quality listing (VOICE.md), self-checks it with the slop-linter, and saves a draft into the review queue.

**Architecture:** The pipeline logic lives in plain, injectable functions under `lib/agent/steps/` (take a `Db` + `EbayAdapter`, fully unit-tested against PGlite + the mock adapter — no model needed). The eve agent (`agent/` directory) is a thin orchestration shell: `agent/instructions.md` (system prompt derived from `VOICE.md` + the step order), `agent/agent.ts` (model = Opus 4.8), and `agent/tools/*.ts` (one thin `defineTool` per step that calls a `lib/agent/steps` function). The model orchestrates by calling tools per the instructions; the model writes the actual listing copy.

**Tech Stack:** eve (`0.22.x`, **requires Node ≥ 24** — activate with `nvm use 24`), TypeScript, Vitest, Zod. Builds on Plan 1 (adapter + linter) and Plan 2 (Neon data layer).

**Scope note:** Plan 3 of 4. Publishing to eBay happens on human approval via the dashboard (Plan 4) — this plan stops at "draft saved + queued for approval." No offers/messaging (Phases 2/3). eve's native `needsApproval` gate is noted for later (Phase 2 publish/offer actions), not used here.

**Environment invariant (applies to every task):** run all `pnpm`/`eve`/`node` commands under Node 24:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24
```
(Node 24.18.0 is already installed; `.nvmrc` pins `24`. Do NOT run these under the default Node 20 — eve refuses to run.) Prefix each shell step with the two lines above (they don't persist across separate shell invocations).

---

## File Structure

```
agent/                       # scaffolded by `eve init .` (Task 1), then edited
  agent.ts                   # defineAgent({ model: 'anthropic/claude-opus-4-8' })
  instructions.md            # system prompt: orchestration + VOICE.md rules
  channels/eve.ts            # built-in HTTP channel (scaffolded; leave as-is)
  tools/
    identify_item.ts         # thin defineTool → lib/agent/steps/identify
    research_price.ts        # thin defineTool → lib/agent/steps/price
    lint_listing.ts          # thin defineTool → lintListing
    save_listing_draft.ts    # thin defineTool → lib/agent/steps/saveDraft
lib/agent/steps/
  identify.ts   + identify.test.ts
  price.ts      + price.test.ts
  saveDraft.ts  + saveDraft.test.ts
lib/index.ts                 # (extend) export the step functions
```

The `agent/tools/*` files are thin (no logic beyond wiring `getDb()`/`getEbayAdapter()` into a step). All real logic + tests live in `lib/agent/steps/`.

---

## Task 1: Install Node 24, scaffold eve, record the real integration

**Files:** created by the eve CLI (observe and report exactly what appears).

- [ ] **Step 1: Activate Node 24 and confirm**

Run:
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24
node -v   # must print v24.x
```
Expected: `v24.18.0`.

- [ ] **Step 2: Confirm the existing suite still passes on Node 24 (regression guard)**

Run: `pnpm install && pnpm test`
Expected: the existing 58 tests pass on Node 24 (PGlite + Neon-http both support Node 24). If any fail, STOP and report — do not proceed until green on Node 24.

- [ ] **Step 3: Scaffold eve into the existing Next.js app**

Run: `npx eve@latest init .`
This adds the `eve`, `ai`, `zod` deps and scaffolds `agent/instructions.md`, `agent/agent.ts`, and the built-in HTTP channel `agent/channels/eve.ts`.

**If the CLI is interactive** (model picker / "start dev server?"): choose an Anthropic model if asked, and DECLINE starting the dev server (or Ctrl-C once it starts). If it cannot run non-interactively, report NEEDS_CONTEXT with the exact prompt.

- [ ] **Step 4: Record what was scaffolded (this is a deliverable — the plan's later steps assume it)**

Run and paste the output into your report:
```bash
git status --short
ls -R agent
sed -n '1,60p' agent/channels/eve.ts   # how the HTTP channel is defined
cat agent/agent.ts
```
Answer explicitly in your report: **How is `/eve/v1/session` exposed?** (a Next.js route handler under `app/`, a file in `agent/channels/`, a separate dev server/port, or middleware?) If eve added or expects a Next.js route (e.g. `app/eve/[...route]/route.ts` or similar), note its exact path. If unclear, run `npx eve@latest build` and inspect its output/logs for the mounted route.

- [ ] **Step 5: Confirm eve compiles**

Run: `npx eve@latest build 2>&1 | tail -30`
Expected: a successful build/validate of the (default) agent. If it fails, report the exact error as BLOCKED.

- [ ] **Step 6: Commit the scaffold as-is (before our edits)**

```bash
git add -A
git commit -m "chore: scaffold eve agent (eve init)"
```

---

## Task 2: Pipeline step — identify

**Files:**
- Create: `lib/agent/steps/identify.ts`, `lib/agent/steps/identify.test.ts`

- [ ] **Step 1: Write the failing test `lib/agent/steps/identify.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { MockEbayAdapter } from '../../ebay/mock';
import { createItem, getItem } from '../../db/repos/items';
import { listEventsByItem } from '../../db/repos/events';
import { identifyItem } from './identify';

describe('identifyItem', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('identifies the item, persists the identity, advances status, and logs an event', async () => {
    db = await makeTestDb();
    const adapter = new MockEbayAdapter();
    const item = await createItem(db, { photos: ['blob://a.jpg'], sellerNotes: "Levi's 501 jeans 34x32" });

    const identity = await identifyItem(db, adapter, item.id);

    expect(identity.brand).toBe("Levi's");
    const saved = await getItem(db, item.id);
    expect((saved?.identity as { brand: string }).brand).toBe("Levi's");
    expect(saved?.status).toBe('identifying');
    const events = await listEventsByItem(db, item.id);
    expect(events.some((e) => e.kind === 'identified')).toBe(true);
  });

  it('throws for a missing item', async () => {
    db = await makeTestDb();
    await expect(identifyItem(db, new MockEbayAdapter(), '00000000-0000-0000-0000-000000000000'))
      .rejects.toThrow(/not found/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/agent/steps/identify.test.ts`
Expected: FAIL — cannot find `./identify`.

- [ ] **Step 3: Implement `lib/agent/steps/identify.ts`**

```ts
import type { Db } from '../../db/types';
import type { EbayAdapter } from '../../ebay/types';
import type { ItemIdentity } from '../../types';
import { getItem, setItemEnrichment, updateItemStatus } from '../../db/repos/items';
import { recordEvent } from '../../db/repos/events';

/** Identify an item from its photos + notes, persist the identity, advance status. */
export async function identifyItem(db: Db, adapter: EbayAdapter, itemId: string): Promise<ItemIdentity> {
  const item = await getItem(db, itemId);
  if (!item) throw new Error(`identifyItem: item ${itemId} not found`);

  const identity = await adapter.identifyByImage({
    images: item.photos,
    sellerNotes: item.sellerNotes ?? undefined,
  });

  await setItemEnrichment(db, itemId, { identity });
  await updateItemStatus(db, itemId, 'identifying');
  await recordEvent(db, {
    itemId,
    kind: 'identified',
    data: { confidence: identity.confidence, ambiguities: identity.ambiguities },
  });
  return identity;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/agent/steps/identify.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/agent/steps/identify.ts lib/agent/steps/identify.test.ts
git commit -m "feat: agent step — identify item"
```

---

## Task 3: Pipeline step — price

**Files:**
- Create: `lib/agent/steps/price.ts`, `lib/agent/steps/price.test.ts`

- [ ] **Step 1: Write the failing test `lib/agent/steps/price.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { MockEbayAdapter } from '../../ebay/mock';
import { createItem, getItem } from '../../db/repos/items';
import { listCompsByItem } from '../../db/repos/comps';
import { identifyItem } from './identify';
import { researchPrice } from './price';

describe('researchPrice', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('saves comps, computes an estimate within the comp range, and advances status', async () => {
    db = await makeTestDb();
    const adapter = new MockEbayAdapter();
    const item = await createItem(db, { photos: ['x'], sellerNotes: "Levi's 501 jeans" });
    await identifyItem(db, adapter, item.id);

    const est = await researchPrice(db, adapter, item.id);

    expect(est.comps.length).toBeGreaterThanOrEqual(3);
    expect(est.low).toBeLessThanOrEqual(est.suggested);
    expect(est.suggested).toBeLessThanOrEqual(est.high);
    expect(est.currency).toBe('USD');

    const saved = await listCompsByItem(db, item.id);
    expect(saved.length).toBe(est.comps.length);
    expect((await getItem(db, item.id))?.status).toBe('priced');
  });

  it('throws if the item was never identified', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await expect(researchPrice(db, new MockEbayAdapter(), item.id)).rejects.toThrow(/identified/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/agent/steps/price.test.ts`
Expected: FAIL — cannot find `./price`.

- [ ] **Step 3: Implement `lib/agent/steps/price.ts`**

```ts
import type { Db } from '../../db/types';
import type { EbayAdapter } from '../../ebay/types';
import type { ItemIdentity, PriceEstimate } from '../../types';
import { getItem, updateItemStatus } from '../../db/repos/items';
import { replaceCompsForItem, listCompsByItem } from '../../db/repos/comps';
import { recordEvent } from '../../db/repos/events';

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Fetch comps for an identified item, persist them, and compute a price estimate. */
export async function researchPrice(db: Db, adapter: EbayAdapter, itemId: string): Promise<PriceEstimate> {
  const item = await getItem(db, itemId);
  if (!item) throw new Error(`researchPrice: item ${itemId} not found`);
  const identity = item.identity as ItemIdentity | null;
  if (!identity) throw new Error('researchPrice: item has not been identified yet');

  const comps = await adapter.findComps({ identity });
  await replaceCompsForItem(
    db,
    itemId,
    comps.map((c) => ({ source: c.source, title: c.title, price: c.price, sold: c.sold, ref: c.ref, capturedAt: c.capturedAt })),
  );

  const prices = comps.map((c) => c.price).sort((a, b) => a - b);
  const suggested = Math.round(median(prices) * 100) / 100;
  const low = prices[0] ?? suggested;
  const high = prices[prices.length - 1] ?? suggested;

  await updateItemStatus(db, itemId, 'priced');
  await recordEvent(db, { itemId, kind: 'priced', data: { suggested, low, high, comps: comps.length } });

  // Read comps back from the DB so the estimate reflects what was persisted.
  const persisted = await listCompsByItem(db, itemId);
  return {
    suggested,
    low,
    high,
    currency: 'USD',
    rationale: `Based on ${persisted.length} comparable active listings (${low}–${high}).`,
    comps: persisted.map((c) => ({ source: c.source, title: c.title, price: c.price, sold: c.sold, ref: c.ref ?? undefined, capturedAt: c.capturedAt })),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/agent/steps/price.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/agent/steps/price.ts lib/agent/steps/price.test.ts
git commit -m "feat: agent step — research price from comps"
```

---

## Task 4: Pipeline step — save draft (with linter gate)

**Files:**
- Create: `lib/agent/steps/saveDraft.ts`, `lib/agent/steps/saveDraft.test.ts`

- [ ] **Step 1: Write the failing test `lib/agent/steps/saveDraft.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../../db/testdb';
import { createItem } from '../../db/repos/items';
import { getListing } from '../../db/repos/listings';
import { listPendingApprovals } from '../../db/repos/approvals';
import type { ListingDraft } from '../../types';
import { saveListingDraft } from './saveDraft';

const cleanDraft: ListingDraft = {
  title: "Levi's 501 Vintage Jeans Men's 34x32 Straight Leg Dark Wash",
  aspects: { Brand: "Levi's", Size: '34x32' },
  description: "Men's Levi's 501s, 34x32, dark wash. Small fade at the left knee, shown in photo 3. Ships next day.",
  price: 48,
  condition: 'used_good',
};

describe('saveListingDraft', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('saves a clean draft, attaches the linter report, and enqueues an approval', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });

    const res = await saveListingDraft(db, item.id, cleanDraft);

    const listing = await getListing(db, res.listingId);
    expect(listing?.title).toBe(cleanDraft.title);
    expect(listing?.status).toBe('draft');
    expect((listing?.linterReport as { ok: boolean }).ok).toBe(true);

    const pending = await listPendingApprovals(db);
    expect(pending.some((a) => a.type === 'listing' && a.refId === res.listingId)).toBe(true);
  });

  it('refuses to save a draft with blocking compliance issues', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    const bad: ListingDraft = { ...cleanDraft, description: 'Email me at seller@gmail.com to buy.' };
    await expect(saveListingDraft(db, item.id, bad)).rejects.toThrow(/blocking/);
    // nothing queued
    expect(await listPendingApprovals(db)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/agent/steps/saveDraft.test.ts`
Expected: FAIL — cannot find `./saveDraft`.

- [ ] **Step 3: Implement `lib/agent/steps/saveDraft.ts`**

```ts
import type { Db } from '../../db/types';
import type { ListingDraft } from '../../types';
import { lintListing, type LinterReport } from '../../voice/linter';
import { createListing, updateListing } from '../../db/repos/listings';
import { enqueueApproval } from '../../db/repos/approvals';
import { recordEvent } from '../../db/repos/events';

export interface SaveDraftResult {
  listingId: string;
  approvalId: string;
  linter: LinterReport;
}

/** Lint a listing draft; if compliant, persist it and queue it for the seller's approval. */
export async function saveListingDraft(db: Db, itemId: string, draft: ListingDraft): Promise<SaveDraftResult> {
  const linter = lintListing(draft);
  if (!linter.ok) {
    const codes = linter.blocking.map((b) => b.code).join(', ');
    throw new Error(`saveListingDraft: draft has ${linter.blocking.length} blocking issue(s) [${codes}] — fix before saving`);
  }

  const listing = await createListing(db, {
    itemId,
    title: draft.title,
    specifics: draft.aspects,
    description: draft.description,
    price: draft.price,
  });
  await updateListing(db, listing.id, { linterReport: linter });
  const approval = await enqueueApproval(db, { type: 'listing', refId: listing.id });
  await recordEvent(db, {
    itemId,
    kind: 'draft_saved',
    data: { listingId: listing.id, warnings: linter.warnings.length },
  });

  return { listingId: listing.id, approvalId: approval.id, linter };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/agent/steps/saveDraft.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/agent/steps/saveDraft.ts lib/agent/steps/saveDraft.test.ts
git commit -m "feat: agent step — save draft with linter gate + approval enqueue"
```

---

## Task 5: The eve tools (thin wrappers)

**Files:**
- Create: `agent/tools/identify_item.ts`, `agent/tools/research_price.ts`, `agent/tools/lint_listing.ts`, `agent/tools/save_listing_draft.ts`

> Note on imports: eve tools run in the app runtime with access to `lib/`. If `agent/tools/*` cannot import from `lib/` via a relative path in this project layout, use the path that Task 1 revealed works (e.g. a configured alias). Prefer the relative path shown below first.

- [ ] **Step 1: `agent/tools/identify_item.ts`**

```ts
import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getDb } from '../../lib/db/client';
import { getEbayAdapter } from '../../lib/ebay';
import { identifyItem } from '../../lib/agent/steps/identify';

export default defineTool({
  description:
    'Identify the item being listed, from its photos and the seller’s notes. Call this FIRST, passing the itemId given in your task. Returns brand, product type, category, item specifics, a confidence score, and any ambiguities you should flag to the seller.',
  inputSchema: z.object({ itemId: z.string().describe('The id of the item to identify') }),
  async execute({ itemId }) {
    return identifyItem(getDb(), getEbayAdapter(), itemId);
  },
});
```

- [ ] **Step 2: `agent/tools/research_price.ts`**

```ts
import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getDb } from '../../lib/db/client';
import { getEbayAdapter } from '../../lib/ebay';
import { researchPrice } from '../../lib/agent/steps/price';

export default defineTool({
  description:
    'Research a realistic price for the item using comparable listings. Call this AFTER identify_item. Returns a suggested price, a low–high range, and the comps used as evidence. Do not invent a price; use this.',
  inputSchema: z.object({ itemId: z.string().describe('The id of the (already identified) item') }),
  async execute({ itemId }) {
    return researchPrice(getDb(), getEbayAdapter(), itemId);
  },
});
```

- [ ] **Step 3: `agent/tools/lint_listing.ts`**

```ts
import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { lintListing } from '../../lib/voice/linter';

export default defineTool({
  description:
    'Check a listing draft against eBay policy (blocking) and the anti-slop style rules (warnings). Call this on every draft BEFORE saving. If it returns ok:false, fix the blocking issues and lint again. Also address warnings so the copy reads human.',
  inputSchema: z.object({
    title: z.string(),
    aspects: z.record(z.string(), z.string()),
    description: z.string(),
    price: z.number(),
    condition: z.enum(['new', 'open_box', 'used_like_new', 'used_good', 'used_fair', 'for_parts']),
  }),
  async execute(draft) {
    return lintListing(draft);
  },
});
```

- [ ] **Step 4: `agent/tools/save_listing_draft.ts`**

```ts
import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getDb } from '../../lib/db/client';
import { saveListingDraft } from '../../lib/agent/steps/saveDraft';

export default defineTool({
  description:
    'Save the finished listing draft and queue it for the seller’s approval. Call this LAST, only after lint_listing returns ok:true. It re-checks compliance and will reject a draft with blocking issues.',
  inputSchema: z.object({
    itemId: z.string(),
    title: z.string(),
    aspects: z.record(z.string(), z.string()),
    description: z.string(),
    price: z.number(),
    condition: z.enum(['new', 'open_box', 'used_like_new', 'used_good', 'used_fair', 'for_parts']),
  }),
  async execute({ itemId, ...draft }) {
    return saveListingDraft(getDb(), itemId, draft);
  },
});
```

- [ ] **Step 5: Typecheck + eve build**

Run: `pnpm typecheck && npx eve@latest build 2>&1 | tail -20`
Expected: typecheck clean; eve build validates the agent and lists the four tools (`identify_item`, `research_price`, `lint_listing`, `save_listing_draft`). If eve build reports the tools can't import `lib/`, adjust the import path per Task 1's findings and note it.

- [ ] **Step 6: Commit**

```bash
git add agent/tools
git commit -m "feat: eve tools wrapping the pipeline steps"
```

---

## Task 6: Agent config + instructions (the voice + orchestration)

**Files:**
- Modify: `agent/agent.ts`, `agent/instructions.md`

- [ ] **Step 1: Set the model in `agent/agent.ts`**

```ts
import { defineAgent } from 'eve';

export default defineAgent({
  model: 'anthropic/claude-opus-4-8',
});
```

- [ ] **Step 2: Write `agent/instructions.md`**

Replace the scaffolded contents with:
```md
You are the listing engine for a sharp, experienced eBay seller. You are given an `itemId` for an item the seller has photographed and wants to sell. Produce a publish-ready listing draft and queue it for their approval.

## Do this, in order
1. Call `identify_item` with the itemId. Note the brand, product type, item specifics, and any ambiguities. If confidence is low, still proceed but keep the copy honest and unembellished.
2. Call `research_price` with the itemId. Use its `suggested` price (you may nudge within the low–high range if the item's condition warrants). Never invent a price.
3. Write the listing yourself:
   - **Title** (≤ 80 characters): front-load brand → product type → model → key variants (size, color) → real search keywords. No ALL-CAPS, no symbols/markers, no filler like "L@@K" or "RARE".
   - **Item specifics**: fill every specific you know accurately (Brand, Size, Color, Type, etc.).
   - **Description**: lead with condition + the key feature + the shipping note in the first ~200 characters. State flaws plainly and specifically. Keep it to what you'd actually say about something you own.
4. Call `lint_listing` on your draft. If `ok` is false, fix every blocking issue and lint again until clean. Revise to clear warnings too.
5. Call `save_listing_draft` to save it and queue it for approval.
6. Reply with a 2–3 sentence summary: what the item is, the price you set and why, and anything the seller should double-check.

## Voice — write like a person, never like AI
- Plain, committed, specific. Short sentences mixed with longer ones. Say the thing.
- Banned words/phrases (they read as AI): boasts, elevate, testament, meticulous, curated, nestled, vibrant, seamless, unleash, "look no further", "perfect for", "in the world of", "a testament to". Just describe the item.
- No negative parallelism ("not just X, but Y"), no rule-of-three adjective stacks, no em-dash overuse, no hollow superlatives.
- Honesty sells: name the flaw, give the measurement, show you actually looked at it.

## Rules the linter enforces (respect them up front)
- Never put contact info, links/URLs, email addresses, or phone numbers in a listing.
- Never solicit off-eBay sales or mention other marketplaces.
- Title ≤ 80 chars; each item-specific value ≤ 65 chars.
```

- [ ] **Step 3: Typecheck + eve build**

Run: `pnpm typecheck && npx eve@latest build 2>&1 | tail -20`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add agent/agent.ts agent/instructions.md
git commit -m "feat: agent model (Opus 4.8) + VOICE-derived instructions"
```

---

## Task 7: Export steps + full local verification

**Files:**
- Modify: `lib/index.ts`

- [ ] **Step 1: Extend `lib/index.ts`**

Append:
```ts
export { identifyItem } from './agent/steps/identify';
export { researchPrice } from './agent/steps/price';
export { saveListingDraft } from './agent/steps/saveDraft';
export type { SaveDraftResult } from './agent/steps/saveDraft';
```

- [ ] **Step 2: Whole suite + typecheck + builds**

Run: `pnpm test && pnpm typecheck && pnpm build && npx eve@latest build 2>&1 | tail -20`
Expected: all tests PASS (Plan 1+2's 58 + the 6 new step tests = 64), typecheck clean, `next build` succeeds, `eve build` validates the agent with 4 tools.

- [ ] **Step 3: Commit**

```bash
git add lib/index.ts
git commit -m "feat: export agent step functions"
```

---

## Task 8: Live end-to-end agent session (on Vercel)

The agent calls the model, so the real end-to-end run happens on the deployed app, where Vercel supplies AI-Gateway auth via OIDC. (Local live runs would need model credentials; the deterministic pipeline logic is already proven by the Task 2–4 unit tests.)

- [ ] **Step 1: Merge to main to deploy** — the controller does this after review. Once deployed, the app exposes eve's HTTP session endpoint (path recorded in Task 1).

- [ ] **Step 2: Seed a test item + run a session** (controller, post-deploy):
  1. Insert a test item via the migrate-style connection or a small script: an `items` row with a couple of photo URLs and `seller_notes` like `"Levi's 501 jeans, men's 34x32, dark wash, small knee fade"`.
  2. POST to the eve session endpoint with a message referencing that itemId (exact endpoint + payload per Task 1's findings), using the authenticated Vercel fetch.
  3. Observe the streamed events: the agent should call `identify_item` → `research_price` → `lint_listing` → `save_listing_draft`, then summarize.
  4. Verify a `listings` row (status `draft`, non-null `linter_report`) and a pending `approvals` row now exist for that item, and that the generated title/description pass the slop-linter and read human.

- [ ] **Step 3:** Record the generated listing copy in the PR/notes so its quality can be judged against VOICE.md.

> If the deployed session can't be driven yet (endpoint shape unknown until Task 1, or model auth issues), this task's live check moves into Plan 4, where the dashboard drives sessions directly. The unit-tested pipeline + a validated `eve build` are the gating deliverables for Plan 3; the live model run is verification, not new code.

---

## Self-review results (done while writing this plan)

- **Spec coverage:** Implements the agent capability loop (spec §5 steps 1–5) as eve tools over the Plan 1 adapter/linter and Plan 2 repos; model = Opus 4.8 (§4); instructions derive from VOICE.md (§8); stops at "draft saved + queued" per the semi-autonomous model (§3). Publishing + eve `needsApproval` deferred (correct — approval is the dashboard's job in Plan 4).
- **Placeholder scan:** the only intentionally-empirical parts are Task 1 (run the real `eve init` and record its output) and Task 8 (live run post-deploy) — everything else has complete code. This is deliberate: eve's Next.js mounting is under-documented, so we observe the real scaffold rather than hallucinate it.
- **Type consistency:** step signatures `(db: Db, adapter: EbayAdapter, itemId: string)` are used identically in impl, tests, and tool wrappers; `ListingDraft`/`ItemIdentity`/`PriceEstimate` reused from `lib/types.ts`; tool input schemas match `ListingDraft` field names (`aspects`, not `specifics`, matching the `ListingDraft` type).
- **Known risks flagged inline:** Node 24 requirement (every task), eve import-path-to-`lib/` (Task 5 note), HTTP endpoint shape (Task 1 deliverable), local model auth (Task 8 fallback).

---

## Roadmap (final plan)

- **Plan 4 — Dashboard:** the "eBay-native, elevated" Next.js UI — photo upload → Vercel Blob → create item → start an eve session (streaming progress) → review queue → Listing Review screen (edit copy, see comps + linter panel) → Approve & Publish (calls `adapter.publishListing`, mock today). Built with the frontend-design skill + screenshot-compare loop.
```
