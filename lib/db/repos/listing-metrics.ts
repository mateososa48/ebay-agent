import type { Db } from '../types';

export interface MetricPoint {
  watchCount: number | null;
  hitCount: number | null;
  quantitySold: number | null;
  capturedAt: string;
}

interface RawMetric {
  watch_count: number | null;
  hit_count: number | null;
  quantity_sold: number | null;
  captured_at: string | Date;
}

function mapRow(r: RawMetric): MetricPoint {
  return {
    watchCount: r.watch_count,
    hitCount: r.hit_count,
    quantitySold: r.quantity_sold,
    capturedAt: new Date(r.captured_at).toISOString(),
  };
}

export async function insertMetric(
  db: Db,
  input: { listingId: string; watchCount: number | null; hitCount: number | null; quantitySold: number | null },
): Promise<void> {
  await db.query(
    `insert into listing_metrics (listing_id, watch_count, hit_count, quantity_sold) values ($1, $2, $3, $4)`,
    [input.listingId, input.watchCount, input.hitCount, input.quantitySold],
  );
}

/** Snapshot series for one listing, oldest first (for charts). */
export async function getMetricSeries(db: Db, listingId: string, limit = 200): Promise<MetricPoint[]> {
  const { rows } = await db.query<RawMetric>(
    `select watch_count, hit_count, quantity_sold, captured_at
     from listing_metrics where listing_id = $1
     order by captured_at desc limit $2`,
    [listingId, limit],
  );
  return rows.map(mapRow).reverse();
}

/** Most recent snapshot per listing — for tables/overviews. Keyed by listing id. */
export async function getLatestMetrics(db: Db): Promise<Map<string, MetricPoint>> {
  const { rows } = await db.query<RawMetric & { listing_id: string }>(
    `select distinct on (listing_id) listing_id, watch_count, hit_count, quantity_sold, captured_at
     from listing_metrics order by listing_id, captured_at desc`,
  );
  return new Map(rows.map((r) => [r.listing_id, mapRow(r)]));
}
