// lib/ebay/trading.ts
import { ebayApiBase, getUserAccessToken } from './oauth';
import type { EbaySale, EbayBuyerQuestion, BuyerReplyInput } from './types';

/** Minimal XML escaping for text nodes we embed in Trading requests. */
function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface TradingResponse {
  ack: string;
  itemId?: string;
  errors: string[]; // Error-severity LongMessages
}

const TRADING_COMPAT_LEVEL = '1349';

/** Pull Ack/ItemID and Error-severity messages out of a Trading XML response. */
export function parseTradingResponse(xml: string): TradingResponse {
  const ack = xml.match(/<Ack>(\w+)<\/Ack>/)?.[1] ?? 'Unknown';
  const itemId = xml.match(/<ItemID>(\d+)<\/ItemID>/)?.[1];
  const errors: string[] = [];
  for (const block of xml.match(/<Errors>[\s\S]*?<\/Errors>/g) ?? []) {
    const severity = block.match(/<SeverityCode>(\w+)<\/SeverityCode>/)?.[1];
    if (severity && severity !== 'Error') continue;
    const msg = block.match(/<LongMessage>([\s\S]*?)<\/LongMessage>/)?.[1]
      ?? block.match(/<ShortMessage>([\s\S]*?)<\/ShortMessage>/)?.[1];
    if (msg) errors.push(msg.trim());
  }
  return { ack, itemId, errors };
}

export function parseGetUserPostalCode(xml: string): string | null {
  return xml.match(/<PostalCode>([^<]+)<\/PostalCode>/)?.[1]?.trim() ?? null;
}

/** POST a Trading call with the user OAuth token (IAF header) and return raw XML.
 *  Throws on a non-2xx response, mirroring category.ts / oauth.ts, so an eBay
 *  gateway/auth error never gets mis-parsed into an empty "unknown" result. */
