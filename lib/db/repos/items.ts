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
  // ctid: best-effort tiebreaker for sub-ms insert ties; not a strong guarantee on updatable tables.
  const { rows } = await db.query<RawItem>(
    `select * from items order by created_at desc, ctid desc`,
  );
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
  // COALESCE keeps the existing column value when a field is omitted (SQL NULL),
  // so a partial enrichment never clobbers previously-set fields.
  const p = (v: unknown) => (v === undefined ? null : JSON.stringify(v));
  await db.query(
    `update items
       set identity = coalesce($2::jsonb, identity),
           condition = coalesce($3::jsonb, condition),
           measurements = coalesce($4::jsonb, measurements),
           updated_at = now()
     where id = $1`,
    [id, p(data.identity), p(data.condition), p(data.measurements)],
  );
}
