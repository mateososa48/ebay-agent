import type { Db } from '../../db/types';
import type { EbayAdapter } from '../../ebay/types';
import type { ItemIdentity, PriceEstimate } from '../../types';
import { getItem, updateItemStatus } from '../../db/repos/items';
import { replaceCompsForItem, listCompsByItem } from '../../db/repos/comps';
import { recordEvent } from '../../db/repos/events';

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Fetch comps for an identified item, persist them, and compute a price estimate. */
export async function researchPrice(db: Db, adapter: EbayAdapter, itemId: string): Promise<PriceEstimate> {
  const item = await getItem(db, itemId);
  if (!item) throw new Error(`researchPrice: item ${itemId} not found`);
  const identity = item.identity as ItemIdentity | null;
  if (!identity) throw new Error('researchPrice: item has not been identified yet');

  const comps = await adapter.findComps({ identity });
  await replaceCompsForItem(
    db,
    itemId,
    comps.map((c) => ({ source: c.source, title: c.title, price: c.price, sold: c.sold, ref: c.ref, capturedAt: c.capturedAt })),
  );

  const prices = comps.map((c) => c.price).sort((a, b) => a - b);
  const suggested = Math.round(median(prices) * 100) / 100;
  const low = prices[0] ?? suggested;
  const high = prices[prices.length - 1] ?? suggested;

  await updateItemStatus(db, itemId, 'priced');
  await recordEvent(db, { itemId, kind: 'priced', data: { suggested, low, high, comps: comps.length } });

  // Read comps back from the DB so the estimate reflects what was persisted.
  const persisted = await listCompsByItem(db, itemId);
  return {
    suggested,
    low,
    high,
    currency: 'USD',
    rationale: `Based on ${persisted.length} comparable active listings (${low}–${high}).`,
    comps: persisted.map((c) => ({ source: c.source, title: c.title, price: c.price, sold: c.sold, ref: c.ref ?? undefined, capturedAt: c.capturedAt })),
  };
}
