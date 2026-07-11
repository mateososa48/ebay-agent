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