async function tradingFetch(callName: string, body: string): Promise<string> {
  const token = await getUserAccessToken();
  const res = await fetch(`${ebayApiBase()}/ws/api.dll`, {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': callName,
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': TRADING_COMPAT_LEVEL,
      'X-EBAY-API-IAF-TOKEN': token,
      'Content-Type': 'text/xml',
    },
    body,
  });
  if (!res.ok) throw new Error(`eBay ${callName} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res.text();
}

/** POST a Trading API call and parse the Ack/ItemID/Errors out of the response. */
export async function tradingRequest(callName: string, body: string): Promise<TradingResponse> {
  return parseTradingResponse(await tradingFetch(callName, body));
}

/** The connected seller's registration ZIP, or null if eBay doesn't return one. */
export async function getSellerPostalCode(): Promise<string | null> {
  const xml = await tradingFetch(
    'GetUser',
    `<?xml version="1.0" encoding="utf-8"?>
<GetUserRequest xmlns="urn:ebay:apis:eBLBaseComponents"><DetailLevel>ReturnAll</DetailLevel></GetUserRequest>`,
  );
  return parseGetUserPostalCode(xml);
}

/** Pull sold items out of a GetSellerTransactions XML response. */
export function parseSellerTransactions(xml: string): EbaySale[] {
  const sales: EbaySale[] = [];
  for (const t of xml.match(/<Transaction>[\s\S]*?<\/Transaction>/g) ?? []) {
    const ebayListingId = t.match(/<ItemID>(\d+)<\/ItemID>/)?.[1];
    if (!ebayListingId) continue;
    const priceRaw = t.match(/<TransactionPrice[^>]*>([\d.]+)<\/TransactionPrice>/)?.[1];
    const price = Number(priceRaw);
    const soldAt =
      t.match(/<PaidTime>([^<]+)<\/PaidTime>/)?.[1] ??
      t.match(/<CreatedDate>([^<]+)<\/CreatedDate>/)?.[1] ??
      null;
    sales.push({
      ebayListingId,
      salePrice: Number.isFinite(price) ? price : 0,
      soldAt,
      title: t.match(/<Title>([\s\S]*?)<\/Title>/)?.[1]?.trim(),
      transactionId: t.match(/<TransactionID>(\d+)<\/TransactionID>/)?.[1],
    });
  }
  return sales;
}

/** Pull unanswered buyer questions out of a GetMemberMessages XML response. */
export function parseMemberMessages(xml: string): EbayBuyerQuestion[] {
  const out: EbayBuyerQuestion[] = [];
  for (const ex of xml.match(/<MemberMessageExchange>[\s\S]*?<\/MemberMessageExchange>/g) ?? []) {
    const status = ex.match(/<MessageStatus>(\w+)<\/MessageStatus>/)?.[1];
    if (status && status !== 'Unanswered') continue;
    const ebayListingId = ex.match(/<ItemID>(\d+)<\/ItemID>/)?.[1];
    const q = ex.match(/<Question>[\s\S]*?<\/Question>/)?.[0] ?? ex;
    const messageId = q.match(/<MessageID>([^<]+)<\/MessageID>/)?.[1];
    const senderId = q.match(/<SenderID>([^<]+)<\/SenderID>/)?.[1];
    const body = q.match(/<Body>([\s\S]*?)<\/Body>/)?.[1]?.trim();
    if (!ebayListingId || !messageId || !senderId || !body) continue;
    out.push({
      messageId,
      ebayListingId,
      senderId,
      subject: q.match(/<Subject>([\s\S]*?)<\/Subject>/)?.[1]?.trim(),
      body,
    });
  }
  return out;
}

/** Unanswered buyer questions from the last N days (Trading GetMemberMessages). Read-only. */
export async function getBuyerQuestions(days = 14, now = new Date()): Promise<EbayBuyerQuestion[]> {
  const end = now.toISOString();
  const start = new Date(now.getTime() - days * 86400_000).toISOString();
  const xml = await tradingFetch(
    'GetMemberMessages',
    `<?xml version="1.0" encoding="utf-8"?>
<GetMemberMessagesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <MailMessageType>AskSellerQuestion</MailMessageType>
  <MessageStatus>Unanswered</MessageStatus>
  <StartCreationTime>${start}</StartCreationTime>
  <EndCreationTime>${end}</EndCreationTime>
  <Pagination><EntriesPerPage>50</EntriesPerPage><PageNumber>1</PageNumber></Pagination>
</GetMemberMessagesRequest>`,
  );
  return parseMemberMessages(xml);
}

/** Reply to a buyer question (Trading AddMemberMessageRTQ). WRITE — call only after approval. */
export async function replyToBuyerQuestion(input: BuyerReplyInput): Promise<void> {
  const res = await tradingRequest(
    'AddMemberMessageRTQ',
    `<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageRTQRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${xmlEscape(input.ebayListingId)}</ItemID>
  <MemberMessage>
    <Body>${xmlEscape(input.body)}</Body>
    <ParentMessageID>${xmlEscape(input.parentMessageId)}</ParentMessageID>
    <RecipientID>${xmlEscape(input.recipientId)}</RecipientID>
  </MemberMessage>
</AddMemberMessageRTQRequest>`,
  );
  if (res.ack !== 'Success' && res.ack !== 'Warning') {
    throw new Error(res.errors.join('; ') || `eBay AddMemberMessageRTQ returned ${res.ack}`);
  }
}

/** Recently-sold items for the connected seller (Trading GetSellerTransactions). Read-only. */
export async function getRecentSales(days = 30): Promise<EbaySale[]> {
  const window = Math.min(Math.max(1, Math.floor(days)), 30); // eBay caps NumberOfDays at 30
  const xml = await tradingFetch(
    'GetSellerTransactions',
    `<?xml version="1.0" encoding="utf-8"?>
<GetSellerTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents"><NumberOfDays>${window}</NumberOfDays><DetailLevel>ReturnAll</DetailLevel></GetSellerTransactionsRequest>`,
  );
  return parseSellerTransactions(xml);
}
