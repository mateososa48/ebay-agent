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
import { updateItemStatus } from '@/lib/db/repos/items';
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

/** Direct edit from the review screen's controls (price/title/description/specifics). */
export async function updateListingAction(listingId: string, edit: ListingEdit): Promise<EditResult> {
  const res = await applyListingEdit(getDb(), listingId, edit);
  if (res.ok) revalidatePath(`/listings/${listingId}`);
  return res;
}
