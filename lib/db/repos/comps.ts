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
    // numeric(10,2) -> float is fine for display; use integer cents if money math moves here later
    price: Number(r.price),
    sold: r.sold,
    ref: r.ref,
    capturedAt: new Date(r.captured_at).toISOString(),
  };
}

/** Replaces all comps for an item (comps are re-fetched wholesale per pricing run). */
export async function replaceCompsForItem(db: Db, itemId: string, comps: CompInput[]): Promise<void> {
  // Single data-modifying-CTE statement so the delete + inserts are one query /
  // one transaction on both PGlite and Neon HTTP (no non-atomic multi-round-trip).
  // The `del` CTE runs to completion even though it's unreferenced, and its DELETE
  // only sees rows that pre-existed the statement — so old comps go and new ones land atomically.
  const payload = comps.map((c) => ({
    source: c.source,
    title: c.title,
    price: c.price,
    sold: c.sold,
    ref: c.ref ?? null,
    captured_at: c.capturedAt ?? null,
  }));
  await db.query(
    `with del as (delete from comps where item_id = $1)
     insert into comps (item_id, source, title, price, sold, ref, captured_at)
     select $1, x.source, x.title, x.price, x.sold, x.ref, coalesce(x.captured_at, now())
     from jsonb_to_recordset($2::jsonb)
       as x(source text, title text, price numeric, sold boolean, ref text, captured_at timestamptz)`,
    [itemId, JSON.stringify(payload)],
  );
}

export async function listCompsByItem(db: Db, itemId: string): Promise<CompRow[]> {
  const { rows } = await db.query<RawComp>(
    `select * from comps where item_id = $1 order by price asc`,
    [itemId],
  );
  return rows.map(mapComp);
}
