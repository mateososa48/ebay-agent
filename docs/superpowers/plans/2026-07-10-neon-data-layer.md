# Neon Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Postgres data layer for the eBay selling agent — schema + typed repositories for `items`, `listings`, `comps`, `approvals`, and `events` — against the live Neon database, fully unit-tested.

**Architecture:** Repos are plain functions that take a minimal pg-compatible `Db` interface (`query(text, params) → { rows }`). Production supplies a **Neon** connection pool (`@neondatabase/serverless`); tests supply **PGlite** (real Postgres compiled to WASM, in-process). The schema is a list of idempotent SQL statements applied by `applySchema(db)`, so the exact same DDL runs in tests and against Neon. No ORM — small, transparent, parameterized SQL.

**Tech Stack:** TypeScript (strict), Vitest, `@neondatabase/serverless`, `@electric-sql/pglite` (dev/test). Builds on Plan 1's `lib/` library.

**Scope note:** Plan 2 of 4. `offers`/`messages` tables are Phase 2/3 and out of scope. This plan produces a tested data layer + creates the real schema on Neon; it does not build the eve agent (Plan 3) or dashboard (Plan 4).

---

## File Structure

```
lib/db/
  types.ts            # the Db interface + shared row/DTO types
  schema.ts           # SCHEMA_STATEMENTS + applySchema(db)
  schema.test.ts      # applySchema creates all tables (via PGlite)
  testdb.ts           # makeTestDb() — a PGlite-backed Db for tests
  client.ts           # getDb() — Neon pool-backed Db for production
  repos/
    items.ts          # createItem, getItem, listItems, updateItemStatus, setItemEnrichment
    items.test.ts
    listings.ts       # createListing, getListing, getListingByItem, updateListing, listListings
    listings.test.ts
    comps.ts          # replaceCompsForItem, listCompsByItem
    comps.test.ts
    approvals.ts      # enqueueApproval, getApproval, listPendingApprovals, decideApproval
    approvals.test.ts
    events.ts         # recordEvent, listEventsByItem
    events.test.ts
scripts/
  migrate.ts          # applies the schema to Neon using DATABASE_URL
lib/index.ts          # (extend) re-export getDb + repos
```

The `Db` interface is the only seam; no repo imports `client.ts` or `testdb.ts` directly — they receive a `Db`.

---

## Task 1: DB interface, schema, and the PGlite test harness

**Files:**
- Create: `lib/db/types.ts`, `lib/db/schema.ts`, `lib/db/testdb.ts`, `lib/db/schema.test.ts`

- [ ] **Step 1: Install deps**

Run:
```bash
cd "/Users/mateososaalbrecht/ebay agent"
pnpm add @neondatabase/serverless
pnpm add -D @electric-sql/pglite tsx
```
Expected: all resolve and install. (`tsx` runs the TypeScript migrate script on the installed Node 20.)

- [ ] **Step 2: Write `lib/db/types.ts`**

```ts
/** Minimal pg-compatible database seam. Both the Neon pool and PGlite satisfy it. */
export interface Db {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
```

- [ ] **Step 3: Write `lib/db/schema.ts`**

