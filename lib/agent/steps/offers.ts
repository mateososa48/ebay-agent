import type { Db } from '../../db/types';
import type { EbayAdapter } from '../../ebay/types';
import { getListingByEbayId } from '../../db/repos/listings';
import { getActiveOfferForListing, insertOffer } from '../../db/repos/offers';
import { enqueueApproval } from '../../db/repos/approvals';
import { recordEvent } from '../../db/repos/events';

export interface PollOffersResult {
  eligible: number; // eligible listings reported by eBay
  drafted: number; // new offers drafted + enqueued for approval this run
}

/** Offer price: list price minus the discount, but never below 70% of list —
 *  a sanity floor so a bad setting can't propose a giveaway. 2dp. */
export function computeOfferPrice(listPrice: number, discountPct: number): number {
  const pct = Math.min(Math.max(discountPct, 1), 50); // clamp to a sane band
  const raw = listPrice * (1 - pct / 100);
  const floor = listPrice * 0.7;
  return Math.round(Math.max(raw, floor) * 100) / 100;
}

/**
 * Approval-gated offers flow: find live listings eBay says have interested
 * buyers, draft one discount offer per listing, and enqueue an 'offer' approval.
 * NOTHING is sent here — sending happens only in the approve action.
 * One active (drafted-or-sent) offer per listing, ever, so buyers aren't spammed.
 */
export async function pollOffers(db: Db, ebay: EbayAdapter, discountPct: number): Promise<PollOffersResult> {
  const eligibleIds = await ebay.getEligibleOfferListingIds();
  let drafted = 0;
  for (const ebayId of eligibleIds) {
    const listing = await getListingByEbayId(db, ebayId);
    if (!listing || listing.status !== 'live' || listing.price == null) continue;
    if (await getActiveOfferForListing(db, listing.id)) continue; // one offer per listing
    const offerPrice = computeOfferPrice(listing.price, discountPct);
    if (offerPrice >= listing.price) continue; // no meaningful discount possible
    const row = await insertOffer(db, {
      listingId: listing.id,
      discountPct,
      offerPrice,
      message: `Thanks for the interest — happy to do $${offerPrice.toFixed(2)} if you'd like it.`,
    });
    await enqueueApproval(db, { type: 'offer', refId: row.id });
    await recordEvent(db, {
      itemId: listing.itemId,
      kind: 'offer.drafted',
      data: { offerId: row.id, listingId: listing.id, title: listing.title, offerPrice, listPrice: listing.price },
    });
    drafted += 1;
  }
  return { eligible: eligibleIds.length, drafted };
}
