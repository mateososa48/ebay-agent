// app/listings/[id]/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { getEbayAdapter, isLiveBackend } from '@/lib/ebay';
import { suggestCategoryId } from '@/lib/ebay/category';
import { getSellerPostalCode } from '@/lib/ebay/trading';
import { publishApprovedListing, type PublishOutcome } from '@/lib/agent/steps/publish';
import { applyListingEdit, type ListingEdit, type EditResult } from '@/lib/agent/steps/editListing';
import { getPendingApprovalByRef, decideApproval } from '@/lib/db/repos/approvals';
import { getListing } from '@/lib/db/repos/listings';
import { updateItemStatus, deleteItem } from '@/lib/db/repos/items';
import { recordEvent } from '@/lib/db/repos/events';

export async function publishListingAction(listingId: string): Promise<PublishOutcome> {
  const db = getDb();
  const outcome = await publishApprovedListing(db, getEbayAdapter(), listingId, {
    // Live category/ZIP come from eBay; mock backend uses static fallbacks so local runs need no network.
    resolveCategoryId: (title) => (isLiveBackend() ? suggestCategoryId(title) : Promise.resolve('11483')),
    getPostalCode: () =>
      isLiveBackend()
        ? getSellerPostalCode().then((z) => z ?? process.env.SELLER_POSTAL_CODE ?? null)
        : Promise.resolve(process.env.SELLER_POSTAL_CODE ?? '94103'),
  });
  if (outcome.ok) revalidatePath(`/listings/${listingId}`);
  return outcome;
}

export async function rejectListingAction(listingId: string): Promise<{ ok: boolean }> {
  const db = getDb();
  const listing = await getListing(db, listingId);
  if (!listing) return { ok: false };
  const approval = await getPendingApprovalByRef(db, listingId);
  if (approval) await decideApproval(db, approval.id, 'rejected');
  await updateItemStatus(db, listing.itemId, 'draft');
  await recordEvent(db, { itemId: listing.itemId, kind: 'sent_back', data: { listingId } });
  revalidatePath(`/listings/${listingId}`);
  return { ok: true };
}

/** Permanently delete a DRAFT (never a live/sold listing — those exist on eBay).
 *  Clears any pending approval first so the queue badge stays truthful. */
export async function deleteDraftAction(listingId: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const listing = await getListing(db, listingId);
  if (!listing) return { ok: false, error: 'Draft not found.' };
  if (listing.status === 'live' || listing.status === 'sold') {
    return { ok: false, error: 'This listing is on eBay — end it there first.' };
  }
  const approval = await getPendingApprovalByRef(db, listingId);
  if (approval) await decideApproval(db, approval.id, 'rejected');
  await recordEvent(db, {
    kind: 'draft.deleted',
    data: { listingId, title: listing.title },
  });
  await deleteItem(db, listing.itemId); // cascades the listing + comps
  revalidatePath('/');
  revalidatePath('/listings');
  return { ok: true };
}

/** Direct edit from the review screen's controls (price/title/description/specifics).
 *  On live listings only the price is editable — it's revised on eBay first. */
export async function updateListingAction(listingId: string, edit: ListingEdit): Promise<EditResult> {
  const res = await applyListingEdit(getDb(), listingId, edit, {
    reviseLivePrice: isLiveBackend()
      ? (ebayListingId, priceUsd) => getEbayAdapter().reviseListingPrice({ ebayListingId, priceUsd })
      : undefined,
  });
  if (res.ok) revalidatePath(`/listings/${listingId}`);
  return res;
}
