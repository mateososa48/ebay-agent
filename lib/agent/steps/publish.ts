// lib/agent/steps/publish.ts
import type { Db } from '../../db/types';
import type { EbayAdapter, PublishListingInput } from '../../ebay/types';
import type { ItemCondition } from '../../types';
import { getListing, updateListing } from '../../db/repos/listings';
import { getItem, updateItemStatus } from '../../db/repos/items';
import { getPendingApprovalByRef, decideApproval } from '../../db/repos/approvals';
import { getListingDefaults } from '../../db/repos/settings';
import { recordEvent } from '../../db/repos/events';

export interface PublishDeps {
  resolveCategoryId: (title: string) => Promise<string | null>;
  getPostalCode: () => Promise<string | null>;
}

export type PublishOutcome = { ok: true; url: string } | { ok: false; errors: string[] };

const KNOWN_CONDITIONS: ItemCondition[] = [
  'new', 'open_box', 'used_like_new', 'used_good', 'used_fair', 'for_parts',
];

/** Verify then publish an approved listing draft to eBay, updating all statuses.
 *  Always returns a PublishOutcome (never throws), so callers can render the error. */
export async function publishApprovedListing(
  db: Db,
  adapter: EbayAdapter,
  listingId: string,
  deps: PublishDeps,
): Promise<PublishOutcome> {
  const listing = await getListing(db, listingId);
  if (!listing) return { ok: false, errors: ['Listing not found.'] };
  // Broadened guard: a stored eBay id means it already went live, even if a prior
  // status write failed — never publish the same draft twice.
  if (listing.status === 'live' || listing.ebayListingId) {
    return { ok: false, errors: ['This listing is already live.'] };
  }

  // Fail closed: only a listing with a *pending* approval may be published.
  const approval = await getPendingApprovalByRef(db, listingId);
  if (!approval) return { ok: false, errors: ['This listing has no pending approval (already decided).'] };

  const item = await getItem(db, listing.itemId);
  if (!item) return { ok: false, errors: ['Item not found.'] };

  const defaults = await getListingDefaults(db);

  // Category: use the stored one, else resolve it (wrapped — a transient lookup
  // failure must surface as a retryable error, not an unhandled server throw).
  let categoryId = listing.ebayCategoryId;
  if (!categoryId) {
    try {
      categoryId = await deps.resolveCategoryId(listing.title);
    } catch (e) {
      return { ok: false, errors: [`Couldn't look up the eBay category (${(e as Error).message}). Try again.`] };
    }
  }
  if (!categoryId) return { ok: false, errors: ['Could not determine an eBay category for this item.'] };
  if (!listing.ebayCategoryId) await updateListing(db, listingId, { ebayCategoryId: categoryId });

  // Ship-from ZIP: Settings value wins; else read it from the connected account.
  let postalCode = defaults.shipZip.trim();
  if (!postalCode) {
    try {
      postalCode = (await deps.getPostalCode()) ?? '';
    } catch (e) {
      return { ok: false, errors: [`Couldn't read your ship-from ZIP (${(e as Error).message}). Set one in Settings.`] };
    }
  }
  if (!postalCode) return { ok: false, errors: ['No ship-from ZIP. Set one in Settings, or add an address to your eBay account.'] };

  if (listing.price === null) return { ok: false, errors: ['Listing has no price.'] };

  const condition = KNOWN_CONDITIONS.includes(listing.condition as ItemCondition)
    ? (listing.condition as ItemCondition)
    : 'used_good';

  const input: PublishListingInput = {
    title: listing.title,
    description: listing.description,
    price: listing.price,
    categoryId,
    condition,
    aspects: listing.specifics,
    photoUrls: item.photos,
    postalCode,
    idempotencyKey: listing.id.replace(/-/g, ''), // stable 32-hex → eBay dedupes retries
    shippingMode: defaults.shipMode,
    shippingCost: defaults.shipCost,
    returnWindow: defaults.returnWindow,
    handlingDays: defaults.handlingDays,
  };

  let verify;
  try {
    verify = await adapter.verifyListing(input);
  } catch (e) {
    return { ok: false, errors: [(e as Error).message] };
  }
  if (!verify.ok) return { ok: false, errors: verify.errors };

  let result;
  try {
    result = await adapter.publishListing(input);
  } catch (e) {
    await recordEvent(db, { itemId: item.id, kind: 'publish_failed', data: { message: (e as Error).message } });
    return { ok: false, errors: [(e as Error).message] };
  }

  // The listing now exists on eBay. Persist that fact FIRST; if this write fails,
  // tell the seller NOT to retry (a blind retry would create a second live listing).
  try {
    await updateListing(db, listingId, { status: 'live', ebayListingId: result.ebayListingId });
    await updateItemStatus(db, item.id, 'listed');
    await decideApproval(db, approval.id, 'approved');
    await recordEvent(db, { itemId: item.id, kind: 'published', data: { ebayListingId: result.ebayListingId, url: result.url } });
  } catch (e) {
    await recordEvent(db, {
      itemId: item.id,
      kind: 'publish_unsaved',
      data: { ebayListingId: result.ebayListingId, url: result.url, message: (e as Error).message },
    }).catch(() => {});
    return {
      ok: false,
      errors: [`Listing was created on eBay (item ${result.ebayListingId}) but we failed to save it. Do NOT retry — check your eBay listings.`],
    };
  }

  return { ok: true, url: result.url };
}
