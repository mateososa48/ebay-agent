'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db/client';
import { getEbayAdapter, isLiveBackend } from '@/lib/ebay';
import { getBuyerMessage, updateBuyerMessage } from '@/lib/db/repos/buyer-messages';
import { getOffer, updateOffer } from '@/lib/db/repos/offers';
import { getListing } from '@/lib/db/repos/listings';
import { getPendingApprovalByRef, decideApproval } from '@/lib/db/repos/approvals';
import { recordEvent } from '@/lib/db/repos/events';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Save an edited draft reply (before approving). */
export async function updateReplyDraftAction(id: string, text: string): Promise<ActionResult> {
  const body = text.trim();
  if (!body) return { ok: false, error: 'Reply can’t be empty.' };
  await updateBuyerMessage(getDb(), id, { draftedReply: body.slice(0, 2000) });
  revalidatePath('/');
  return { ok: true };
}

/** Approve a drafted reply → actually send it to the buyer on eBay. */
export async function approveReplyAction(id: string): Promise<ActionResult> {
  const db = getDb();
  const msg = await getBuyerMessage(db, id);
  if (!msg) return { ok: false, error: 'Reply not found.' };
  if (msg.status !== 'drafted') return { ok: false, error: 'Already handled.' };
  if (!msg.draftedReply?.trim()) return { ok: false, error: 'Draft is empty.' };
  if (!isLiveBackend()) return { ok: false, error: 'eBay backend not live.' };

  const listing = msg.listingId ? await getListing(db, msg.listingId) : null;
  if (!listing?.ebayListingId) return { ok: false, error: 'Listing is no longer on eBay.' };
  if (!msg.sender) return { ok: false, error: 'Missing buyer username.' };

  try {
    await getEbayAdapter().replyToBuyerQuestion({
      ebayListingId: listing.ebayListingId,
      recipientId: msg.sender,
      parentMessageId: msg.ebayMessageId,
      body: msg.draftedReply.trim(),
    });
  } catch (e) {
    return { ok: false, error: `eBay rejected the reply: ${(e as Error).message}` };
  }

  await updateBuyerMessage(db, id, { status: 'sent' });
  const approval = await getPendingApprovalByRef(db, id);
  if (approval) await decideApproval(db, approval.id, 'approved');
  await recordEvent(db, {
    itemId: listing.itemId,
    kind: 'message.sent',
    data: { messageId: id, listingId: listing.id, title: listing.title, buyer: msg.sender },
  });
  revalidatePath('/');
  return { ok: true };
}

/** Skip a drafted reply — nothing is sent; you can answer manually on eBay. */
export async function rejectReplyAction(id: string): Promise<ActionResult> {
  const db = getDb();
  const msg = await getBuyerMessage(db, id);
  if (!msg) return { ok: false, error: 'Reply not found.' };
  if (msg.status !== 'drafted') return { ok: false, error: 'Already handled.' };
  await updateBuyerMessage(db, id, { status: 'skipped' });
  const approval = await getPendingApprovalByRef(db, id);
  if (approval) await decideApproval(db, approval.id, 'rejected');
  revalidatePath('/');
  return { ok: true };
}

/** Approve a drafted offer → actually send it to interested buyers on eBay. */
export async function approveOfferAction(id: string): Promise<ActionResult> {
  const db = getDb();
  const offer = await getOffer(db, id);
  if (!offer) return { ok: false, error: 'Offer not found.' };
  if (offer.status !== 'drafted') return { ok: false, error: 'Already handled.' };
  if (!isLiveBackend()) return { ok: false, error: 'eBay backend not live.' };

  const listing = await getListing(db, offer.listingId);
  if (!listing?.ebayListingId) return { ok: false, error: 'Listing is no longer on eBay.' };
  if (listing.status !== 'live') return { ok: false, error: 'Listing is not live anymore.' };

  try {
    await getEbayAdapter().sendOfferToInterestedBuyers({
      ebayListingId: listing.ebayListingId,
      priceUsd: offer.offerPrice,
      message: offer.message ?? undefined,
    });
  } catch (e) {
    return { ok: false, error: `eBay rejected the offer: ${(e as Error).message}` };
  }

  await updateOffer(db, id, { status: 'sent' });
  const approval = await getPendingApprovalByRef(db, id);
  if (approval) await decideApproval(db, approval.id, 'approved');
  await recordEvent(db, {
    itemId: listing.itemId,
    kind: 'offer.sent',
    data: { offerId: id, listingId: listing.id, title: listing.title, offerPrice: offer.offerPrice },
  });
  revalidatePath('/');
  return { ok: true };
}

/** Skip a drafted offer — nothing is sent. */
export async function rejectOfferAction(id: string): Promise<ActionResult> {
  const db = getDb();
  const offer = await getOffer(db, id);
  if (!offer) return { ok: false, error: 'Offer not found.' };
  if (offer.status !== 'drafted') return { ok: false, error: 'Already handled.' };
  await updateOffer(db, id, { status: 'skipped' });
  const approval = await getPendingApprovalByRef(db, id);
  if (approval) await decideApproval(db, approval.id, 'rejected');
  revalidatePath('/');
  return { ok: true };
}
