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
  `create table if not exists app_settings (
     key text primary key,
     value text not null,
     updated_at timestamptz not null default now()
   )`,
  `create index if not exists idx_listings_item on listings(item_id)`,
  `create index if not exists idx_comps_item on comps(item_id)`,
  `create index if not exists idx_approvals_state on approvals(state)`,
  `create index if not exists idx_events_item on events(item_id)`,
  `alter table listings add column if not exists condition text`,
  `alter table listings add column if not exists ebay_category_id text`,
  `alter table listings add column if not exists sold_at timestamptz`,
  `alter table listings add column if not exists listed_at timestamptz`,
  `alter table listings add column if not exists sale_price numeric(10,2)`,
  `create index if not exists idx_listings_ebay_id on listings(ebay_listing_id)`,
  `create table if not exists buyer_messages (
     id uuid primary key default gen_random_uuid(),
     ebay_message_id text not null unique,
     listing_id uuid references listings(id) on delete set null,
     sender text,
     subject text,
     question text not null,
     drafted_reply text,
     status text not null default 'drafted'
       check (status in ('drafted','sent','skipped')),
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create table if not exists offers (
     id uuid primary key default gen_random_uuid(),
     listing_id uuid not null references listings(id) on delete cascade,
     discount_pct numeric(5,2) not null,
     offer_price numeric(10,2) not null,
     message text,
     status text not null default 'drafted'
       check (status in ('drafted','sent','skipped')),
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create index if not exists idx_buyer_messages_status on buyer_messages(status)`,
  `create index if not exists idx_offers_listing on offers(listing_id)`,
  `create table if not exists listing_metrics (
     id uuid primary key default gen_random_uuid(),
     listing_id uuid not null references listings(id) on delete cascade,
     watch_count integer,
     hit_count integer,
     quantity_sold integer,
     captured_at timestamptz not null default now()
   )`,
  `create index if not exists idx_listing_metrics_listing on listing_metrics(listing_id, captured_at)`,
];

export async function applySchema(db: Db): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.query(stmt);
  }
}
