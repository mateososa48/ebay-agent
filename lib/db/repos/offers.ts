import type { Db } from '../types';

export type OfferStatus = 'drafted' | 'sent' | 'skipped';

export interface OfferRow {
  id: string;
  listingId: string;
  discountPct: number;
  offerPrice: number;
  message: string | null;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
}

interface RawOffer {
  id: string;
  listing_id: string;
  discount_pct: string;
  offer_price: string;
  message: string | null;
  status: OfferStatus;
  created_at: string | Date;
  updated_at: string | Date;
}

function mapRow(r: RawOffer): OfferRow {
  return {
    id: r.id,
    listingId: r.listing_id,
    discountPct: Number(r.discount_pct),
    offerPrice: Number(r.offer_price),
    message: r.message,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function insertOffer(
  db: Db,
  input: { listingId: string; discountPct: number; offerPrice: number; message?: string | null },
): Promise<OfferRow> {
  const { rows } = await db.query<RawOffer>(
    `insert into offers (listing_id, discount_pct, offer_price, message)
     values ($1, $2, $3, $4) returning *`,
    [input.listingId, input.discountPct, input.offerPrice, input.message ?? null],
  );
  const row = rows[0];
  if (!row) throw new Error('insertOffer: insert returned no row');
  return mapRow(row);
}

export async function getOffer(db: Db, id: string): Promise<OfferRow | null> {
  const { rows } = await db.query<RawOffer>(`select * from offers where id = $1`, [id]);
  const row = rows[0];
  return row ? mapRow(row) : null;
}

/** Any drafted-or-sent offer for this listing — used so we only ever propose one offer per listing. */
export async function getActiveOfferForListing(db: Db, listingId: string): Promise<OfferRow | null> {
  const { rows } = await db.query<RawOffer>(
    `select * from offers where listing_id = $1 and status in ('drafted','sent')
     order by created_at desc, ctid desc limit 1`,
    [listingId],
  );
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function updateOffer(
  db: Db,
  id: string,
  patch: { status?: OfferStatus; offerPrice?: number; message?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  if (patch.status !== undefined) {
    params.push(patch.status);
    sets.push(`status = $${params.length}`);
  }
  if (patch.offerPrice !== undefined) {
    params.push(patch.offerPrice);
    sets.push(`offer_price = $${params.length}`);
  }
  if (patch.message !== undefined) {
    params.push(patch.message);
    sets.push(`message = $${params.length}`);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = now()');
  await db.query(`update offers set ${sets.join(', ')} where id = $1`, params);
}

/** Drafted offers still awaiting a decision, newest first. */
export async function listDraftedOffers(db: Db): Promise<OfferRow[]> {
  const { rows } = await db.query<RawOffer>(
    `select * from offers where status = 'drafted' order by created_at desc, ctid desc`,
  );
  return rows.map(mapRow);
}
