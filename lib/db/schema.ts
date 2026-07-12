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
  `create table if not exists ebay_connection (
     id integer primary key default 1,
     refresh_token text not null,
     ebay_user text,
     scopes text,
     connected_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     constraint ebay_connection_singleton check (id = 1)
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
