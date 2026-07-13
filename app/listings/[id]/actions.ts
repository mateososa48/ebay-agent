// app/listings/[id]/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { getEbayAdapter } from '@/lib/ebay';
import { suggestCategoryId } from '@/lib/ebay/category';
import { getSellerPostalCode } from '@/lib/ebay/trading';
import { publishApprovedListing, type PublishOutcome } from '@/lib/agent/steps/publish';
import { getPendingApprovalByRef, decideApproval } from '@/lib/db/repos/approvals';
import { getListing } from '@/lib/db/repos/listings';
import { updateItemStatus } from '@/lib/db/repos/items';
import { recordEvent } from '@/lib/db/repos/events';

const isLive = () =>
  (process.env.EBAY_BACKEND ?? (process.env.EBAY_APP_ID && process.env.EBAY_CERT_ID ? 'live' : 'mock')) === 'live';

export async function publishListingAction(listingId: string): Promise<PublishOutcome> {
  const db = getDb();
  const outcome = await publishApprovedListing(db, getEbayAdapter(), listingId, {
    // Live category/ZIP come from eBay; mock backend never calls these (its verify short-circuits nothing),
    // so a static fallback keeps local/mock runs working without network.
    resolveCategoryId: (title) => (isLive() ? suggestCategoryId(title) : Promise.resolve('11483')),
    getPostalCode: () => (isLive() ? getSellerPostalCode() : Promise.resolve(process.env.SELLER_POSTAL_CODE ?? '94103')),
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
