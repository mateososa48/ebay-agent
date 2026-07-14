import type { Db } from '../../db/types';
import type { EbayAdapter } from '../../ebay/types';
import { createItem, updateItemStatus } from '../../db/repos/items';
import { createListing, updateListing, getListingByEbayId } from '../../db/repos/listings';
import { recordEvent } from '../../db/repos/events';
import { ebayIdToCondition } from '../../ebay/condition';

export interface ImportResult {
  active: number; // live listings on the eBay account
  imported: number; // newly imported into the app this run
}

/** eBay descriptions arrive as HTML — flatten to readable text so the agent can
 *  ground replies/edits in it. Cheap tag strip + entity decode, capped. */
export function stripHtml(html: string, cap = 4000): string {
  const text = html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
  return text.length > cap ? `${text.slice(0, cap)}…` : text;
}

/**
 * Import the seller's pre-existing live eBay listings into the app so the agent
 * can manage them (offers, buyer replies, sale detection, price changes).
 * Read-only against eBay. Idempotent — anything already tracked (matched by
 * eBay ItemID) is skipped. `maxNew` bounds GetItem calls per run; the next run
 * picks up the remainder.
 */
export async function importListings(db: Db, ebay: EbayAdapter, maxNew = 25): Promise<ImportResult> {
  const active = await ebay.getActiveListings();
  let imported = 0;
  for (const a of active) {
    if (imported >= maxNew) break;
    if (await getListingByEbayId(db, a.ebayListingId)) continue; // already tracked
    const details = await ebay.getItemDetails(a.ebayListingId);
    if (!details) continue;

    const item = await createItem(db, {
      photos: details.photoUrls,
      sellerNotes: 'Imported from your eBay account — listed before the agent.',
    });
    await updateItemStatus(db, item.id, 'listed');

    const listing = await createListing(db, {
      itemId: item.id,
      title: details.title,
      specifics: details.specifics,
      description: stripHtml(details.description),
      price: details.price > 0 ? details.price : a.price,
      condition: ebayIdToCondition(details.conditionId),
    });
    await updateListing(db, listing.id, {
      status: 'live',
      ebayListingId: details.ebayListingId,
      ebayCategoryId: details.categoryId,
    });
    await recordEvent(db, {
      itemId: item.id,
      kind: 'listing.imported',
      data: { listingId: listing.id, ebayListingId: details.ebayListingId, title: details.title },
    });
    imported += 1;
  }
  return { active: active.length, imported };
}
