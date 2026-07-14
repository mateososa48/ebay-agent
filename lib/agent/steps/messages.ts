import type { Db } from '../../db/types';
import type { EbayAdapter, EbayBuyerQuestion } from '../../ebay/types';
import type { ListingRow } from '../../db/repos/listings';
import { getListingByEbayId } from '../../db/repos/listings';
import { hasSeenEbayMessage, insertBuyerMessage } from '../../db/repos/buyer-messages';
import { enqueueApproval } from '../../db/repos/approvals';
import { recordEvent } from '../../db/repos/events';

export type DraftReplyFn = (question: EbayBuyerQuestion, listing: ListingRow) => Promise<string>;

export interface PollMessagesResult {
  checked: number; // unanswered questions returned by eBay
  drafted: number; // new replies drafted + enqueued for approval this run
}

/**
 * Approval-gated buyer-message flow: pull unanswered questions, draft a reply for
 * each new one (grounded in our listing), and enqueue a 'message' approval.
 * NOTHING is sent here — sending happens only in the approve action.
 * Idempotent via the ebay_message_id unique key.
 */
export async function pollMessages(db: Db, ebay: EbayAdapter, draft: DraftReplyFn): Promise<PollMessagesResult> {
  const questions = await ebay.getBuyerQuestions(14);
  let drafted = 0;
  for (const q of questions) {
    if (await hasSeenEbayMessage(db, q.messageId)) continue; // already handled
    const listing = await getListingByEbayId(db, q.ebayListingId);
    if (!listing) continue; // question about an item not listed through this app
    const reply = await draft(q, listing);
    const row = await insertBuyerMessage(db, {
      ebayMessageId: q.messageId,
      listingId: listing.id,
      sender: q.senderId,
      subject: q.subject ?? null,
      question: q.body,
      draftedReply: reply,
    });
    if (!row) continue; // raced with another poll — the unique key kept it single
    await enqueueApproval(db, { type: 'message', refId: row.id });
    await recordEvent(db, {
      itemId: listing.itemId,
      kind: 'message.drafted',
      data: { messageId: row.id, listingId: listing.id, title: listing.title, buyer: q.senderId },
    });
    drafted += 1;
  }
  return { checked: questions.length, drafted };
}
