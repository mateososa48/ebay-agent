import type { Db } from '../../db/types';
import type { ItemCondition } from '../../types';
import { lintListing, type LinterReport } from '../../voice/linter';
import { getListing, updateListing } from '../../db/repos/listings';
import { recordEvent } from '../../db/repos/events';

export interface ListingEdit {
  title?: string;
  price?: number;
  description?: string;
  aspects?: Record<string, string>;
  condition?: ItemCondition;
}

export type EditResult =
  | { ok: true; linter: LinterReport }
  | { ok: false; errors: string[] };

export interface EditDeps {
  /** Pushes a new price to eBay for a live listing (ReviseFixedPriceItem). When
   *  absent, price edits on live listings are refused rather than silently
   *  diverging from what buyers see. */
  reviseLivePrice?: (ebayListingId: string, priceUsd: number) => Promise<void>;
}

/**
 * Apply an edit to a listing, re-lint the result, and refuse changes that would
 * break policy. Draft listings accept any field. LIVE listings accept a
 * price-only edit, which is revised on eBay first, then mirrored locally.
 * Shared by the review-screen edit controls and the assistant's update_listing tool.
 */
export async function applyListingEdit(
  db: Db,
  listingId: string,
  edit: ListingEdit,
  deps: EditDeps = {},
): Promise<EditResult> {
  const listing = await getListing(db, listingId);
  if (!listing) return { ok: false, errors: [`Listing ${listingId} not found.`] };
  if (listing.status === 'live') {
    const extraFields = Object.entries(edit).filter(([k, v]) => k !== 'price' && v !== undefined);
    if (extraFields.length > 0) {
      return {
        ok: false,
        errors: ['Only the price can be changed on a live listing from here — edit other fields on eBay.'],
      };
    }
    if (edit.price === undefined) return { ok: false, errors: ['Nothing to change.'] };
    if (!Number.isFinite(edit.price) || edit.price <= 0) {
      return { ok: false, errors: ['Price must be a positive number.'] };
    }
    if (!listing.ebayListingId || !deps.reviseLivePrice) {
      return { ok: false, errors: ['Live price changes aren’t available right now — try again shortly.'] };
    }
    const newPrice = Math.round(edit.price * 100) / 100;
    try {
      await deps.reviseLivePrice(listing.ebayListingId, newPrice);
    } catch (e) {
      return { ok: false, errors: [`eBay rejected the price change: ${(e as Error).message}`] };
    }
    await updateListing(db, listingId, { price: newPrice });
    await recordEvent(db, {
      itemId: listing.itemId,
      kind: 'price.revised',
      data: { listingId, from: listing.price, to: newPrice, title: listing.title },
    });
    return { ok: true, linter: { ok: true, blocking: [], warnings: [] } };
  }

  // Merge aspects PER-KEY (never replace the whole map — that would silently drop
  // every specific the caller didn't re-send), then lint the would-be result.
  const mergedAspects = edit.aspects ? { ...listing.specifics, ...edit.aspects } : listing.specifics;
  const merged = {
    title: edit.title ?? listing.title,
    aspects: mergedAspects,
    description: edit.description ?? listing.description,
    price: edit.price ?? listing.price ?? 0,
    condition: (edit.condition ?? (listing.condition as ItemCondition) ?? 'used_good') as ItemCondition,
  };
  const linter = lintListing(merged);
  if (!linter.ok) {
    return { ok: false, errors: linter.blocking.map((b) => b.message) };
  }

  await updateListing(db, listingId, {
    title: edit.title,
    price: edit.price,
    description: edit.description,
    specifics: edit.aspects ? mergedAspects : undefined,
    condition: edit.condition,
    linterReport: linter,
  });
  await recordEvent(db, { itemId: listing.itemId, kind: 'listing_edited', data: { fields: Object.keys(edit) } });
  return { ok: true, linter };
}
