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
    // numeric(10,2) -> float is fine for display; use integer cents if money math moves here later
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
  // ctid: best-effort tiebreaker for sub-ms insert ties; not a strong guarantee on updatable tables.
  const { rows } = await db.query<RawListing>(
    `select * from listings where item_id = $1 order by created_at desc, ctid desc limit 1`,
    [itemId],
  );
  const row = rows[0];
  return row ? mapListing(row) : null;
}

export async function listListings(db: Db): Promise<ListingRow[]> {
  // ctid: best-effort tiebreaker for sub-ms insert ties; not a strong guarantee on updatable tables.
  const { rows } = await db.query<RawListing>(
    `select * from listings order by created_at desc, ctid desc`,
  );
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
