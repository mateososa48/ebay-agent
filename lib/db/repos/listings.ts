import type { Db } from '../types';
import type { ItemCondition } from '../../types';

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
  condition: string | null;
  ebayCategoryId: string | null;
  soldAt: string | null;
  salePrice: number | null;
  listedAt: string | null; // when it actually went live on eBay
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
  condition: string | null;
  ebay_category_id: string | null;
  sold_at: string | Date | null;
  sale_price: string | null;
  listed_at: string | Date | null;
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
    condition: r.condition,
    ebayCategoryId: r.ebay_category_id,
    soldAt: r.sold_at === null || r.sold_at === undefined ? null : new Date(r.sold_at).toISOString(),
    listedAt: r.listed_at === null || r.listed_at === undefined ? null : new Date(r.listed_at).toISOString(),
    salePrice: r.sale_price === null || r.sale_price === undefined ? null : Number(r.sale_price),
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

export async function getListingByEbayId(db: Db, ebayListingId: string): Promise<ListingRow | null> {
  const { rows } = await db.query<RawListing>(
    `select * from listings where ebay_listing_id = $1 order by created_at desc, ctid desc limit 1`,
    [ebayListingId],
  );
  const row = rows[0];
  return row ? mapListing(row) : null;
}

/** Mark a listing sold (autonomous sale detection). Idempotent at the caller. */
export async function markSold(
  db: Db,
  id: string,
  input: { salePrice?: number | null; soldAt?: string | null },
): Promise<void> {
  await db.query(
    `update listings
       set status = 'sold',
           sale_price = $2,
           sold_at = coalesce($3::timestamptz, now()),
           updated_at = now()
     where id = $1`,
    [id, input.salePrice ?? null, input.soldAt ?? null],
  );
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
  condition?: ItemCondition;
  ebayCategoryId?: string | null;
  listedAt?: string | null;
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
  if (patch.condition !== undefined) add('condition', patch.condition);
  if (patch.ebayCategoryId !== undefined) add('ebay_category_id', patch.ebayCategoryId);
  if (patch.listedAt !== undefined) add('listed_at', patch.listedAt, '::timestamptz');
  if (sets.length === 0) return;
  sets.push('updated_at = now()');
  await db.query(`update listings set ${sets.join(', ')} where id = $1`, params);
}
