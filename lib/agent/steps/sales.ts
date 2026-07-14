import type { Db } from '../../db/types';
import type { EbayAdapter } from '../../ebay/types';
import { getListingByEbayId, markSold } from '../../db/repos/listings';
import { recordEvent } from '../../db/repos/events';

export interface PollSalesResult {
  checked: number; // sales returned by eBay
  marked: number; // listings newly marked sold this run
}

/**
 * Autonomous, read-only sale detection: pull recently-sold items from eBay, match
 * them to our listings by eBay ItemID, and mark newly-sold ones sold + log an
 * Activity event. Idempotent — a listing already 'sold' is skipped, so re-polling
 * the same eBay window never double-marks or double-logs.
 */
export async function pollSales(db: Db, ebay: EbayAdapter, days = 30): Promise<PollSalesResult> {
  const sales = await ebay.getRecentSales(days);
  let marked = 0;
  for (const sale of sales) {
    const listing = await getListingByEbayId(db, sale.ebayListingId);
    if (!listing) continue; // a sale for something we didn't list here
    if (listing.status === 'sold') continue; // already recorded — idempotent
    await markSold(db, listing.id, { salePrice: sale.salePrice, soldAt: sale.soldAt });
    await recordEvent(db, {
      itemId: listing.itemId,
      kind: 'sale.detected',
      data: {
        listingId: listing.id,
        ebayListingId: sale.ebayListingId,
        salePrice: sale.salePrice,
        title: listing.title,
      },
    });
    marked += 1;
  }
  return { checked: sales.length, marked };
}