```ts
import type { Db } from './types';

/**
 * Idempotent DDL, one statement per array entry (so it runs on both the Neon
 * pool and PGlite, neither of which we rely on for multi-statement execution).
 * Enums are modeled as text + CHECK so the statements stay re-runnable.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `create table if not exists items (
     id uuid primary key default gen_random_uuid(),
     photos text[] not null default '{}',
     seller_notes text,
     identity jsonb,
     condition jsonb,
     measurements jsonb,
     status text not null default 'draft'
       check (status in ('draft','identifying','priced','listed','archived')),
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create table if not exists listings (
     id uuid primary key default gen_random_uuid(),
     item_id uuid not null references items(id) on delete cascade,
     title text not null,
     specifics jsonb not null default '{}',
     description text not null default '',
     price numeric(10,2),
     price_range jsonb,
     ebay_listing_id text,
     status text not null default 'draft'
       check (status in ('draft','live','sold','ended')),
     linter_report jsonb,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create table if not exists comps (
     id uuid primary key default gen_random_uuid(),
     item_id uuid not null references items(id) on delete cascade,
     source text not null,
     title text not null,
     price numeric(10,2) not null,
     sold boolean not null default false,
     ref text,
     captured_at timestamptz not null default now()
   )`,
  `create table if not exists approvals (
     id uuid primary key default gen_random_uuid(),
     type text not null check (type in ('listing','offer','message')),
     ref_id uuid not null,
     state text not null default 'pending'
       check (state in ('pending','approved','rejected')),
     created_at timestamptz not null default now(),
     decided_at timestamptz
   )`,
  `create table if not exists events (
     id uuid primary key default gen_random_uuid(),
     item_id uuid references items(id) on delete set null,
     kind text not null,
     data jsonb,
     created_at timestamptz not null default now()
   )`,
  `create index if not exists idx_listings_item on listings(item_id)`,
  `create index if not exists idx_comps_item on comps(item_id)`,
  `create index if not exists idx_approvals_state on approvals(state)`,
  `create index if not exists idx_events_item on events(item_id)`,
];

export async function applySchema(db: Db): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.query(stmt);
  }
}
```

- [ ] **Step 4: Write `lib/db/testdb.ts`**

```ts
import { PGlite } from '@electric-sql/pglite';
import type { Db } from './types';
import { applySchema } from './schema';

export interface TestDb extends Db {
  close(): Promise<void>;
}

/** A fresh in-process Postgres (PGlite) with the schema applied. Isolated per call. */
export async function makeTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  const query: Db['query'] = (text, params) =>
    pg.query(text, (params ?? []) as unknown[]) as Promise<{ rows: never[] }>;
  await applySchema({ query });
  return { query, close: () => pg.close() };
}
```

- [ ] **Step 5: Write the failing test `lib/db/schema.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from './testdb';

describe('applySchema', () => {
  let db: TestDb | undefined;
  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it('creates all five tables', async () => {
    db = await makeTestDb();
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(['approvals', 'comps', 'events', 'items', 'listings']);
  });

  it('is idempotent (safe to apply twice)', async () => {
    db = await makeTestDb();
    // makeTestDb already applied once; applying again must not throw.
    const { applySchema } = await import('./schema');
    await expect(applySchema(db)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 6: Run test to verify it fails, then passes**

Run: `pnpm vitest run lib/db/schema.test.ts`
Expected: FAIL first if any file is missing; once Steps 2–4 are in place, PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/db/types.ts lib/db/schema.ts lib/db/testdb.ts lib/db/schema.test.ts package.json pnpm-lock.yaml
git commit -m "feat: db seam, schema, and PGlite test harness"
```

---

## Task 2: items repository

**Files:**
- Create: `lib/db/repos/items.ts`, `lib/db/repos/items.test.ts`

- [ ] **Step 1: Write the failing test `lib/db/repos/items.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { createItem, getItem, listItems, updateItemStatus, setItemEnrichment } from './items';

describe('items repo', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('creates and reads an item', async () => {
    db = await makeTestDb();
    const created = await createItem(db, { photos: ['blob://a.jpg', 'blob://b.jpg'], sellerNotes: "Levi's 501" });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.photos).toEqual(['blob://a.jpg', 'blob://b.jpg']);
    expect(created.sellerNotes).toBe("Levi's 501");
    expect(created.status).toBe('draft');

    const fetched = await getItem(db, created.id);
    expect(fetched?.id).toBe(created.id);
  });

  it('returns null for a missing item', async () => {
    db = await makeTestDb();
    expect(await getItem(db, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('lists items newest-first', async () => {
    db = await makeTestDb();
    const a = await createItem(db, { photos: [] });
    const b = await createItem(db, { photos: [] });
    const all = await listItems(db);
    expect(all.map((i) => i.id).slice(0, 2)).toEqual([b.id, a.id]);
  });

  it('updates status', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await updateItemStatus(db, item.id, 'priced');
    expect((await getItem(db, item.id))?.status).toBe('priced');
  });

  it('stores enrichment (identity/condition/measurements) as jsonb round-trips', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await setItemEnrichment(db, item.id, {
      identity: { brand: "Levi's", productType: 'Jeans', aspects: { Size: '34x32' }, confidence: 0.9, ambiguities: [] },
      condition: { grade: 'used_good', flaws: ['knee fade'] },
      measurements: { waistIn: 34 },
    });
    const got = await getItem(db, item.id);
    expect((got?.identity as { brand: string }).brand).toBe("Levi's");
    expect((got?.condition as { flaws: string[] }).flaws).toEqual(['knee fade']);
    expect((got?.measurements as { waistIn: number }).waistIn).toBe(34);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/db/repos/items.test.ts`
Expected: FAIL — cannot find `./items`.

- [ ] **Step 3: Implement `lib/db/repos/items.ts`**

```ts
import type { Db } from '../types';

export interface ItemRow {
  id: string;
  photos: string[];
  sellerNotes: string | null;
  identity: unknown;
  condition: unknown;
  measurements: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface RawItem {
  id: string;
  photos: string[] | null;
  seller_notes: string | null;
  identity: unknown;
  condition: unknown;
  measurements: unknown;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
}

function mapItem(r: RawItem): ItemRow {
  return {
    id: r.id,
    photos: r.photos ?? [],
    sellerNotes: r.seller_notes,
    identity: r.identity,
    condition: r.condition,
    measurements: r.measurements,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function createItem(
  db: Db,
  input: { photos: string[]; sellerNotes?: string },
): Promise<ItemRow> {
  const { rows } = await db.query<RawItem>(
    `insert into items (photos, seller_notes) values ($1, $2) returning *`,
    [input.photos, input.sellerNotes ?? null],
  );
  const row = rows[0];
  if (!row) throw new Error('createItem: insert returned no row');
  return mapItem(row);
}

export async function getItem(db: Db, id: string): Promise<ItemRow | null> {
  const { rows } = await db.query<RawItem>(`select * from items where id = $1`, [id]);
  const row = rows[0];
  return row ? mapItem(row) : null;
}

export async function listItems(db: Db): Promise<ItemRow[]> {
  const { rows } = await db.query<RawItem>(`select * from items order by created_at desc`);
  return rows.map(mapItem);
}

export async function updateItemStatus(db: Db, id: string, status: string): Promise<void> {
  await db.query(`update items set status = $2, updated_at = now() where id = $1`, [id, status]);
}

export async function setItemEnrichment(
  db: Db,
  id: string,
  data: { identity?: unknown; condition?: unknown; measurements?: unknown },
): Promise<void> {
  await db.query(
    `update items
       set identity = $2::jsonb,
           condition = $3::jsonb,
           measurements = $4::jsonb,
           updated_at = now()
     where id = $1`,
    [
      id,
      JSON.stringify(data.identity ?? null),
      JSON.stringify(data.condition ?? null),
      JSON.stringify(data.measurements ?? null),
    ],
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/db/repos/items.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/repos/items.ts lib/db/repos/items.test.ts
git commit -m "feat: items repository"
```

---

## Task 3: listings repository

**Files:**
- Create: `lib/db/repos/listings.ts`, `lib/db/repos/listings.test.ts`

- [ ] **Step 1: Write the failing test `lib/db/repos/listings.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { createItem } from './items';
import { createListing, getListing, getListingByItem, updateListing, listListings } from './listings';

describe('listings repo', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('creates a draft listing and reads it back with correct types', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    const draft = await createListing(db, {
      itemId: item.id,
      title: "Levi's 501 34x32",
      specifics: { Brand: "Levi's", Size: '34x32' },
      description: 'Clean pair.',
      price: 48.5,
    });
    expect(draft.status).toBe('draft');
    expect(draft.price).toBe(48.5);              // numeric mapped to number, not string
    expect(draft.specifics).toEqual({ Brand: "Levi's", Size: '34x32' });

    const byId = await getListing(db, draft.id);
    expect(byId?.id).toBe(draft.id);
    const byItem = await getListingByItem(db, item.id);
    expect(byItem?.id).toBe(draft.id);
  });

  it('updates editable fields and status', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    const draft = await createListing(db, { itemId: item.id, title: 't', specifics: {}, description: '', price: 10 });
    await updateListing(db, draft.id, {
      title: 'better title',
      price: 55,
      status: 'live',
      ebayListingId: 'MOCK-1',
      linterReport: { ok: true, blocking: [], warnings: [] },
    });
    const updated = await getListing(db, draft.id);
    expect(updated?.title).toBe('better title');
    expect(updated?.price).toBe(55);
    expect(updated?.status).toBe('live');
    expect(updated?.ebayListingId).toBe('MOCK-1');
    expect((updated?.linterReport as { ok: boolean }).ok).toBe(true);
  });

  it('lists listings newest-first', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    const a = await createListing(db, { itemId: item.id, title: 'a', specifics: {}, description: '', price: 1 });
    const b = await createListing(db, { itemId: item.id, title: 'b', specifics: {}, description: '', price: 2 });
    const all = await listListings(db);
    expect(all.map((l) => l.id).slice(0, 2)).toEqual([b.id, a.id]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/db/repos/listings.test.ts`
Expected: FAIL — cannot find `./listings`.

- [ ] **Step 3: Implement `lib/db/repos/listings.ts`**

```ts
import type { Db } from '../types';

export interface ListingRow {
  id: string;
  itemId: string;
  title: string;
  specifics: Record<string, string>;
  description: string;
  price: number | null;
  priceRange: unknown;
  ebayListingId: string | null;
  status: string;
  linterReport: unknown;
  createdAt: string;
  updatedAt: string;
}

interface RawListing {
  id: string;
  item_id: string;
  title: string;
  specifics: Record<string, string> | null;
  description: string;
  price: string | null;
  price_range: unknown;
  ebay_listing_id: string | null;
  status: string;
  linter_report: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

function mapListing(r: RawListing): ListingRow {
  return {
    id: r.id,
    itemId: r.item_id,
    title: r.title,
    specifics: r.specifics ?? {},
    description: r.description,
    price: r.price === null ? null : Number(r.price),
    priceRange: r.price_range,
    ebayListingId: r.ebay_listing_id,
    status: r.status,
    linterReport: r.linter_report,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function createListing(
  db: Db,
  input: {
    itemId: string;
    title: string;
    specifics: Record<string, string>;
    description: string;
    price: number | null;
    priceRange?: unknown;
  },
): Promise<ListingRow> {
  const { rows } = await db.query<RawListing>(
    `insert into listings (item_id, title, specifics, description, price, price_range)
     values ($1, $2, $3::jsonb, $4, $5, $6::jsonb)
     returning *`,
    [
      input.itemId,
      input.title,
      JSON.stringify(input.specifics),
      input.description,
      input.price,
      JSON.stringify(input.priceRange ?? null),
    ],
  );
  const row = rows[0];
  if (!row) throw new Error('createListing: insert returned no row');
  return mapListing(row);
}

export async function getListing(db: Db, id: string): Promise<ListingRow | null> {
  const { rows } = await db.query<RawListing>(`select * from listings where id = $1`, [id]);
  const row = rows[0];
  return row ? mapListing(row) : null;
}

export async function getListingByItem(db: Db, itemId: string): Promise<ListingRow | null> {
  const { rows } = await db.query<RawListing>(
    `select * from listings where item_id = $1 order by created_at desc limit 1`,
    [itemId],
  );
  const row = rows[0];
  return row ? mapListing(row) : null;
}

export async function listListings(db: Db): Promise<ListingRow[]> {
  const { rows } = await db.query<RawListing>(`select * from listings order by created_at desc`);
  return rows.map(mapListing);
}

export interface ListingUpdate {
  title?: string;
  specifics?: Record<string, string>;
  description?: string;
  price?: number | null;
  priceRange?: unknown;
  status?: string;
  ebayListingId?: string | null;
  linterReport?: unknown;
}

export async function updateListing(db: Db, id: string, patch: ListingUpdate): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  const add = (col: string, value: unknown, cast = '') => {
    params.push(value);
    sets.push(`${col} = $${params.length}${cast}`);
  };
  if (patch.title !== undefined) add('title', patch.title);
  if (patch.specifics !== undefined) add('specifics', JSON.stringify(patch.specifics), '::jsonb');
  if (patch.description !== undefined) add('description', patch.description);
  if (patch.price !== undefined) add('price', patch.price);
  if (patch.priceRange !== undefined) add('price_range', JSON.stringify(patch.priceRange), '::jsonb');
  if (patch.status !== undefined) add('status', patch.status);
  if (patch.ebayListingId !== undefined) add('ebay_listing_id', patch.ebayListingId);
  if (patch.linterReport !== undefined) add('linter_report', JSON.stringify(patch.linterReport), '::jsonb');
  if (sets.length === 0) return;
  sets.push('updated_at = now()');
  await db.query(`update listings set ${sets.join(', ')} where id = $1`, params);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/db/repos/listings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/repos/listings.ts lib/db/repos/listings.test.ts
git commit -m "feat: listings repository"
```

---

## Task 4: comps repository

**Files:**
- Create: `lib/db/repos/comps.ts`, `lib/db/repos/comps.test.ts`

- [ ] **Step 1: Write the failing test `lib/db/repos/comps.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { createItem } from './items';
import { replaceCompsForItem, listCompsByItem } from './comps';

describe('comps repo', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('replaces comps for an item and reads them back with numeric prices', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await replaceCompsForItem(db, item.id, [
      { source: 'ebay-active', title: 'comp 1', price: 40, sold: false, ref: 'r1', capturedAt: '2026-07-10T00:00:00.000Z' },
      { source: 'ebay-active', title: 'comp 2', price: 45.25, sold: true },
    ]);
    const comps = await listCompsByItem(db, item.id);
    expect(comps).toHaveLength(2);
    expect(comps[0]?.price).toBe(40);
    expect(comps.find((c) => c.title === 'comp 2')?.price).toBe(45.25);
    expect(comps.find((c) => c.title === 'comp 2')?.sold).toBe(true);
  });

  it('replacing clears the previous comps', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await replaceCompsForItem(db, item.id, [{ source: 's', title: 'old', price: 1, sold: false }]);
    await replaceCompsForItem(db, item.id, [{ source: 's', title: 'new', price: 2, sold: false }]);
    const comps = await listCompsByItem(db, item.id);
    expect(comps.map((c) => c.title)).toEqual(['new']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/db/repos/comps.test.ts`
Expected: FAIL — cannot find `./comps`.

- [ ] **Step 3: Implement `lib/db/repos/comps.ts`**

```ts
import type { Db } from '../types';

export interface CompInput {
  source: string;
  title: string;
  price: number;
  sold: boolean;
  ref?: string;
  capturedAt?: string;
}

export interface CompRow {
  id: string;
  itemId: string;
  source: string;
  title: string;
  price: number;
  sold: boolean;
  ref: string | null;
  capturedAt: string;
}

interface RawComp {
  id: string;
  item_id: string;
  source: string;
  title: string;
  price: string;
  sold: boolean;
  ref: string | null;
  captured_at: string | Date;
}

function mapComp(r: RawComp): CompRow {
  return {
    id: r.id,
    itemId: r.item_id,
    source: r.source,
    title: r.title,
    price: Number(r.price),
    sold: r.sold,
    ref: r.ref,
    capturedAt: new Date(r.captured_at).toISOString(),
  };
}

/** Replaces all comps for an item (comps are re-fetched wholesale per pricing run). */
export async function replaceCompsForItem(db: Db, itemId: string, comps: CompInput[]): Promise<void> {
  await db.query(`delete from comps where item_id = $1`, [itemId]);
  for (const c of comps) {
    await db.query(
      `insert into comps (item_id, source, title, price, sold, ref, captured_at)
       values ($1, $2, $3, $4, $5, $6, coalesce($7::timestamptz, now()))`,
      [itemId, c.source, c.title, c.price, c.sold, c.ref ?? null, c.capturedAt ?? null],
    );
  }
}

export async function listCompsByItem(db: Db, itemId: string): Promise<CompRow[]> {
  const { rows } = await db.query<RawComp>(
    `select * from comps where item_id = $1 order by price asc`,
    [itemId],
  );
  return rows.map(mapComp);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/db/repos/comps.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/repos/comps.ts lib/db/repos/comps.test.ts
git commit -m "feat: comps repository"
```

---

## Task 5: approvals repository (the review queue)

**Files:**
- Create: `lib/db/repos/approvals.ts`, `lib/db/repos/approvals.test.ts`

- [ ] **Step 1: Write the failing test `lib/db/repos/approvals.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { enqueueApproval, getApproval, listPendingApprovals, decideApproval } from './approvals';

const REF = '11111111-1111-1111-1111-111111111111';

describe('approvals repo', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('enqueues a pending approval', async () => {
    db = await makeTestDb();
    const a = await enqueueApproval(db, { type: 'listing', refId: REF });
    expect(a.state).toBe('pending');
    expect(a.type).toBe('listing');
    expect(a.refId).toBe(REF);
    expect(a.decidedAt).toBeNull();
  });

  it('lists only pending approvals, oldest-first', async () => {
    db = await makeTestDb();
    const first = await enqueueApproval(db, { type: 'listing', refId: REF });
    await enqueueApproval(db, { type: 'listing', refId: REF });
    await decideApproval(db, first.id, 'approved');
    const pending = await listPendingApprovals(db);
    expect(pending).toHaveLength(1);
    expect(pending.every((p) => p.state === 'pending')).toBe(true);
  });

  it('records a decision with a timestamp', async () => {
    db = await makeTestDb();
    const a = await enqueueApproval(db, { type: 'listing', refId: REF });
    await decideApproval(db, a.id, 'rejected');
    const after = await getApproval(db, a.id);
    expect(after?.state).toBe('rejected');
    expect(after?.decidedAt).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/db/repos/approvals.test.ts`
Expected: FAIL — cannot find `./approvals`.

- [ ] **Step 3: Implement `lib/db/repos/approvals.ts`**

```ts
import type { Db } from '../types';

export type ApprovalType = 'listing' | 'offer' | 'message';
export type ApprovalState = 'pending' | 'approved' | 'rejected';

export interface ApprovalRow {
  id: string;
  type: ApprovalType;
  refId: string;
  state: ApprovalState;
  createdAt: string;
  decidedAt: string | null;
}

interface RawApproval {
  id: string;
  type: ApprovalType;
  ref_id: string;
  state: ApprovalState;
  created_at: string | Date;
  decided_at: string | Date | null;
}

function mapApproval(r: RawApproval): ApprovalRow {
  return {
    id: r.id,
    type: r.type,
    refId: r.ref_id,
    state: r.state,
    createdAt: new Date(r.created_at).toISOString(),
    decidedAt: r.decided_at === null ? null : new Date(r.decided_at).toISOString(),
  };
}

export async function enqueueApproval(
  db: Db,
  input: { type: ApprovalType; refId: string },
): Promise<ApprovalRow> {
  const { rows } = await db.query<RawApproval>(
    `insert into approvals (type, ref_id) values ($1, $2) returning *`,
    [input.type, input.refId],
  );
  const row = rows[0];
  if (!row) throw new Error('enqueueApproval: insert returned no row');
  return mapApproval(row);
}

export async function getApproval(db: Db, id: string): Promise<ApprovalRow | null> {
  const { rows } = await db.query<RawApproval>(`select * from approvals where id = $1`, [id]);
  const row = rows[0];
  return row ? mapApproval(row) : null;
}

export async function listPendingApprovals(db: Db): Promise<ApprovalRow[]> {
  const { rows } = await db.query<RawApproval>(
    `select * from approvals where state = 'pending' order by created_at asc`,
  );
  return rows.map(mapApproval);
}

export async function decideApproval(
  db: Db,
  id: string,
  decision: 'approved' | 'rejected',
): Promise<void> {
  await db.query(
    `update approvals set state = $2, decided_at = now() where id = $1`,
    [id, decision],
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/db/repos/approvals.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/db/repos/approvals.ts lib/db/repos/approvals.test.ts
git commit -m "feat: approvals repository (review queue)"
```

---

## Task 6: events repository (audit log)

**Files:**
- Create: `lib/db/repos/events.ts`, `lib/db/repos/events.test.ts`

- [ ] **Step 1: Write the failing test `lib/db/repos/events.test.ts`**

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { makeTestDb, type TestDb } from '../testdb';
import { createItem } from './items';
import { recordEvent, listEventsByItem } from './events';

describe('events repo', () => {
  let db: TestDb;
  afterEach(async () => { await db.close(); });

  it('records events and lists them newest-first for an item', async () => {
    db = await makeTestDb();
    const item = await createItem(db, { photos: [] });
    await recordEvent(db, { itemId: item.id, kind: 'identified', data: { confidence: 0.9 } });
    await recordEvent(db, { itemId: item.id, kind: 'priced', data: { suggested: 48 } });
    const events = await listEventsByItem(db, item.id);
    expect(events.map((e) => e.kind)).toEqual(['priced', 'identified']);
    expect((events[0]?.data as { suggested: number }).suggested).toBe(48);
  });

  it('allows an event with no item and null data', async () => {
    db = await makeTestDb();
    const e = await recordEvent(db, { kind: 'system_start' });
    expect(e.kind).toBe('system_start');
    expect(e.itemId).toBeNull();
    expect(e.data).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/db/repos/events.test.ts`
Expected: FAIL — cannot find `./events`.

- [ ] **Step 3: Implement `lib/db/repos/events.ts`**

```ts
import type { Db } from '../types';

export interface EventRow {
  id: string;
  itemId: string | null;
  kind: string;
  data: unknown;
  createdAt: string;
}

interface RawEvent {
  id: string;
  item_id: string | null;
  kind: string;
  data: unknown;
  created_at: string | Date;
}

function mapEvent(r: RawEvent): EventRow {
  return {
    id: r.id,
    itemId: r.item_id,
    kind: r.kind,
    data: r.data,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function recordEvent(
  db: Db,
  input: { itemId?: string; kind: string; data?: unknown },
): Promise<EventRow> {
  const { rows } = await db.query<RawEvent>(
    `insert into events (item_id, kind, data) values ($1, $2, $3::jsonb) returning *`,
    [input.itemId ?? null, input.kind, JSON.stringify(input.data ?? null)],
  );
  const row = rows[0];
  if (!row) throw new Error('recordEvent: insert returned no row');
  return mapEvent(row);
}

export async function listEventsByItem(db: Db, itemId: string): Promise<EventRow[]> {
  const { rows } = await db.query<RawEvent>(
    `select * from events where item_id = $1 order by created_at desc`,
    [itemId],
  );
  return rows.map(mapEvent);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/db/repos/events.test.ts`
Expected: PASS (2 tests).

Note on ordering: the two events in test 1 are inserted sequentially; `created_at` uses `now()` which, inside one transaction/statement clock, can tie. If the newest-first assertion is ever flaky, it means both rows share a timestamp — add a tiebreaker `order by created_at desc, ctid desc`. Only apply this if a tie actually occurs; PGlite advances the clock between separate `query` calls, so the plain ordering is expected to pass.

- [ ] **Step 5: Commit**

```bash
git add lib/db/repos/events.ts lib/db/repos/events.test.ts
git commit -m "feat: events repository (audit log)"
```

---

## Task 7: Production Neon client, migrate script, health wiring, exports

**Files:**
- Create: `lib/db/client.ts`, `scripts/migrate.ts`
- Modify: `app/api/health/route.ts`, `lib/index.ts`, `package.json`

- [ ] **Step 1: Implement `lib/db/client.ts`**

```ts
import { neon } from '@neondatabase/serverless';
import type { Db } from './types';

/**
 * Production Db backed by Neon's HTTP driver (`neon()`), not the WebSocket
 * `Pool` — HTTP needs no WebSocket global (works on Node 20) and is the
 * preferred path for serverless single-shot queries. Reads DATABASE_URL lazily.
 */
export function getDb(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const sql = neon(connectionString);
  return {
    query: (text, params) =>
      sql.query(text, params ?? []).then((rows) => ({ rows })) as Promise<{ rows: never[] }>,
  };
}
```

- [ ] **Step 2: Write `scripts/migrate.ts`**

```ts
import { getDb } from '../lib/db/client';
import { applySchema } from '../lib/db/schema';

async function main() {
  const db = getDb();
  await applySchema(db);
  const { rows } = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  );
  console.log('Schema applied. Tables:', rows.map((r) => r.table_name).join(', '));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
```

- [ ] **Step 3: Add the `db:migrate` script to `package.json`**

Add to `"scripts"` (env is passed explicitly from `.env.local`, which the Vercel CLI created with `DATABASE_URL`):
```json
"db:migrate": "node --env-file=.env.local --import tsx scripts/migrate.ts"
```
Note: Node 20.6+ supports `--env-file` (loads `.env.local`) and `--import` (registers `tsx`'s loader so the `.ts` script runs directly). Both work on the installed Node 20. If `--import tsx` errors on this exact Node build, fall back to `pnpm exec dotenv -e .env.local -- tsx scripts/migrate.ts` or simply `DATABASE_URL="$(grep -m1 '^DATABASE_URL=' .env.local | cut -d= -f2-)" pnpm exec tsx scripts/migrate.ts`.

- [ ] **Step 4: Run the migration against the real Neon database**

Run: `pnpm db:migrate`
Expected: prints `Schema applied. Tables: approvals, comps, events, items, listings`.
This creates the real schema on Neon. If it fails on connection, confirm `.env.local` contains `DATABASE_URL` (`grep -o 'DATABASE_URL=' .env.local`).

- [ ] **Step 5: Wire `app/api/health/route.ts` to actually ping Neon**

Replace the file contents with:
```ts
import { getDb } from '../../../lib/db/client';

export const dynamic = 'force-dynamic';

// Reports deployment + real Neon connectivity.
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: true, db: 'not_configured' });
  }
  try {
    const db = getDb();
    const { rows } = await db.query<{ ok: number }>('select 1 as ok');
    return Response.json({ ok: true, db: 'connected', result: rows[0]?.ok ?? null });
  } catch (e) {
    return Response.json({ ok: false, db: 'error', error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 6: Extend `lib/index.ts` with the data layer exports**

Append:
```ts
export { getDb } from './db/client';
export type { Db } from './db/types';
export { applySchema, SCHEMA_STATEMENTS } from './db/schema';
export * as items from './db/repos/items';
export * as listings from './db/repos/listings';
export * as comps from './db/repos/comps';
export * as approvals from './db/repos/approvals';
export * as events from './db/repos/events';
```

- [ ] **Step 7: Full suite + typecheck + build**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all tests PASS (Plan 1's 38 + the new db tests), typecheck clean, Next build succeeds.
Note: `lib/db/client.ts` and `scripts/migrate.ts` import `@neondatabase/serverless`; that's fine for `next build` (server-only). `testdb.ts` imports PGlite but is only referenced by `*.test.ts`, which `next build` and `tsc` (via include) will type-check but not bundle into the app.

- [ ] **Step 8: Commit, push (triggers auto-deploy), and verify live**

```bash
git add lib/db/client.ts scripts/migrate.ts app/api/health/route.ts lib/index.ts package.json
git commit -m "feat: Neon production client, migrate script, live health check"
git push origin main
```
After the auto-deploy finishes, `GET https://ebay-agent-omega.vercel.app/api/health` should return `{"ok":true,"db":"connected","result":1}`.

---

## Self-review results (done while writing this plan)

- **Spec coverage:** Implements the full data model from spec §6 (`items`, `listings`, `comps`, `approvals`, `events`) with Neon (§4) and the migrate/health wiring for the live deploy. `offers`/`messages` correctly deferred to Phases 2/3.
- **Placeholder scan:** none — every step has complete code or an exact command.
- **Type consistency:** the `Db` interface is used identically across `schema.ts`, `testdb.ts`, `client.ts`, and every repo; repo function names (`createItem`, `createListing`, `replaceCompsForItem`, `enqueueApproval`, `recordEvent`, …) are consistent between implementation, tests, and `lib/index.ts` exports; jsonb params are `JSON.stringify`-d with `::jsonb` casts everywhere; numeric columns are mapped with `Number()`.
- **Risk noted:** `events` newest-first ordering could tie on identical `now()` timestamps — flagged inline with the fix to apply only if it actually flakes.

---

## Roadmap (subsequent plans)

- **Plan 3 — eve agent wiring:** `agent/` dir; `instructions.md` from `VOICE.md`; tools that call this data layer + the Plan 1 adapter/linter; end-to-end mock session over the eve HTTP API.
- **Plan 4 — Dashboard:** Next.js "eBay-native, elevated" UI reading/writing these repos and driving the agent; frontend-design skill + screenshot loop.
```
