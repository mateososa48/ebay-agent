// lib/agent/steps/publish.ts
import type { Db } from '../../db/types';
import type { EbayAdapter, PublishListingInput } from '../../ebay/types';
import type { ItemCondition } from '../../types';
import { getListing, updateListing } from '../../db/repos/listings';
import { getItem, updateItemStatus } from '../../db/repos/items';
import { getPendingApprovalByRef, decideApproval } from '../../db/repos/approvals';
import { recordEvent } from '../../db/repos/events';

export interface PublishDeps {
  resolveCategoryId: (title: string) => Promise<string | null>;
  getPostalCode: () => Promise<string | null>;
}

export type PublishOutcome = { ok: true; url: string } | { ok: false; errors: string[] };

/** Verify then publish an approved listing draft to eBay, updating all statuses. */
export async function publishApprovedListing(
  db: Db,
  adapter: EbayAdapter,
  listingId: string,
  deps: PublishDeps,
): Promise<PublishOutcome> {
  const listing = await getListing(db, listingId);
  if (!listing) return { ok: false, errors: ['Listing not found.'] };
  if (listing.status === 'live') return { ok: false, errors: ['This listing is already live.'] };

  const item = await getItem(db, listing.itemId);
  if (!item) return { ok: false, errors: ['Item not found.'] };

  const categoryId = listing.ebayCategoryId ?? (await deps.resolveCategoryId(listing.title));
  if (!categoryId) return { ok: false, errors: ['Could not determine an eBay category for this item.'] };
  if (!listing.ebayCategoryId) await updateListing(db, listingId, { ebayCategoryId: categoryId });

  const postalCode = await deps.getPostalCode();
  if (!postalCode) return { ok: false, errors: ['No ship-from ZIP. Set SELLER_POSTAL_CODE or add an address to your eBay account.'] };

  if (listing.price === null) return { ok: false, errors: ['Listing has no price.'] };

  const input: PublishListingInput = {
    title: listing.title,
    description: listing.description,
    price: listing.price,
    categoryId,
    condition: (listing.condition as ItemCondition) ?? 'used_good',
    aspects: listing.specifics,
    photoUrls: item.photos,
    postalCode,
  };

  const verify = await adapter.verifyListing(input);
  if (!verify.ok) return { ok: false, errors: verify.errors };

  let result;
  try {
    result = await adapter.publishListing(input);
  } catch (e) {
    await recordEvent(db, { itemId: item.id, kind: 'publish_failed', data: { message: (e as Error).message } });
    return { ok: false, errors: [(e as Error).message] };
  }

  await updateListing(db, listingId, { status: 'live', ebayListingId: result.ebayListingId });
  await updateItemStatus(db, item.id, 'listed');
  const approval = await getPendingApprovalByRef(db, listingId);
  if (approval) await decideApproval(db, approval.id, 'approved');
  await recordEvent(db, { itemId: item.id, kind: 'published', data: { ebayListingId: result.ebayListingId, url: result.url } });

  return { ok: true, url: result.url };
}
