import type { ItemIdentity, Comp, ItemCondition } from '../types';

export interface IdentifyByImageInput {
  images: string[]; // base64 data or storage refs (opaque to the adapter contract)
  sellerNotes?: string;
}

export interface PublishResult {
  ebayListingId: string;
  url: string;
}

/** Everything the Trading API needs to list one fixed-price item. */
export interface PublishListingInput {
  title: string;
  description: string;
  price: number; // USD dollars
  categoryId: string; // eBay leaf category id
  condition: ItemCondition;
  aspects: Record<string, string>; // item specifics
  photoUrls: string[]; // public image URLs (Vercel Blob)
  postalCode: string; // ship-from ZIP
  idempotencyKey?: string; // 32-hex UUID; eBay dedupes repeat AddFixedPriceItem calls with the same key
  // Seller defaults (from Settings). Omitted → free shipping / 30-day returns / 3-day handling.
  shippingMode?: 'free' | 'flat';
  shippingCost?: number; // USD, when shippingMode === 'flat'
  returnWindow?: 'days_30' | 'days_60' | 'none';
  handlingDays?: number;
}

export interface VerifyResult {
  ok: boolean;
  errors: string[]; // eBay error LongMessages; empty when ok
}

/** A recently-sold item as reported by eBay (Trading GetSellerTransactions). */
export interface EbaySale {
  ebayListingId: string; // eBay ItemID
  salePrice: number; // USD
  soldAt: string | null; // ISO; null if eBay didn't return a timestamp
  title?: string;
  transactionId?: string;
}

/** An unanswered buyer question (Trading GetMemberMessages). */
export interface EbayBuyerQuestion {
  messageId: string; // eBay MessageID — dedupe key
  ebayListingId: string; // ItemID the question is about
  senderId: string; // buyer username (RecipientID for the reply)
  subject?: string;
  body: string;
}

/** Send a reply to a buyer question (Trading AddMemberMessageRTQ). */
export interface BuyerReplyInput {
  ebayListingId: string;
  recipientId: string;
  parentMessageId: string;
  body: string;
}

/** Send a discount offer to interested buyers (Negotiation API). */
export interface SendOfferInput {
  ebayListingId: string;
  priceUsd: number;
  message?: string;
}

/** A live listing on the seller's account (Trading GetMyeBaySelling ActiveList). */
export interface EbayActiveListing {
  ebayListingId: string;
  title: string;
  price: number; // current price, USD
}

/** Live engagement stats for one listing (Trading GetItem). */
export interface EbayListingStats {
  ebayListingId: string;
  watchCount: number | null;
  hitCount: number | null; // page views — eBay returns it to the seller when available
  quantitySold: number | null;
}

/** Full details of one eBay listing (Trading GetItem) — used to import it. */
export interface EbayItemDetails {
  ebayListingId: string;
  title: string;
  description: string; // HTML as eBay returns it
  price: number;
  photoUrls: string[];
  categoryId: string | null;
  conditionId: number | null;
  specifics: Record<string, string>;
  startTime: string | null; // ISO — when the listing actually went live on eBay
}

/**
 * The single seam between the agent and eBay. Two implementations exist:
 * `mock` (deterministic fixtures, used everywhere until the keyset lands) and
 * `live` (real eBay APIs — added in a later plan). Listing publish maps to the
 * Trading API AddFixedPriceItem in `live`, so listings are Negotiation-API-eligible.
 */
export interface EbayAdapter {
  identifyByImage(input: IdentifyByImageInput): Promise<ItemIdentity>;
  findComps(query: { identity: ItemIdentity }): Promise<Comp[]>;
  verifyListing(input: PublishListingInput): Promise<VerifyResult>;
  publishListing(input: PublishListingInput): Promise<PublishResult>;
  /** Recently-sold items, for autonomous sale detection. Read-only. */
  getRecentSales(days?: number): Promise<EbaySale[]>;
  /** Unanswered buyer questions on the seller's items. Read-only. */
  getBuyerQuestions(days?: number): Promise<EbayBuyerQuestion[]>;
  /** Reply to a buyer question. WRITE — only called after human approval. */
  replyToBuyerQuestion(input: BuyerReplyInput): Promise<void>;
  /** eBay ItemIDs of live listings eligible for offers-to-interested-buyers. Read-only. */
  getEligibleOfferListingIds(): Promise<string[]>;
  /** Send a discount offer to interested buyers. WRITE — only called after human approval. */
  sendOfferToInterestedBuyers(input: SendOfferInput): Promise<void>;
  /** All active listings on the seller's account. Read-only — powers import. */
  getActiveListings(): Promise<EbayActiveListing[]>;
  /** Full details for one listing (import). Read-only. Null if eBay can't find it. */
  getItemDetails(ebayListingId: string): Promise<EbayItemDetails | null>;
  /** Change the price of a live listing. WRITE — driven by an explicit seller action. */
  reviseListingPrice(input: { ebayListingId: string; priceUsd: number }): Promise<void>;
  /** Watch/view/sold counts for one live listing. Read-only — powers analytics. */
  getListingStats(ebayListingId: string): Promise<EbayListingStats | null>;
}
