import type { Db } from '../../db/types';
import type { EbayAdapter } from '../../ebay/types';
import { insertMetric } from '../../db/repos/listing-metrics';

export interface PollMetricsResult {
  live: number; // live listings tracked
  snapped: number; // snapshots recorded this run
}

/**
 * Autonomous, read-only engagement snapshots: for each live listing, record
 * watchers/views/sold from eBay so the dashboard can chart them over time.
 * Bounded per run — with a ~15-min cadence the full set still refreshes fast.
 */
export async function pollMetrics(db: Db, ebay: EbayAdapter, maxCalls = 20): Promise<PollMetricsResult> {
  const { rows } = await db.query<{ id: string; ebay_listing_id: string }>(
    `select id, ebay_listing_id from listings
     where status = 'live' and ebay_listing_id is not null
     order by updated_at asc limit $1`,
    [maxCalls],
  );
  let snapped = 0;
  for (const row of rows) {
    try {
      const stats = await ebay.getListingStats(row.ebay_listing_id);
      if (!stats) continue;
      await insertMetric(db, {
        listingId: row.id,
        watchCount: stats.watchCount,
        hitCount: stats.hitCount,
        quantitySold: stats.quantitySold,
      });
      snapped += 1;
    } catch {
      /* one bad listing never blocks the rest */
    }
  }
  return { live: rows.length, snapped };
}
