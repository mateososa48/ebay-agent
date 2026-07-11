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
  // Tiebreak on ctid: sequential inserts in tests (and possibly bursts of
  // agent events in production) can land on the same now() millisecond, so
  // created_at alone can leave the order among ties undefined.
  const { rows } = await db.query<RawEvent>(
    `select * from events where item_id = $1 order by created_at desc, ctid desc`,
    [itemId],
  );
  return rows.map(mapEvent);
}
