import type { Db } from '../types';

export type BuyerMessageStatus = 'drafted' | 'sent' | 'skipped';

export interface BuyerMessageRow {
  id: string;
  ebayMessageId: string;
  listingId: string | null;
  sender: string | null;
  subject: string | null;
  question: string;
  draftedReply: string | null;
  status: BuyerMessageStatus;
  createdAt: string;
  updatedAt: string;
}

interface RawBuyerMessage {
  id: string;
  ebay_message_id: string;
  listing_id: string | null;
  sender: string | null;
  subject: string | null;
  question: string;
  drafted_reply: string | null;
  status: BuyerMessageStatus;
  created_at: string | Date;
  updated_at: string | Date;
}

function mapRow(r: RawBuyerMessage): BuyerMessageRow {
  return {
    id: r.id,
    ebayMessageId: r.ebay_message_id,
    listingId: r.listing_id,
    sender: r.sender,
    subject: r.subject,
    question: r.question,
    draftedReply: r.drafted_reply,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/** Insert a drafted reply for a buyer question; returns null if we've already seen this eBay message. */
export async function insertBuyerMessage(
  db: Db,
  input: {
    ebayMessageId: string;
    listingId: string | null;
    sender: string | null;
    subject: string | null;
    question: string;
    draftedReply: string;
  },
): Promise<BuyerMessageRow | null> {
  const { rows } = await db.query<RawBuyerMessage>(
    `insert into buyer_messages (ebay_message_id, listing_id, sender, subject, question, drafted_reply)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (ebay_message_id) do nothing
     returning *`,
    [input.ebayMessageId, input.listingId, input.sender, input.subject, input.question, input.draftedReply],
  );
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function getBuyerMessage(db: Db, id: string): Promise<BuyerMessageRow | null> {
  const { rows } = await db.query<RawBuyerMessage>(`select * from buyer_messages where id = $1`, [id]);
  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function hasSeenEbayMessage(db: Db, ebayMessageId: string): Promise<boolean> {
  const { rows } = await db.query<{ n: string | number }>(
    `select count(*) as n from buyer_messages where ebay_message_id = $1`,
    [ebayMessageId],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function updateBuyerMessage(
  db: Db,
  id: string,
  patch: { draftedReply?: string; status?: BuyerMessageStatus },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  if (patch.draftedReply !== undefined) {
    params.push(patch.draftedReply);
    sets.push(`drafted_reply = $${params.length}`);
  }
  if (patch.status !== undefined) {
    params.push(patch.status);
    sets.push(`status = $${params.length}`);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = now()');
  await db.query(`update buyer_messages set ${sets.join(', ')} where id = $1`, params);
}

/** Drafted replies still awaiting a decision, newest first. */
export async function listDraftedMessages(db: Db): Promise<BuyerMessageRow[]> {
  const { rows } = await db.query<RawBuyerMessage>(
    `select * from buyer_messages where status = 'drafted' order by created_at desc, ctid desc`,
  );
  return rows.map(mapRow);
}
