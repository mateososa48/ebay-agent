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

/**
 * Apply an edit to a draft listing (title / price / description / specifics /
 * condition), re-lint the result, and refuse changes that would break policy.
 * Shared by the review-screen edit controls and the assistant's update_listing tool.
 */
export async function applyListingEdit(db: Db, listingId: string, edit: ListingEdit): Promise<EditResult> {
  const listing = await getListing(db, listingId);
  if (!listing) return { ok: false, errors: [`Listing ${listingId} not found.`] };
  if (listing.status === 'live') {
    return { ok: false, errors: ['This listing is already live on eBay — edit it there.'] };
  }

  // Merge the edit over the current values, then lint the would-be result.
  const merged = {
    title: edit.title ?? listing.title,
    aspects: edit.aspects ?? listing.specifics,
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
    specifics: edit.aspects,
    condition: edit.condition,
    linterReport: linter,
  });
  await recordEvent(db, { itemId: listing.itemId, kind: 'listing_edited', data: { fields: Object.keys(edit) } });
  return { ok: true, linter };
}
